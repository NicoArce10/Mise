"""Thin Anthropic Messages-API wrapper scoped to Mise's hard rules.

Enforces the API shape frozen in `docs/plans/2026-04-22-architecture.md` §0:
- Model: `claude-opus-4-7`, no fallback.
- Thinking: `{"type": "adaptive"}` or absent. Never `{"type": "enabled"}` and
  never `budget_tokens`.
- Cost: controlled with `output_config.effort`.
- Never sends `temperature`, `top_p`, `top_k`, or last-assistant prefills.
- Structured output via `output_config.format = {type: "json_schema", ...}`.
- System prompts get `cache_control={"type": "ephemeral"}` so repeated eval
  runs reuse the cache.
"""
from __future__ import annotations

import base64
import json
import logging
import os
from functools import lru_cache
from typing import Any

from anthropic import Anthropic
from pydantic import BaseModel, ValidationError

from ..core.config import settings

logger = logging.getLogger(__name__)

MODEL_ID = "claude-opus-4-7"


class OpusCallError(RuntimeError):
    """Raised when a call fails validation twice or the SDK surfaces an error."""


@lru_cache(maxsize=1)
def get_client() -> Anthropic:
    """Lazy singleton so tests can import without an API key."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise OpusCallError("ANTHROPIC_API_KEY is not set")
    configured_model = getattr(settings, "anthropic_model", MODEL_ID)
    if configured_model != MODEL_ID:
        # Non-negotiable per CLAUDE.md: no fallback to a weaker model.
        raise OpusCallError(
            f"ANTHROPIC_MODEL must be '{MODEL_ID}', got '{configured_model}'"
        )
    return Anthropic(api_key=api_key)


def _build_system(system_prompt: str) -> list[dict[str, Any]]:
    """System prompt as a cached text block."""
    return [
        {
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"},
        }
    ]


def image_block(data: bytes, media_type: str) -> dict[str, Any]:
    """Base64-encoded image content block. Works for PDFs on 4.7 too."""
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": base64.standard_b64encode(data).decode("ascii"),
        },
    }


def text_block(text: str) -> dict[str, Any]:
    return {"type": "text", "text": text}


def _request_kwargs(
    *,
    system_prompt: str,
    user_content: list[dict[str, Any]],
    response_schema: dict[str, Any],
    adaptive_thinking: bool,
    effort: str,
    max_tokens: int,
) -> dict[str, Any]:
    """Build kwargs for `client.messages.parse` / `.create`.

    Guardrails: never include `temperature`, `top_p`, `top_k`, `budget_tokens`.
    """
    kwargs: dict[str, Any] = {
        "model": MODEL_ID,
        "max_tokens": max_tokens,
        "system": _build_system(system_prompt),
        "messages": [
            {
                "role": "user",
                "content": user_content,
            }
        ],
        "output_config": {
            "effort": effort,
            "format": {
                "type": "json_schema",
                "json_schema": response_schema,
            },
        },
    }
    if adaptive_thinking:
        kwargs["thinking"] = {"type": "adaptive"}
    return kwargs


def _parse_json_from_response(response: Any) -> dict[str, Any]:
    """Extract the first text block's JSON payload from a Messages response.

    Accepts both SDK objects (with `.type`/`.text` attrs) and raw dicts.
    """
    for block in getattr(response, "content", None) or []:
        if isinstance(block, dict):
            btype = block.get("type")
            btext = block.get("text")
        else:
            btype = getattr(block, "type", None)
            btext = getattr(block, "text", None)
        if btype == "text" and btext:
            return json.loads(btext)
    raise OpusCallError("Opus response had no text block")


def call_opus(
    *,
    system_prompt: str,
    user_content: list[dict[str, Any]],
    response_model: type[BaseModel],
    response_schema: dict[str, Any] | None = None,
    adaptive_thinking: bool = False,
    effort: str = "high",
    max_tokens: int = 4096,
) -> BaseModel:
    """Call Opus 4.7 and parse the response into `response_model`.

    On `ValidationError` a single deterministic retry is attempted with a
    tightened system prompt. A second failure raises `OpusCallError`.
    """
    schema = response_schema or response_model.model_json_schema()
    client = get_client()

    def _once(extra_system: str = "") -> BaseModel:
        prompt = system_prompt + ("\n\n" + extra_system if extra_system else "")
        kwargs = _request_kwargs(
            system_prompt=prompt,
            user_content=user_content,
            response_schema=schema,
            adaptive_thinking=adaptive_thinking,
            effort=effort,
            max_tokens=max_tokens,
        )
        response = client.messages.create(**kwargs)
        payload = _parse_json_from_response(response)
        return response_model.model_validate(payload)

    try:
        return _once()
    except ValidationError as exc:
        logger.warning("[mise] opus response failed validation, retrying: %s", exc)
        tightened = (
            "STRICT MODE: your previous response failed JSON-schema validation. "
            "Return ONLY a valid JSON object matching the requested schema. "
            "No preface, no trailing text, no explanations."
        )
        try:
            return _once(tightened)
        except ValidationError as exc2:
            raise OpusCallError(f"validation failed twice: {exc2}") from exc2
