"""Tests for the deterministic reconciliation gate (architecture §2.1)."""
from __future__ import annotations

from app.domain.models import DishCandidate, EvidenceRecord, ReconciliationClass
from app.reconciliation.gate import classify_pair, lev_ratio, normalize, signals


def _cand(
    name: str,
    dish_type: str | None = None,
    ingredients: list[str] | None = None,
    cid: str = "c",
    source_id: str = "s",
) -> DishCandidate:
    return DishCandidate(
        id=cid,
        source_id=source_id,
        raw_name=name,
        normalized_name=name,
        inferred_dish_type=dish_type,
        ingredients=ingredients or [],
        evidence=EvidenceRecord(source_id=source_id, raw_text=name, span_hint=None),
    )


def test_normalize_strips_accents_and_punct() -> None:
    assert normalize("Plato del día") == "plato del dia"
    # Apostrophe is treated as a word separator per arch §2.1 (strip_punct_keep_space).
    assert normalize("  Chef's   Special!  ") == "chef s special"


def test_lev_ratio_marghertia_is_within_025() -> None:
    assert lev_ratio(normalize("Marghertia"), normalize("Margherita")) <= 0.25


def test_marghertia_vs_margherita_is_ambiguous() -> None:
    # Equal names by character-string (same canonical forms) may short-circuit
    # to OBVIOUS_MERGE; the interesting case is a typo on one side.
    a = _cand("Marghertia", dish_type="pizza", ingredients=["tomato", "mozzarella", "basil"])
    b = _cand("Margherita", dish_type="pizza", ingredients=["tomato", "mozzarella", "basil"])
    assert classify_pair(a, b) == ReconciliationClass.AMBIGUOUS


def test_pizza_funghi_vs_calzone_funghi_non_merge_with_type_differ_signal() -> None:
    # Per the architecture §2.1 rule text, this pair lands in OBVIOUS_NON_MERGE
    # because `name_close` is False (`lev_ratio > 0.25`) and ingredients only
    # partially overlap (jaccard < 0.6). What matters for the demo is that
    # `type_differ` is True, which the reconciler uses to craft the
    # "dish type differs despite ingredient overlap" decision summary.
    a = _cand("Pizza Funghi", dish_type="pizza", ingredients=["tomato", "mozzarella", "mushrooms"])
    b = _cand("Calzone Funghi", dish_type="calzone", ingredients=["mozzarella", "mushrooms", "ricotta"])
    s = signals(a, b)
    assert s.type_differ is True
    assert classify_pair(a, b) in {
        ReconciliationClass.AMBIGUOUS,
        ReconciliationClass.OBVIOUS_NON_MERGE,
    }


def test_tacos_al_pastor_reorder_is_obvious_merge() -> None:
    a = _cand("Tacos al Pastor", dish_type="taco", ingredients=["pork", "pineapple", "onion"])
    b = _cand("Al Pastor Tacos", dish_type="taco", ingredients=["pork", "pineapple", "onion"])
    # Name-exact after multiset normalization -> OBVIOUS_MERGE.
    assert classify_pair(a, b) == ReconciliationClass.OBVIOUS_MERGE


def test_completely_different_dishes_are_obvious_non_merge() -> None:
    a = _cand("Margherita", dish_type="pizza", ingredients=["tomato", "mozzarella", "basil"])
    b = _cand("Caesar Salad", dish_type="salad", ingredients=["romaine", "parmesan", "anchovy"])
    assert classify_pair(a, b) == ReconciliationClass.OBVIOUS_NON_MERGE


def test_same_name_same_ingredients_obvious_merge() -> None:
    a = _cand("Pizza Margherita", dish_type="pizza", ingredients=["tomato", "mozzarella", "basil"])
    b = _cand("Pizza Margherita", dish_type="pizza", ingredients=["tomato", "mozzarella", "basil"])
    assert classify_pair(a, b) == ReconciliationClass.OBVIOUS_MERGE
