"""Tests for the anthropic client wrapper guardrails.

No network. We patch `anthropic.Anthropic` so we can inspect what keys we
would have sent — the invariant is that banned knobs (`budget_tokens`,
`temperature`, `top_p`, `top_k`, assistant prefill) never appear.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch

from pydantic import BaseModel

from app.ai import client as ai_client


class _DummyResponse(BaseModel):
    ok: bool
    text: str


_RESPONSE_PAYLOAD = {"ok": True, "text": "hi"}


def _mk_sdk_response() -> SimpleNamespace:
    block = SimpleNamespace(type="text", text=json.dumps(_RESPONSE_PAYLOAD))
    return SimpleNamespace(content=[block])


def test_call_opus_does_not_send_banned_knobs(monkeypatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")
    ai_client.get_client.cache_clear()

    sent: dict = {}

    class _FakeMessages:
        def create(self, **kwargs):
            sent.update(kwargs)
            return _mk_sdk_response()

    class _FakeClient:
        messages = _FakeMessages()

    with patch.object(ai_client, "Anthropic", return_value=_FakeClient()):
        ai_client.get_client.cache_clear()
        out = ai_client.call_opus(
            system_prompt="you are a test",
            user_content=[{"type": "text", "text": "hello"}],
            response_model=_DummyResponse,
            adaptive_thinking=False,
            effort="high",
            max_tokens=256,
        )

    assert out.ok is True
    assert sent["model"] == "claude-opus-4-7"
    # Banned knobs must not appear.
    for banned in ("temperature", "top_p", "top_k", "budget_tokens"):
        assert banned not in sent, f"{banned} must not be sent to Opus 4.7"
    # Adaptive thinking is only sent when the caller asks for it.
    assert "thinking" not in sent
    # System prompt is cached.
    assert sent["system"][0]["cache_control"] == {"type": "ephemeral"}
    # Structured output via json_schema — API shape is {"type": "json_schema", "schema": {...}}.
    assert sent["output_config"]["format"]["type"] == "json_schema"
    assert "schema" in sent["output_config"]["format"]


def test_call_opus_enables_adaptive_thinking_when_requested(monkeypatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ignored")
    ai_client.get_client.cache_clear()

    sent: dict = {}

    class _FakeMessages:
        def create(self, **kwargs):
            sent.update(kwargs)
            return _mk_sdk_response()

    class _FakeClient:
        messages = _FakeMessages()

    with patch.object(ai_client, "Anthropic", return_value=_FakeClient()):
        ai_client.get_client.cache_clear()
        ai_client.call_opus(
            system_prompt="you are a test",
            user_content=[{"type": "text", "text": "hi"}],
            response_model=_DummyResponse,
            adaptive_thinking=True,
        )

    assert sent["thinking"] == {"type": "adaptive"}
