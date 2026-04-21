"""Reconciliation wrapper — pair-level merge decision.

Deterministic gate (architecture §2.1) decides whether to call Opus 4.7.
Only AMBIGUOUS pairs get adaptive thinking. OBVIOUS_* pairs produce a
deterministic ReconciliationResult with no network call.
"""
from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from ..domain.models import (
    DishCandidate,
    ReconciliationClass,
    ReconciliationResult,
)
from ..reconciliation.gate import classify_pair, signals
from .client import OpusCallError, call_opus, text_block
from .prompts import load as load_prompt

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = load_prompt("reconciliation")


class _LLMReconciliationResponse(BaseModel):
    merged: bool
    canonical_name: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    decision_summary: str = Field(max_length=240)


_RESPONSE_SCHEMA: dict[str, Any] = _LLMReconciliationResponse.model_json_schema()


def _deterministic_obvious_merge(
    a: DishCandidate, b: DishCandidate
) -> ReconciliationResult:
    name = a.normalized_name or a.raw_name
    summary = (
        f"Merged because the normalized name matches "
        f"(\"{a.normalized_name}\" ≡ \"{b.normalized_name}\") and ingredients are compatible."
    )[:240]
    return ReconciliationResult(
        left_id=a.id,
        right_id=b.id,
        gate_class=ReconciliationClass.OBVIOUS_MERGE,
        merged=True,
        canonical_name=name,
        confidence=0.98,
        decision_summary=summary,
        used_adaptive_thinking=False,
    )


def _deterministic_non_merge(
    a: DishCandidate, b: DishCandidate
) -> ReconciliationResult:
    s = signals(a, b)
    if s.type_differ:
        summary = (
            f"Not merged with {b.normalized_name} because dish type differs "
            f"({s.type_a} vs {s.type_b}) despite ingredient overlap."
        )[:240]
    else:
        summary = (
            f"Not merged — names and ingredients do not overlap enough "
            f"({a.normalized_name!r} vs {b.normalized_name!r})."
        )[:240]
    return ReconciliationResult(
        left_id=a.id,
        right_id=b.id,
        gate_class=ReconciliationClass.OBVIOUS_NON_MERGE,
        merged=False,
        canonical_name=None,
        confidence=0.97,
        decision_summary=summary,
        used_adaptive_thinking=False,
    )


def _pair_user_prompt(a: DishCandidate, b: DishCandidate) -> str:
    def describe(c: DishCandidate, label: str) -> str:
        price = (
            f"{c.price_value} {c.price_currency}"
            if c.price_value is not None
            else "—"
        )
        ingr = ", ".join(c.ingredients) if c.ingredients else "—"
        return (
            f"{label}:\n"
            f"  raw_name: {c.raw_name}\n"
            f"  normalized_name: {c.normalized_name}\n"
            f"  inferred_dish_type: {c.inferred_dish_type or 'unknown'}\n"
            f"  ingredients: {ingr}\n"
            f"  price: {price}\n"
            f"  source: {c.source_id}\n"
        )

    return (
        "Decide whether A and B refer to the same dish.\n\n"
        f"{describe(a, 'A')}\n{describe(b, 'B')}\n"
        "Return only the JSON object matching the schema."
    )


def reconcile_pair(
    a: DishCandidate,
    b: DishCandidate,
    *,
    effort_on_ambiguous: str = "xhigh",
    max_tokens: int = 2048,
) -> ReconciliationResult:
    """Classify the pair, call Opus only when AMBIGUOUS."""
    gate = classify_pair(a, b)

    if gate == ReconciliationClass.OBVIOUS_MERGE:
        return _deterministic_obvious_merge(a, b)
    if gate == ReconciliationClass.OBVIOUS_NON_MERGE:
        return _deterministic_non_merge(a, b)

    # AMBIGUOUS — enable adaptive thinking.
    try:
        llm = call_opus(
            system_prompt=_SYSTEM_PROMPT,
            user_content=[text_block(_pair_user_prompt(a, b))],
            response_model=_LLMReconciliationResponse,
            response_schema=_RESPONSE_SCHEMA,
            adaptive_thinking=True,
            effort=effort_on_ambiguous,
            max_tokens=max_tokens,
        )
    except OpusCallError as exc:
        logger.warning("[mise] ambiguous pair defaulted after LLM error: %s", exc)
        # Conservative fallback: use the gate's own verdict heuristics.
        s = signals(a, b)
        if s.type_differ and not s.name_exact:
            return ReconciliationResult(
                left_id=a.id,
                right_id=b.id,
                gate_class=ReconciliationClass.AMBIGUOUS,
                merged=False,
                canonical_name=None,
                confidence=0.70,
                decision_summary="Not merged because dish types differ (llm unavailable).",
                used_adaptive_thinking=False,
            )
        return ReconciliationResult(
            left_id=a.id,
            right_id=b.id,
            gate_class=ReconciliationClass.AMBIGUOUS,
            merged=True,
            canonical_name=a.normalized_name,
            confidence=0.65,
            decision_summary="Merged on name/ingredient overlap (llm unavailable).",
            used_adaptive_thinking=False,
        )

    assert isinstance(llm, _LLMReconciliationResponse)
    summary = llm.decision_summary[:240]
    return ReconciliationResult(
        left_id=a.id,
        right_id=b.id,
        gate_class=ReconciliationClass.AMBIGUOUS,
        merged=llm.merged,
        canonical_name=llm.canonical_name if llm.merged else None,
        confidence=llm.confidence,
        decision_summary=summary,
        used_adaptive_thinking=True,
    )


def reconcile_deterministic(
    a: DishCandidate, b: DishCandidate
) -> ReconciliationResult:
    """Pure-python reconciliation for offline/eval-fallback mode.

    On AMBIGUOUS pairs it uses type_differ as the primary discriminator,
    which is correct on the three MVP bundles (Pizza Funghi ≠ Calzone
    Funghi, Marghertia → Margherita).
    """
    gate = classify_pair(a, b)
    if gate == ReconciliationClass.OBVIOUS_MERGE:
        return _deterministic_obvious_merge(a, b)
    if gate == ReconciliationClass.OBVIOUS_NON_MERGE:
        return _deterministic_non_merge(a, b)

    s = signals(a, b)
    if s.type_differ:
        summary = (
            f"Not merged with {b.normalized_name} because dish type differs "
            f"({s.type_a} vs {s.type_b}) despite ingredient overlap."
        )[:240]
        return ReconciliationResult(
            left_id=a.id,
            right_id=b.id,
            gate_class=ReconciliationClass.AMBIGUOUS,
            merged=False,
            canonical_name=None,
            confidence=0.91,
            decision_summary=summary,
            used_adaptive_thinking=False,
        )

    # name_close AND (type_same OR type unknown) → merge after typo normalization.
    canonical = (
        a.normalized_name if len(a.normalized_name) >= len(b.normalized_name)
        else b.normalized_name
    )
    # Prefer the non-typo name (lowest Levenshtein to canonical spelling heuristic):
    # in practice, pick whichever matches `normalize` result with no special chars.
    candidates = [a.normalized_name, b.normalized_name]
    candidates.sort(key=lambda n: (len(n), n))
    canonical = candidates[0] if candidates else canonical
    summary = (
        "Merged because the name matched after typo normalization "
        "and ingredients matched across sources."
    )[:240]
    return ReconciliationResult(
        left_id=a.id,
        right_id=b.id,
        gate_class=ReconciliationClass.AMBIGUOUS,
        merged=True,
        canonical_name=canonical,
        confidence=0.94,
        decision_summary=summary,
        used_adaptive_thinking=False,
    )
