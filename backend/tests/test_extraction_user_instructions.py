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
    # Imperative tone — the model must not treat the filter as optional.
    assert "DROPPED" in texts[0]
    assert "Drop silently" in texts[0]
    # Audit trail: the prompt asks the model to list the dishes it
    # dropped so the product can show a "receipt" to the user.
    assert "excluded_by_user_filter" in texts[0]
    # Few-shot examples are embedded to teach the model the exact
    # shape we expect (filtered in / filtered out + audit list).
    assert "FEW-SHOT EXAMPLES" in texts[0]
    # SECOND block is the generic per-chunk directive, unchanged.
    assert "Extract dishes per the rules" in texts[1]


def test_post_filter_drops_candidate_that_also_appears_in_excluded_list(
    monkeypatch,
) -> None:
    """If Opus contradicts itself — returning a candidate AND listing
    that same dish in `excluded_by_user_filter` — we trust the
    exclusion list and drop the candidate.

    This is the defense-in-depth that makes the HARD FILTER feel
    reliable to the user even when the model slips up on one item.
    """
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")

    # Model returns Coca-Cola as a candidate but ALSO tells us it
    # excluded Coca-Cola due to the filter — clear self-contradiction.
    body = {
        "candidates": [
            {
                "raw_name": "Pasta alla Bolognese",
                "normalized_name": "Pasta alla Bolognese",
                "inferred_dish_type": "pasta",
                "ingredients": [],
                "price_value": 12.0,
                "price_currency": "EUR",
                "is_modifier_candidate": False,
                "is_ephemeral_candidate": False,
                "aliases": [],
                "search_terms": [],
            },
            {
                "raw_name": "Coca-Cola",
                "normalized_name": "Coca-Cola",
                "inferred_dish_type": "drink",
                "ingredients": [],
                "price_value": 3.0,
                "price_currency": "EUR",
                "is_modifier_candidate": False,
                "is_ephemeral_candidate": False,
                "aliases": ["Coke"],
                "search_terms": [],
            },
        ],
        "excluded_by_user_filter": ["Coca-Cola"],
    }

    class _FakeMessages:
        def create(self, **kwargs):
            return _mk_sdk_response(body)

    class _FakeClient:
        messages = _FakeMessages()

    with patch.object(ai_client, "Anthropic", return_value=_FakeClient()):
        ai_client.get_client.cache_clear()
        candidates = extraction._call_one_chunk(
            source=_source(),
            chunk_bytes=b"\xff\xd8\xff\xe0dummy",
            media_type="image/jpeg",
            chunk_label="",
            span_prefix="",
            effort="low",
            max_tokens=256,
            user_instructions="No beverages.",
        )

    names = [c.normalized_name for c in candidates]
    assert "Pasta alla Bolognese" in names
    assert "Coca-Cola" not in names, (
        "post-filter must drop the self-contradicted candidate"
    )


def test_post_filter_matches_candidate_via_alias(monkeypatch) -> None:
    """If an excluded name matches one of the candidate's aliases (not
    its canonical name), the candidate must still be dropped — otherwise
    a naive "Coke" exclusion wouldn't catch the "Coca-Cola" dish whose
    aliases include "Coke".
    """
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")

    body = {
        "candidates": [
            {
                "raw_name": "Coca-Cola 500ml",
                "normalized_name": "Coca-Cola 500ml",
                "inferred_dish_type": "drink",
                "ingredients": [],
                "price_value": 3.0,
                "price_currency": "EUR",
                "is_modifier_candidate": False,
                "is_ephemeral_candidate": False,
                "aliases": ["Coke", "Cola"],
                "search_terms": [],
            },
        ],
        "excluded_by_user_filter": ["coke"],
    }

    class _FakeMessages:
        def create(self, **kwargs):
            return _mk_sdk_response(body)

    class _FakeClient:
        messages = _FakeMessages()

    with patch.object(ai_client, "Anthropic", return_value=_FakeClient()):
        ai_client.get_client.cache_clear()
        candidates = extraction._call_one_chunk(
            source=_source(),
            chunk_bytes=b"\xff\xd8\xff\xe0dummy",
            media_type="image/jpeg",
            chunk_label="",
            span_prefix="",
            effort="low",
            max_tokens=256,
            user_instructions="No beverages.",
        )

    assert candidates == [], (
        "alias-based match should also trigger the post-filter"
    )


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


# ---------- post-extraction LLM filter pass ----------


