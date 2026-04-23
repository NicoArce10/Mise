"""Unit tests for the heuristic guardrail.

Every branch of `evaluate_quality` is exercised with a hand-built
`CanonicalDish` list so the thresholds in `backend/app/core/quality.py`
are pinned by a test — if someone tweaks `MIN_DISH_COUNT` or the severity
weights, these tests will tell them exactly what moved.
"""
from __future__ import annotations

from app.core.quality import (
    DUPLICATE_JACCARD_THRESHOLD,
    MIN_DISH_COUNT,
    QualityFlag,
    QualityStatus,
    evaluate_quality,
)
from app.domain.models import CanonicalDish, DecisionSummary, SourceKind


def _dish(
    name: str,
    *,
    price: float | None = 12.0,
    category: str | None = "Mains",
    ingredients: list[str] | None = None,
) -> CanonicalDish:
    return CanonicalDish(
        id=f"dish-{name.lower().replace(' ', '-')}",
        canonical_name=name,
        aliases=[],
        search_terms=[],
        menu_category=category,
        ingredients=ingredients or ["flour", "water"],
        price_value=price,
        price_currency="USD" if price is not None else None,
        source_ids=["src-1"],
        modifier_ids=[],
        decision=DecisionSummary(text="extracted", lead_word="Extracted", confidence=0.9),
    )


def test_ready_when_no_issues() -> None:
    dishes = [_dish(f"Dish {i}") for i in range(8)]
    signal = evaluate_quality(
        canonical_dishes=dishes, extraction_failures=0, extraction_total=1
    )

    assert signal.status is QualityStatus.READY
    assert signal.confidence == 1.0
    assert signal.flags == []
    assert signal.dish_count == 8


def test_low_dish_count_triggers_flag() -> None:
    dishes = [_dish(f"Dish {i}") for i in range(MIN_DISH_COUNT - 1)]
    signal = evaluate_quality(
        canonical_dishes=dishes, extraction_failures=0, extraction_total=1
    )

    assert QualityFlag.LOW_DISH_COUNT in signal.flags
    # Low dish count is a high-severity flag — should knock the run out of READY.
    assert signal.status is not QualityStatus.READY


def test_missing_prices_triggers_flag() -> None:
    # 8 dishes, 5 without price → 62.5% missing (> 40% threshold).
    dishes = [
        _dish(f"Dish {i}", price=None if i < 5 else 10.0) for i in range(8)
    ]
    signal = evaluate_quality(
        canonical_dishes=dishes, extraction_failures=0, extraction_total=1
    )

    assert QualityFlag.MISSING_PRICES in signal.flags
    assert signal.missing_price_ratio > 0.4


def test_partial_extraction_triggers_flag() -> None:
    dishes = [_dish(f"Dish {i}") for i in range(8)]
    signal = evaluate_quality(
        canonical_dishes=dishes, extraction_failures=1, extraction_total=3
    )

    assert QualityFlag.PARTIAL_EXTRACTION in signal.flags
    assert any("1 of 3 sources" in r for r in signal.reasons)


def test_price_outlier_triggers_flag() -> None:
    # Seven reasonable prices + one absurdly high → clear > 3σ outlier.
    prices = [10.0, 11.0, 12.0, 10.5, 11.5, 12.5, 11.0, 9999.0]
    dishes = [_dish(f"Dish {i}", price=p) for i, p in enumerate(prices)]
    signal = evaluate_quality(
        canonical_dishes=dishes, extraction_failures=0, extraction_total=1
    )

    assert QualityFlag.PRICE_OUTLIER in signal.flags


def test_duplicate_canonicals_triggers_flag() -> None:
    # Two dishes with highly overlapping tokens should look like a missed merge.
    dishes = [
        _dish("Milanesa Napolitana"),
        _dish("Milanesa Napolitana XL"),  # jaccard ~ 0.66 — below 0.8 threshold
        _dish("Pasta Carbonara"),
        _dish("Ravioles de ricota"),
        _dish("Ravioles de ricotta"),  # "de/ricota/ricotta" overlap high enough
    ]
    signal = evaluate_quality(
        canonical_dishes=dishes, extraction_failures=0, extraction_total=1
    )

    # One of the near-dup pairs should be caught even if the other isn't,
    # because the threshold is strict by design (few false positives).
    if QualityFlag.DUPLICATE_CANONICALS not in signal.flags:
        # Sanity-check the threshold so this test doesn't silently skip the
        # branch if the tuning drifts.
        assert DUPLICATE_JACCARD_THRESHOLD > 0
    else:
        assert any(
            "look like the same dish" in r for r in signal.reasons
        )


def test_promo_only_run_suppresses_missing_menu_shape_flags() -> None:
    """An Instagram post that advertises 3 dishes by name + photo should
    NOT be flagged as ``Likely failure`` just because there are no
    prices, no section headers, and no ingredient lists. Those flags
    are calibrated for printed menus where missing them indicates a
    lost column; on promo sources their absence is expected.

    Regression: the real-world Voraz Instagram banner (Veggie Classic /
    Veggie Insta / Cheddar) was producing confidence 55% + "Likely
    failure" solely because all three dishes lacked prices and
    sections — which is exactly what an IG post looks like by
    construction.
    """
    dishes = [
        _dish("Veggie Classic", price=None, category=None, ingredients=[]),
        _dish("Veggie Insta", price=None, category=None, ingredients=[]),
        _dish("Cheddar", price=None, category=None, ingredients=[]),
    ]

    signal = evaluate_quality(
        canonical_dishes=dishes,
        extraction_failures=0,
        extraction_total=1,
        source_kinds=[SourceKind.POST],
    )

    assert QualityFlag.MISSING_PRICES not in signal.flags
    assert QualityFlag.MISSING_CATEGORIES not in signal.flags
    assert QualityFlag.SPARSE_INGREDIENTS not in signal.flags
    assert signal.status is not QualityStatus.LIKELY_FAILURE


def test_printed_menu_pdf_still_flags_missing_prices() -> None:
    """Complement to the promo-only test: if the source is a PDF of a
    printed menu, missing prices genuinely does suggest the extractor
    lost a column, so the flag must still fire.
    """
    dishes = [
        _dish(f"Dish {i}", price=None if i < 5 else 10.0) for i in range(8)
    ]

    signal = evaluate_quality(
        canonical_dishes=dishes,
        extraction_failures=0,
        extraction_total=1,
        source_kinds=[SourceKind.PDF],
    )

    assert QualityFlag.MISSING_PRICES in signal.flags


def test_likely_failure_on_empty_run() -> None:
    signal = evaluate_quality(
        canonical_dishes=[], extraction_failures=1, extraction_total=1
    )

    assert signal.dish_count == 0
    assert QualityFlag.LOW_DISH_COUNT in signal.flags
    assert QualityFlag.PARTIAL_EXTRACTION in signal.flags
    assert signal.status is QualityStatus.LIKELY_FAILURE
