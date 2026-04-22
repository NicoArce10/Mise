"""Every ReconciliationResult from the real pipeline must carry the
display fields (`left_name`, `right_name`, `left_source_id`,
`right_source_id`).

Before this fix, only the fixture cockpit set them, so the live
Cockpit rendered "Candidate A from —" on actual runs — a visible
regression that made the reconciliation layer look broken even when
it was working correctly under the hood.

The fields are presentation-only. They are mirrors of the candidate
metadata that the comparison was performed on, but having them on the
result object (instead of requiring a second lookup in the UI) keeps
the frontend dumb and avoids a class of "which candidate did this
summary come from again?" bugs.
"""
from __future__ import annotations

from app.ai.reconciliation import reconcile_deterministic
from app.domain.models import DishCandidate, EvidenceRecord


def _cand(
    cid: str,
    source_id: str,
    raw: str,
    normalized: str | None = None,
    dish_type: str | None = None,
    ingredients: list[str] | None = None,
) -> DishCandidate:
    return DishCandidate(
        id=cid,
        source_id=source_id,
        raw_name=raw,
        normalized_name=normalized or raw,
        inferred_dish_type=dish_type,
        ingredients=ingredients or [],
        evidence=EvidenceRecord(source_id=source_id, raw_text=raw),
    )


def test_obvious_merge_populates_display_fields() -> None:
    """Same normalized name + compatible ingredients → OBVIOUS_MERGE.
    The result must carry both candidate names and both source ids."""
    a = _cand(
        "a", "src-pdf", "Margherita",
        dish_type="pizza", ingredients=["tomato", "mozzarella", "basil"],
    )
    b = _cand(
        "b", "src-chalkboard", "Margherita",
        dish_type="pizza", ingredients=["tomato", "mozzarella", "basil"],
    )

    r = reconcile_deterministic(a, b)

    assert r.merged is True
    assert r.left_name == "Margherita"
    assert r.right_name == "Margherita"
    assert r.left_source_id == "src-pdf"
    assert r.right_source_id == "src-chalkboard"


def test_obvious_non_merge_populates_display_fields() -> None:
    """Different dish types → OBVIOUS_NON_MERGE. Still must carry
    display fields so the Cockpit can render the side-by-side card."""
    a = _cand("a", "src-pdf", "Pizza Funghi", dish_type="pizza")
    b = _cand("b", "src-pdf", "Coca-Cola", dish_type="drink")

    r = reconcile_deterministic(a, b)

    assert r.merged is False
    assert r.left_name == "Pizza Funghi"
    assert r.right_name == "Coca-Cola"
    assert r.left_source_id == "src-pdf"
    assert r.right_source_id == "src-pdf"


def test_ambiguous_type_differ_populates_display_fields() -> None:
    """AMBIGUOUS with type differ (Pizza vs Calzone) — the deterministic
    reconciler keeps them separate. Display fields must still flow."""
    a = _cand(
        "a", "src-pdf", "Pizza ai Funghi",
        dish_type="pizza", ingredients=["mushrooms", "mozzarella"],
    )
    b = _cand(
        "b", "src-photo", "Calzone ai Funghi",
        dish_type="calzone", ingredients=["mushrooms", "mozzarella"],
    )

    r = reconcile_deterministic(a, b)

    # Ambiguous may resolve either direction depending on the heuristic;
    # what we lock in here is that the display fields show up regardless.
    assert r.left_name == "Pizza ai Funghi"
    assert r.right_name == "Calzone ai Funghi"
    assert r.left_source_id == "src-pdf"
    assert r.right_source_id == "src-photo"


def test_ambiguous_typo_merge_populates_display_fields() -> None:
    """AMBIGUOUS with near-duplicate names (Marghertia vs Margherita) —
    deterministic reconciler merges after typo normalization."""
    a = _cand(
        "a", "src-pdf", "Marghertia",
        dish_type="pizza", ingredients=["tomato", "mozzarella", "basil"],
    )
    b = _cand(
        "b", "src-chalk", "Margherita",
        dish_type="pizza", ingredients=["tomato", "mozzarella", "basil"],
    )

    r = reconcile_deterministic(a, b)

    assert r.left_name == "Marghertia"
    assert r.right_name == "Margherita"
    assert r.left_source_id == "src-pdf"
    assert r.right_source_id == "src-chalk"
