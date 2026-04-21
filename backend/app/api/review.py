"""GET /api/review/{processing_id} and POST /api/review/{processing_id}/decisions."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..core.store import store
from ..domain.models import CockpitState, DecisionRequest, EntityId, ProcessingState

router = APIRouter(prefix="/api/review", tags=["review"])


def _partial_cockpit_from_run(run_id: EntityId) -> CockpitState | None:
    """When the run exists but the pipeline is not READY, return a partial state
    (processing + empty lists) so the frontend can render the processing view
    off the same endpoint."""
    run = store.get_run_meta(run_id)
    if run is None:
        return None
    return CockpitState(
        processing=run,
        sources=[],
        canonical_dishes=[],
        modifiers=[],
        ephemerals=[],
        reconciliation_trace=[],
        metrics_preview=None,
    )


@router.get("/{processing_id}", response_model=CockpitState)
async def get_review(processing_id: EntityId) -> CockpitState:
    cockpit = store.get_cockpit(processing_id)
    if cockpit is not None:
        return cockpit

    run = store.get_run_meta(processing_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"run {processing_id} not found")

    partial = _partial_cockpit_from_run(processing_id)
    assert partial is not None  # run exists by the check above
    return partial


@router.post("/{processing_id}/decisions", response_model=CockpitState)
async def post_decision(
    processing_id: EntityId,
    decision: DecisionRequest,
) -> CockpitState:
    existing = store.get_cockpit(processing_id)
    if existing is None:
        run = store.get_run_meta(processing_id)
        if run is None:
            raise HTTPException(status_code=404, detail=f"run {processing_id} not found")
        if run.state != ProcessingState.READY:
            raise HTTPException(
                status_code=409,
                detail=f"run {processing_id} not yet ready (state={run.state})",
            )

    updated = store.apply_decision(processing_id, decision)
    if updated is None:
        raise HTTPException(
            status_code=404,
            detail=f"target {decision.target_kind}/{decision.target_id} not found or not moderatable",
        )
    return updated
