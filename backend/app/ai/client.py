"""Thin Anthropic Messages-API wrapper scoped to Mise's hard rules.

Enforces the Opus 4.7 API shape (see `AGENTS.md`):
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
from pathlib import Path
from typing import Any

from anthropic import (
    Anthropic,
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    InternalServerError,
    RateLimitError,
)
from pydantic import BaseModel, ValidationError

from ..core.config import settings

logger = logging.getLogger(__name__)

MODEL_ID = "claude-opus-4-7"

# Anthropic's 5xx and 429 are transient. The SDK already retries with
# exponential backoff; we bump `max_retries` above the default (2) and
# wrap the call with our own guardrail so a single bad minute on the
# API doesn't nuke a live demo upload.
_SDK_MAX_RETRIES = 5
_SDK_TIMEOUT_S = 180.0


class OpusCallError(RuntimeError):
    """Raised when a call fails validation twice or the SDK surfaces a fatal error."""


class OpusTransientError(OpusCallError):
    """Raised when every retry layer exhausted on a 5xx / 429 / network hiccup.

    Callers should treat this as a retry-later signal, not a bug in our
    code. The user-facing message should read "the model API is having a
    moment, try again" — never a generic 500.
    """


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
    return Anthropic(
        api_key=api_key,
        max_retries=_SDK_MAX_RETRIES,
        timeout=_SDK_TIMEOUT_S,
    )


def _harden_schema_for_opus(schema: dict[str, Any]) -> dict[str, Any]:
    """Opus 4.7 json_schema requires `additionalProperties: false` on every
    object-typed schema (including nested `$defs`). Also strip Pydantic-only
    keys the API rejects. Mutates-a-copy and returns it.
    """
    import copy

    hardened = copy.deepcopy(schema)

    # Keys Opus 4.7's json_schema mode rejects on specific types.
    _REJECTED_NUMBER = {"minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"}
    _REJECTED_STRING = {"minLength", "maxLength", "pattern", "format"}
    _REJECTED_ARRAY = {"minItems", "maxItems", "uniqueItems"}

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            t = node.get("type")
            if t == "object":
                node.setdefault("additionalProperties", False)
            if t == "number" or t == "integer":
                for k in list(node.keys()):
                    if k in _REJECTED_NUMBER:
                        node.pop(k, None)
            if t == "string":
                for k in list(node.keys()):
                    if k in _REJECTED_STRING:
                        node.pop(k, None)
            if t == "array":
                for k in list(node.keys()):
                    if k in _REJECTED_ARRAY:
                        node.pop(k, None)
            node.pop("title", None)
            node.pop("default", None)
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(hardened)
    return hardened


def _build_system(system_prompt: str) -> list[dict[str, Any]]:
    """System prompt as a cached text block."""
    return [
        {
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"},
        }
    ]


def _sniff_media_type(data: bytes, declared: str) -> str:
    """Detect media type from the first bytes (magic) when the caller's
    declared type is a raster image. File extensions lie — a `.png` that
    is actually JPEG will be 400-rejected by the API. PDF is trusted on
    the declared type because PDF magic is longer-tailed.
    """
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return declared


def image_block(data: bytes, media_type: str) -> dict[str, Any]:
    """Base64 content block — picks `image` or `document` by media_type.

    Anthropic's Messages API accepts PDFs as `type: "document"`; raster
    images (`image/jpeg|png|gif|webp`) go as `type: "image"`. Both are
    vision-native on Opus 4.7, so the extraction prompt does not need to
    branch on which kind of evidence it receives.

    The media_type is sniffed from the bytes for raster images — file
    extensions cannot be trusted (users upload `.png` files that carry
    JPEG payloads; the API rejects mismatches with HTTP 400).
    """
    encoded = base64.standard_b64encode(data).decode("ascii")
    if media_type == "application/pdf":
        return {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": encoded,
            },
        }
    effective = _sniff_media_type(data, media_type)
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": effective,
            "data": encoded,
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
                "schema": response_schema,
            },
        },
    }
    if adaptive_thinking:
        kwargs["thinking"] = {"type": "adaptive"}
    return kwargs


def _maybe_log_raw(response: Any, model_name: str) -> None:
    """Append the raw SDK response to `MISE_RAW_LOG_PATH` if the env var is set.

    Enabled by the eval harness when running a canary so the raw response
    from Opus 4.7 is captured as evidence (usage counts, cache-read tokens,
    content blocks). Silent no-op otherwise.
    """
    raw_path = os.environ.get("MISE_RAW_LOG_PATH")
    if not raw_path:
        return
    try:
        usage = getattr(response, "usage", None)
        content_blocks: list[dict[str, Any]] = []
        for block in getattr(response, "content", None) or []:
            if isinstance(block, dict):
                btype = block.get("type")
                btext = block.get("text")
            else:
                btype = getattr(block, "type", None)
                btext = getattr(block, "text", None)
            content_blocks.append({"type": btype, "text": btext})
        entry = {
            "response_model": model_name,
            "stop_reason": getattr(response, "stop_reason", None),
            "model": getattr(response, "model", None),
            "id": getattr(response, "id", None),
            "usage": (
                {
                    "input_tokens": getattr(usage, "input_tokens", None),
                    "output_tokens": getattr(usage, "output_tokens", None),
                    "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", None),
                    "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", None),
                }
                if usage is not None
                else None
            ),
            "content": content_blocks,
        }
        Path(raw_path).parent.mkdir(parents=True, exist_ok=True)
        with Path(raw_path).open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as exc:
        logger.warning("[mise] raw log append failed: %s", exc)


def _parse_json_from_response(response: Any) -> dict[str, Any]:
    """Extract the first text block's JSON payload from a Messages response.

    Accepts both SDK objects (with `.type`/`.text` attrs) and raw dicts.
    Logs a prominent warning when the response was cut off by `max_tokens`
    so the crash is diagnosable — a truncated JSON looks like a cryptic
    `Unterminated string` error otherwise.
    """
    stop_reason = getattr(response, "stop_reason", None)
    if stop_reason == "max_tokens":
        logger.warning(
            "[mise] opus response was truncated by max_tokens — the JSON will "
            "likely fail to parse. Raise `max_tokens` on the call site or "
            "split the input."
        )

    for block in getattr(response, "content", None) or []:
        if isinstance(block, dict):
            btype = block.get("type")
            btext = block.get("text")
        else:
            btype = getattr(block, "type", None)
            btext = getattr(block, "text", None)
        if btype == "text" and btext:
            try:
                return json.loads(btext)
            except json.JSONDecodeError as exc:
                if stop_reason == "max_tokens":
                    raise OpusCallError(
                        f"Opus response truncated by max_tokens — "
                        f"response length {len(btext)} chars. Raise max_tokens."
                    ) from exc
                raise
    raise OpusCallError("Opus response had no text block")


def call_opus(
    *,
    system_prompt: str,
    user_content: list[dict[str, Any]],
    response_model: type[BaseModel],
    response_schema: dict[str, Any] | None = None,
    fallback_response_model: type[BaseModel] | None = None,
    fallback_response_schema: dict[str, Any] | None = None,
    adaptive_thinking: bool = False,
    effort: str = "high",
    max_tokens: int = 16384,
) -> BaseModel:
    """Call Opus 4.7 and parse the response into `response_model`.

    Retry layers, outer → inner:

    1. We own an outer retry loop (2 extra attempts with jitter) for transient
       5xx / 429 / network errors that escape the SDK's own retry budget.
    2. The SDK retries 5xx / 429 up to `_SDK_MAX_RETRIES` times internally
       with exponential backoff.
    3. On `ValidationError` we do one strict-mode retry with a tightened
       system prompt before surfacing `OpusCallError`.
    4. On "Grammar compilation timed out" (retryable 400), after
       `_GRAMMAR_FALLBACK_AFTER` failures we swap the primary schema for
       `fallback_response_schema` (a smaller shape). The response is
       validated against `fallback_response_model` — callers that opt into
       this must treat both possible return types uniformly. This is the
       single most important resilience knob for the demo: the primary
       schema can time-out on Anthropic's side for reasons outside our
       control, and shipping a minimal-but-correct catalog beats shipping
       an error screen.

    Transient failures raise `OpusTransientError`; validation failures and
    unrecoverable SDK errors raise `OpusCallError`.
    """
    import random
    import time as _time

    raw_schema = response_schema or response_model.model_json_schema()
    primary_schema = _harden_schema_for_opus(raw_schema)
    fallback_schema = None
    if fallback_response_schema is not None:
        fallback_schema = _harden_schema_for_opus(fallback_response_schema)
    elif fallback_response_model is not None:
        fallback_schema = _harden_schema_for_opus(fallback_response_model.model_json_schema())
    client = get_client()

    # State shared across retries. The stages of recovery from a
    # grammar-compiler saturation are, in order:
    #   0. Primary schema + adaptive thinking / full effort (as requested).
    #   1. Minimal schema (swapped on the FIRST grammar-compile 400 — we
    #      used to wait for the second, but in practice the compiler is
    #      already hot by then and all subsequent primary calls fail too).
    #   2. Minimal schema + effort="low" (shrinks output tokens and the
    #      grammar the compiler has to produce).
    #   3. No json_schema at all: prompt-only JSON, parsed and coerced
    #      into the minimal model. Last-resort rescue so we still ship a
    #      catalog when the grammar pool is entirely blocked.
    active: dict[str, Any] = {
        "schema": primary_schema,
        "model": response_model,
        "stage": 0,  # 0=primary, 1=minimal, 2=minimal+low, 3=no-schema
        "effort": effort,
    }

    def _once(extra_system: str = "") -> BaseModel:
        prompt = system_prompt + ("\n\n" + extra_system if extra_system else "")
        stage = int(active["stage"])
        current_model: type[BaseModel] = active["model"]
        if stage >= 3:
            # No json_schema — ask for JSON with a tight prompt. The model
            # still emits well-formed JSON; we parse, then validate against
            # the minimal model (or primary if no fallback was provided).
            no_schema_kwargs: dict[str, Any] = {
                "model": MODEL_ID,
                "max_tokens": max_tokens,
                "system": _build_system(
                    prompt
                    + "\n\nRESCUE MODE: structured outputs unavailable. "
                    "Emit a single JSON object with a `candidates` array. "
                    "Each candidate must have `raw_name` and `normalized_name` "
                    "(strings) and may have `price_value` (number or null), "
                    "`price_currency` (string or null), `aliases` (string[]), "
                    "`search_terms` (string[]). No preface, no trailing text."
                ),
                "messages": [{"role": "user", "content": user_content}],
                "output_config": {"effort": "low"},
            }
            response = client.messages.create(**no_schema_kwargs)
        else:
            kwargs = _request_kwargs(
                system_prompt=prompt,
                user_content=user_content,
                response_schema=active["schema"],
                adaptive_thinking=adaptive_thinking and stage == 0,
                effort=str(active["effort"]),
                max_tokens=max_tokens,
            )
            response = client.messages.create(**kwargs)
        _maybe_log_raw(response, current_model.__name__)
        payload = _parse_json_from_response(response)
        return current_model.model_validate(payload)

    def _call_with_validation_retry() -> BaseModel:
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

    # Some 400-class errors from Anthropic are technically invalid_request
    # but are in practice transient — the server-side compiler/pipeline
    # timed out or hit an internal limit. We retry those with backoff
    # rather than surface them as hard "your file is broken" failures.
    #
    # "Grammar compilation timed out" fires when the structured-outputs
    # json_schema compiler is under load (typically: several parallel
    # calls with the same complex schema). Retrying after a short pause
    # almost always succeeds.
    _RETRYABLE_400_SUBSTRINGS = (
        "grammar compilation timed out",
        "overloaded",
        "please try again",
    )

    def _is_retryable_400(exc: APIStatusError) -> bool:
        if exc.status_code != 400:
            return False
        msg = (str(exc.message) if exc.message else str(exc)).lower()
        return any(s in msg for s in _RETRYABLE_400_SUBSTRINGS)

    last_transient: Exception | None = None

    def _advance_stage(reason: str) -> None:
        """Move to the next recovery stage and log the transition."""
        stage = int(active["stage"])
        if stage == 0 and fallback_schema is not None:
            active["stage"] = 1
            active["schema"] = fallback_schema
            active["model"] = fallback_response_model or response_model
            logger.warning("[mise] escalation stage 0→1 (minimal schema): %s", reason)
            return
        if stage <= 1:
            active["stage"] = 2
            active["effort"] = "low"
            # Make sure a minimal schema is active if it exists.
            if fallback_schema is not None:
                active["schema"] = fallback_schema
                active["model"] = fallback_response_model or response_model
            logger.warning("[mise] escalation stage →2 (minimal + effort=low): %s", reason)
            return
        if stage == 2:
            active["stage"] = 3
            # Keep the minimal model for validation; no_schema mode emits
            # JSON that matches that shape.
            if fallback_response_model is not None:
                active["model"] = fallback_response_model
            logger.warning("[mise] escalation stage 2→3 (no json_schema rescue): %s", reason)
            return

    # Total attempts: 6. Stage transitions happen on grammar-compile
    # timeouts; plain 5xx only bump the attempt counter.
    for attempt in range(6):
        try:
            return _call_with_validation_retry()
        except (
            InternalServerError,
            APITimeoutError,
            APIConnectionError,
            RateLimitError,
        ) as exc:
            last_transient = exc
            logger.warning(
                "[mise] opus transient error on attempt %d/6 (%s, stage=%s): %s",
                attempt + 1,
                type(exc).__name__,
                active["stage"],
                exc,
            )
            if attempt == 5:
                break
            sleep_s = min(2.0 + 2.0 * attempt + random.random() * 1.5, 12.0)
            _time.sleep(sleep_s)
        except APIStatusError as exc:
            if _is_retryable_400(exc):
                last_transient = exc
                logger.warning(
                    "[mise] opus retryable 400 on attempt %d/6 (stage=%s): %s",
                    attempt + 1,
                    active["stage"],
                    exc.message or exc,
                )
                # Advance one stage on EVERY grammar-compile timeout.
                # Empirically the compiler pool does not recover fast
                # enough for backoff alone — we have to shrink the grammar
                # (or drop it entirely) to make progress.
                _advance_stage(f"retryable 400 on attempt {attempt + 1}")
                if attempt == 5:
                    break
                # Grammar-compiler saturation benefits from a longer backoff
                # than a plain 5xx — it means the whole grammar pool is hot,
                # not just this one request.
                sleep_s = min(4.0 + 3.0 * attempt + random.random() * 2.0, 20.0)
                _time.sleep(sleep_s)
                continue
            # Other 400/401/403/413/etc. are real user-input problems —
            # surface immediately so the UI shows the real cause.
            raise OpusCallError(
                f"Anthropic API status {exc.status_code}: {exc.message or exc}"
            ) from exc

    assert last_transient is not None
    raise OpusTransientError(
        f"Anthropic API unavailable after {_SDK_MAX_RETRIES + 6} attempts "
        f"({type(last_transient).__name__}: {last_transient})"
    ) from last_transient
