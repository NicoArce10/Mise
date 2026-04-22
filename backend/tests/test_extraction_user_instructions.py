"""Tests for the `user_instructions` path through extraction.

The system prompt (`backend/app/ai/prompts/extraction.md`) is shared
across every run. User-authored filters ("exclude beverages", "only
pizzas") ride in the user message, not the system prompt, so they are
scoped to one run and can never pollute the cached prefix.

These tests pin that contract: blank input is a no-op, real text lands
as its own text block after the image block, and oversize input is
rejected upstream at the API layer (validated separately in
`test_processing.py`).
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from app.ai import client as ai_client
from app.ai import extraction
from app.domain.models import SourceDocument, SourceKind


def _source() -> SourceDocument:
    return SourceDocument(
        id=f"src-{uuid4()}",
        filename="menu_test.jpg",
        kind=SourceKind.PHOTO,
        content_type="image/jpeg",
        size_bytes=1,
        sha256="0" * 64,
    )


def _mk_sdk_response(payload: dict | None = None) -> SimpleNamespace:
    body = payload if payload is not None else {"candidates": []}
    block = SimpleNamespace(type="text", text=json.dumps(body))
    return SimpleNamespace(content=[block])


def _capture_sent(fn, *args, **kwargs) -> dict:
    """Run `_call_one_chunk` with a patched Anthropic client and return
    the kwargs that would have been sent to the SDK."""
    captured: dict = {}

    class _FakeMessages:
        def create(self, **kwargs):
            captured.update(kwargs)
            return _mk_sdk_response()

    class _FakeClient:
        messages = _FakeMessages()

    with patch.object(ai_client, "Anthropic", return_value=_FakeClient()):
        ai_client.get_client.cache_clear()
        fn(*args, **kwargs)
    return captured


def _text_blocks(messages: list[dict]) -> list[str]:
    out: list[str] = []
    for msg in messages:
        for block in msg.get("content", []):
            if isinstance(block, dict) and block.get("type") == "text":
                out.append(block.get("text", ""))
    return out


def test_user_instructions_none_adds_no_extra_block(monkeypatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")
    sent = _capture_sent(
        extraction._call_one_chunk,
        source=_source(),
        chunk_bytes=b"\xff\xd8\xff\xe0dummy",
        media_type="image/jpeg",
        chunk_label="",
        span_prefix="",
        effort="low",
        max_tokens=256,
        user_instructions=None,
    )

    texts = _text_blocks(sent["messages"])
    # Exactly one text block — the generic "extract dishes" directive.
    assert len(texts) == 1
    assert "Extract dishes per the rules" in texts[0]
    assert "Extra user instructions" not in texts[0]


def test_user_instructions_whitespace_only_is_ignored(monkeypatch) -> None:
    """A textarea the user tapped but never wrote in must not bloat the prompt."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")
    sent = _capture_sent(
        extraction._call_one_chunk,
        source=_source(),
        chunk_bytes=b"\xff\xd8\xff\xe0dummy",
        media_type="image/jpeg",
        chunk_label="",
        span_prefix="",
        effort="low",
        max_tokens=256,
        user_instructions="   \n  \t  ",
    )

    texts = _text_blocks(sent["messages"])
    assert len(texts) == 1
    assert "Extra user instructions" not in texts[0]


def test_user_instructions_real_text_adds_hard_filter_block_first(
    monkeypatch,
) -> None:
    """When the user provides instructions we now ship them as the FIRST
    text block (before the generic "extract dishes per the rules"
    directive) and in hard-filter wording — not as a polite trailer.

    This regression came from a real failure mode: Opus 4.7 happily
    extracted veggie dishes on a run where the user typed "no veggie".
    The fix repositions the block and changes the tone to imperative,
    and we lock that in here so it can't drift back.
    """
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")
    directive = "Exclude beverages and desserts."
    sent = _capture_sent(
        extraction._call_one_chunk,
        source=_source(),
        chunk_bytes=b"\xff\xd8\xff\xe0dummy",
        media_type="image/jpeg",
        chunk_label="",
        span_prefix="",
        effort="low",
        max_tokens=256,
        user_instructions=directive,
    )

    texts = _text_blocks(sent["messages"])
    assert len(texts) == 2, "expected both the HARD FILTER and the extract directive"
    # FIRST block is the user's hard-filter block — positioned before
    # the generic directive so the model reads "drop THESE, then
    # extract" rather than "extract, and by the way also do this".
    assert "HARD FILTER" in texts[0]
    assert directive in texts[0]
    assert "DROPPED from the output entirely" in texts[0]
    assert "Drop silently" in texts[0]
    # SECOND block is the generic per-chunk directive, unchanged.
    assert "Extract dishes per the rules" in texts[1]


def test_user_instructions_do_not_leak_into_system_prompt(monkeypatch) -> None:
    """System prompt stays cacheable; user_instructions must not touch it.

    Opus caches the system prompt ephemeral-style. Mixing per-run text
    into it would bust the cache for every request — the whole point of
    sending instructions as a user content block is to keep the cached
    prefix untouched.
    """
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")
    directive = "Only extract pizzas."
    sent = _capture_sent(
        extraction._call_one_chunk,
        source=_source(),
        chunk_bytes=b"\xff\xd8\xff\xe0dummy",
        media_type="image/jpeg",
        chunk_label="",
        span_prefix="",
        effort="low",
        max_tokens=256,
        user_instructions=directive,
    )

    system_blocks = sent.get("system", [])
    system_text = " ".join(
        block.get("text", "") for block in system_blocks if isinstance(block, dict)
    )
    assert directive not in system_text, (
        "user_instructions leaked into the system prompt — cache prefix broken"
    )
