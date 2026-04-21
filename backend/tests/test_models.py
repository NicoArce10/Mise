"""Round-trip validation: every model serializes and re-loads cleanly."""
from __future__ import annotations

from app.domain.fixtures import fixture_cockpit
from app.domain.models import (
    ApiError,
    CanonicalDish,
    CockpitState,
    DecisionRequest,
    DecisionSummary,
    DishCandidate,
    EphemeralItem,
    EvidenceRecord,
    MetricsPreview,
    Modifier,
    ProcessingRun,
    ProcessingState,
    ReconciliationResult,
    RoutingDecision,
    SourceDocument,
    SourceKind,
    UploadBatch,
)


def _round_trip(obj):
    cls = type(obj)
    dumped = obj.model_dump(mode="json")
    return cls.model_validate(dumped)


def test_every_model_round_trips() -> None:
    cockpit = fixture_cockpit()
    for item in [
        cockpit,
        cockpit.processing,
        *cockpit.sources,
        *cockpit.canonical_dishes,
        *cockpit.modifiers,
        *cockpit.ephemerals,
        *cockpit.reconciliation_trace,
        cockpit.metrics_preview,
    ]:
        if item is None:
            continue
        back = _round_trip(item)
        assert back == item


def test_dish_candidate_round_trip() -> None:
    candidate = DishCandidate(
        id="cand-1",
        source_id="src-1",
        raw_name="Pizza Funghi",
        normalized_name="pizza funghi",
        inferred_dish_type="pizza",
        ingredients=["tomato", "mozzarella", "mushrooms"],
        price_value=14.5,
        price_currency="EUR",
        evidence=EvidenceRecord(source_id="src-1", raw_text="Pizza Funghi 14.50"),
    )
    assert _round_trip(candidate) == candidate


def test_routing_decision_round_trip() -> None:
    rd = RoutingDecision(
        candidate_id="cand-1",
        route="canonical",
        parent_dish_id=None,
        decision_summary="Promoted to canonical after regex gate.",
        confidence=0.9,
    )
    assert _round_trip(rd) == rd


def test_upload_batch_round_trip() -> None:
    batch = UploadBatch(
        id="batch-1",
        sources=[
            SourceDocument(
                id="src-1",
                filename="x.jpg",
                kind=SourceKind.PHOTO,
                content_type="image/jpeg",
                sha256="deadbeef",
            )
        ],
        uploaded_at="2026-04-26T10:00:00Z",
    )
    assert _round_trip(batch) == batch


def test_decision_request_round_trip() -> None:
    req = DecisionRequest(
        target_kind="canonical",
        target_id="dish-margherita",
        action="approve",
        edit=None,
    )
    assert _round_trip(req) == req


def test_api_error_round_trip() -> None:
    err = ApiError(code="not_found", message="x", request_id="req-1")
    assert _round_trip(err) == err


def test_state_enum_values_match_frontend() -> None:
    # Verbatim strings — the frontend TS enum imports these exact values.
    assert ProcessingState.READY.value == "ready"
    assert ProcessingState.RECONCILING.value == "reconciling"


def test_decision_summary_rejects_over_240_chars() -> None:
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        DecisionSummary(text="x" * 241, lead_word="Merged", confidence=0.9)


def test_confidence_range_is_enforced() -> None:
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ReconciliationResult(
            left_id="a",
            right_id="b",
            gate_class="ambiguous",
            merged=True,
            confidence=1.5,
            decision_summary="x",
            used_adaptive_thinking=True,
        )


def test_fixture_has_four_demo_critical_decisions() -> None:
    c = fixture_cockpit()
    names = {d.canonical_name for d in c.canonical_dishes}
    assert "Margherita" in names
    assert "Pizza Funghi" in names
    assert "Calzone Funghi" in names

    margherita = next(d for d in c.canonical_dishes if d.canonical_name == "Margherita")
    assert "Marghertia" in margherita.aliases

    burrata = next((m for m in c.modifiers if m.text == "add burrata +3"), None)
    assert burrata is not None
    assert burrata.parent_dish_id == margherita.id

    eph_names = {e.text for e in c.ephemerals}
    assert "Chef's Special" in eph_names
