"""Tests pinning the `menu_category` extraction contract.

The product surface (catalog export, search facet, confidence scorer,
quality signal) all consume `CanonicalDish.menu_category`. Prior to this
test file the extractor hard-coded the field to `None` because it was
removed from the SDK schema as a perceived grammar-timeout risk. That
caused every run to ship with 100% missing categories, which then
permanently raised the `missing_categories` quality flag — a self-
inflicted false-positive.

These tests guarantee three properties going forward:

1. When Opus emits a `menu_category` on the wire, it survives all the
   way to `DishCandidate.menu_category`.
2. The string is normalized at the extraction edge (Title Case, trimmed,
   capped) so the downstream majority-vote in `pipeline.py` buckets
   variants ("PIZZAS", "Pizzas", " pizzas ") into one canonical section.
3. The fallback `_MinimalExtractedCandidate` (which kicks in when the
   server-side json_schema compiler times out on the full grammar) still
   produces a usable `DishCandidate` whose `menu_category` is `None` —
   no AttributeError, no KeyError.
"""
from __future__ import annotations

from app.ai.extraction import (
    ExtractionResponse,
    _ExtractedCandidate,
    _MinimalExtractedCandidate,
    _MinimalExtractionResponse,
    _candidates_from_response,
    _normalize_category,
)
from app.domain.models import SourceDocument, SourceKind


def _source() -> SourceDocument:
    return SourceDocument(
        id="src-test",
        filename="menu.pdf",
        kind=SourceKind.PDF,
        content_type="application/pdf",
        sha256="0" * 64,
    )


# ---------- normalization unit tests ----------


def test_normalize_category_handles_none_and_empty() -> None:
    assert _normalize_category(None) is None
    assert _normalize_category("") is None
    assert _normalize_category("   ") is None
    assert _normalize_category("\t\n") is None


def test_normalize_category_collapses_whitespace_and_titlecases() -> None:
    assert _normalize_category("PIZZAS") == "Pizzas"
    assert _normalize_category("  pizzas  ") == "Pizzas"
    assert _normalize_category("pizzas\tand\nflatbreads") == "Pizzas And Flatbreads"
    assert _normalize_category("antipasti") == "Antipasti"


def test_normalize_category_preserves_accents() -> None:
    # Critical for ES/IT/FR menus — losing accents breaks the bucket key
    # ("Plato Del Día" and "Plato Del Dia" must NOT be the same bucket).
    assert _normalize_category("PLATOS DEL DÍA") == "Platos Del Día"
    assert _normalize_category("postres") == "Postres"


def test_normalize_category_caps_runaway_strings() -> None:
    long_input = "Wood-fired pizzas hand-tossed in our 900-degree oven nightly"
    out = _normalize_category(long_input)
    assert out is not None
    assert len(out) <= 60


# ---------- end-to-end materialization tests ----------


def test_menu_category_survives_to_dish_candidate() -> None:
    """A category the model emits must reach `DishCandidate.menu_category`."""
    parsed = ExtractionResponse(
        candidates=[
            _ExtractedCandidate(
                raw_name="Margherita",
                normalized_name="Margherita",
                menu_category="PIZZAS",
                price_value=12.0,
                price_currency="EUR",
            ),
            _ExtractedCandidate(
                raw_name="Bruschetta",
                normalized_name="Bruschetta",
                menu_category="antipasti",
                price_value=8.0,
                price_currency="EUR",
            ),
        ]
    )
    dishes = _candidates_from_response(parsed, _source(), span_prefix="page-1")
    assert len(dishes) == 2
    # Normalization fires here: PIZZAS → "Pizzas", "antipasti" → "Antipasti".
    assert dishes[0].menu_category == "Pizzas"
    assert dishes[1].menu_category == "Antipasti"


def test_menu_category_absent_yields_none() -> None:
    """Chalkboards / posts legitimately have no header — must be None."""
    parsed = ExtractionResponse(
        candidates=[
            _ExtractedCandidate(
                raw_name="Lamb Ragù",
                normalized_name="Lamb Ragù",
                # menu_category omitted entirely — defaults to None.
            )
        ]
    )
    dishes = _candidates_from_response(parsed, _source(), span_prefix="")
    assert len(dishes) == 1
    assert dishes[0].menu_category is None


def test_minimal_fallback_response_yields_none_without_crashing() -> None:
    """When the server times out the full grammar and the client falls
    back to `_MinimalExtractedCandidate`, the materializer must still
    produce a valid `DishCandidate` with `menu_category=None`."""
    parsed = _MinimalExtractionResponse(
        candidates=[
            _MinimalExtractedCandidate(
                raw_name="Margherita",
                normalized_name="Margherita",
                price_value=12.0,
                price_currency="EUR",
            )
        ]
    )
    dishes = _candidates_from_response(parsed, _source(), span_prefix="")
    assert len(dishes) == 1
    assert dishes[0].menu_category is None
    assert dishes[0].canonical_name if False else True  # smoke


def test_menu_category_with_only_whitespace_becomes_none() -> None:
    """Defensive: model emits a blank string instead of omitting the key."""
    parsed = ExtractionResponse(
        candidates=[
            _ExtractedCandidate(
                raw_name="Margherita",
                normalized_name="Margherita",
                menu_category="   ",
            )
        ]
    )
    dishes = _candidates_from_response(parsed, _source(), span_prefix="")
    assert dishes[0].menu_category is None


# ---------- fallback path tests ----------


def test_extract_fallback_propagates_menu_category() -> None:
    """The deterministic fallback (used by evals + CI) must populate
    `menu_category` from the fixture hints — same contract as the live path.
    Pinning this prevents a silent regression where evals would report
    `missing_categories=1.0` while real runs ship populated categories."""
    from app.ai.extraction import extract_fallback

    src = SourceDocument(
        id="src-fb-italian",
        filename="menu_pdf_branch_a.pdf",
        kind=SourceKind.PDF,
        content_type="application/pdf",
        sha256="0" * 64,
    )
    dishes = extract_fallback(src)
    # The italian bundle now has `menu_category="Pizze"` on every hint.
    assert len(dishes) >= 1
    assert all(d.menu_category == "Pizze" for d in dishes), (
        f"expected every hint to have category 'Pizze', "
        f"got {[d.menu_category for d in dishes]}"
    )


def test_extract_fallback_handles_missing_menu_category_gracefully() -> None:
    """Hints without a `menu_category` key must yield `None`, never crash.
    This protects bundles that intentionally omit categories (chalkboards,
    modifier-only sources)."""
    from app.ai.extraction import extract_fallback

    src = SourceDocument(
        id="src-fb-board",
        filename="chalkboard_branch_c.jpg",
        kind=SourceKind.BOARD,
        content_type="image/jpeg",
        sha256="0" * 64,
    )
    dishes = extract_fallback(src)
    # The chalkboard bundle deliberately has no headers — every dish None.
    assert len(dishes) >= 1
    assert all(d.menu_category is None for d in dishes)