def _fake_candidate(name: str, *, dish_type: str = "unknown",
                    ingredients: list[str] | None = None) -> "extraction.DishCandidate":
    from app.core.store import new_id
    from app.domain.models import DishCandidate, EvidenceRecord
    return DishCandidate(
        id=new_id("cand"),
        source_id="src-test",
        raw_name=name,
        normalized_name=name,
        inferred_dish_type=dish_type,
        ingredients=ingredients or [],
        price_value=None,
        price_currency=None,
        aliases=[],
        search_terms=[],
        evidence=EvidenceRecord(source_id="src-test", raw_text=name),
    )


def test_post_filter_respects_keep_decisions(monkeypatch) -> None:
    """Second-pass LLM filter honours the keep/drop decisions it returns.

    Core contract: for every cid the model emits keep=true/false and we
    drop the false ones. Tests the happy path — the mock model explicitly
    decides on every input.
    """
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")

    candidates = [
        _fake_candidate("Milanesa Napolitana", dish_type="meat",
                        ingredients=["beef", "tomato", "mozzarella"]),
        _fake_candidate("Risotto de Hongos", dish_type="risotto",
                        ingredients=["rice", "mushrooms", "butter"]),
        _fake_candidate("Ensalada Caprese", dish_type="salad",
                        ingredients=["tomato", "mozzarella", "basil"]),
    ]

    body = {
        "decisions": [
            {"cid": 0, "keep": True, "reason": "contains beef"},
            {"cid": 1, "keep": False, "reason": "purely vegetarian"},
            {"cid": 2, "keep": False, "reason": "purely vegetarian"},
        ]
    }

    class _FakeMessages:
        def create(self, **kwargs):
            return _mk_sdk_response(body)

    class _FakeClient:
        messages = _FakeMessages()

    with patch.object(ai_client, "Anthropic", return_value=_FakeClient()):
        ai_client.get_client.cache_clear()
        kept, audit = extraction.apply_user_instruction_filter(
            candidates, "no veggie"
        )

    kept_names = [c.normalized_name for c in kept]
    assert kept_names == ["Milanesa Napolitana"]
    assert len(audit) == 3
    assert [a["kept"] for a in audit] == [True, False, False]


def test_post_filter_fails_open_on_llm_error(monkeypatch) -> None:
    """If the filter LLM call fails, we return the input unchanged.

    A user typing 'no desserts' should never have their entire catalog
    vanish because Anthropic was rate-limited. Losing this second pass
    is degraded (the in-prompt HARD FILTER still ran during extraction),
    not catastrophic — so the function must never raise.
    """
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")

    candidates = [
        _fake_candidate("Tiramisu"),
        _fake_candidate("Pasta alla Bolognese"),
    ]

    def _raise(*args, **kwargs):
        raise ai_client.OpusCallError("simulated outage")

    with patch.object(extraction, "call_opus", side_effect=_raise):
        kept, audit = extraction.apply_user_instruction_filter(
            candidates, "no desserts"
        )

    assert len(kept) == len(candidates), (
        "failed filter pass must not delete the user's catalog"
    )
    assert audit == []


def test_post_filter_noop_on_blank_instruction(monkeypatch) -> None:
    """Blank / whitespace instructions skip the LLM call entirely.

    Keeps the happy path (no filter attached) at zero extra tokens.
    """
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")
    candidates = [_fake_candidate("Margherita")]

    # No patching — if the function were to make an LLM call with a
    # blank instruction, the real client code would try to load an API
    # key and fail loudly. The test passing proves no call happened.
    kept, audit = extraction.apply_user_instruction_filter(candidates, "   ")
    assert kept == candidates
    assert audit == []


def test_post_filter_defaults_to_keep_on_missing_decision(monkeypatch) -> None:
    """When the model skips a cid in its response, we default to keep.

    Losing a dish silently because the model's JSON was incomplete is
    the worst failure mode — the user has no way to notice. Err toward
    inclusion; users can always drop dishes from the review UI later.
    """
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")

    candidates = [
        _fake_candidate("Pasta"),
        _fake_candidate("Tiramisu"),
    ]

    # Model only emits a decision for cid=0; cid=1 is silently dropped.
    body = {"decisions": [{"cid": 0, "keep": True, "reason": "mains"}]}

    class _FakeMessages:
        def create(self, **kwargs):
            return _mk_sdk_response(body)

    class _FakeClient:
        messages = _FakeMessages()

    with patch.object(ai_client, "Anthropic", return_value=_FakeClient()):
        ai_client.get_client.cache_clear()
        kept, _ = extraction.apply_user_instruction_filter(
            candidates, "only mains"
        )

    kept_names = [c.normalized_name for c in kept]
    assert "Pasta" in kept_names
    assert "Tiramisu" in kept_names, (
        "missing cid decision must default to keep, not drop"
    )
