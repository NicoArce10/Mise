"""POST /api/process/{batch_id} and GET /api/process/{processing_id}.

Two pipeline paths:
- `mock` (default) — fixture-based, ~1.6s for full stage progression. Keeps
  the demo alive when the API key is absent or offline.
- `real` / `fallback` — opt-in via `MISE_PIPELINE_MODE=real` env var. Runs
  the real extraction → gate → reconciliation → routing pipeline. On any
  hard error the path falls back to the fixture cockpit so the UI never
  blocks on a missing key during the demo.

Thread-based background work is used instead of FastAPI's BackgroundTasks
because TestClient awaits BackgroundTasks synchronously before returning
the response, which would make the intermediate states (EXTRACTING,
RECONCILING, ROUTING) invisible to the Cockpit's polling.
"""
from __future__ import annotations

import logging
import os
import threading
import time

from fastapi import APIRouter, HTTPException, status

from ..core.store import store
from ..domain.models import EntityId, ProcessingRun, ProcessingState

router = APIRouter(prefix="/api/process", tags=["processing"])
logger = logging.getLogger(__name__)


_MOCK_STAGE_SECONDS = 0.4  # 1.6s total for queued -> ready


def _advance_pipeline_mock(run_id: EntityId, batch_id: EntityId) -> None:
    """Worker-thread mock pipeline. Advances state with short sleeps."""
    try:
        time.sleep(_MOCK_STAGE_SECONDS)
        store.update_state(run_id, ProcessingState.EXTRACTING, state_detail=None)

        time.sleep(_MOCK_STAGE_SECONDS)
        store.update_state(
            run_id,
            ProcessingState.RECONCILING,
            state_detail="Adaptive thinking engaged on 2 pairs",
            adaptive_thinking_pairs=2,
        )

        time.sleep(_MOCK_STAGE_SECONDS)
        store.update_state(run_id, ProcessingState.ROUTING, state_detail=None)

        time.sleep(_MOCK_STAGE_SECONDS)
        store.materialize_ready_cockpit(run_id, batch_id)
    except Exception:
        store.update_state(run_id, ProcessingState.FAILED, state_detail="pipeline error")
        raise


def _advance_pipeline_real(run_id: EntityId, batch_id: EntityId) -> None:
    """Run the real pipeline (extraction → gate → reconciliation → routing).

    Uses lazy imports so the SDK is not required to start the app in mock
    mode. On ANY exception we fall back to the fixture cockpit — the demo
    video must not crash because of a network hiccup.
    """
    try:
        from ..pipeline import PipelineInput, run_pipeline  # noqa: WPS433

        batch = store.get_batch(batch_id)
        if batch is None:
            store.update_state(run_id, ProcessingState.FAILED, state_detail="batch missing")
            return

        store.update_state(run_id, ProcessingState.EXTRACTING, state_detail=None)
        # The upload path does not persist bytes in M3/M4 (memory-only); the
        # pipeline will fall back to fixture-keyed extraction per filename.
        inputs = [PipelineInput(source=src, data=None) for src in batch.sources]

        mode = os.environ.get("MISE_PIPELINE_MODE", "mock").lower()
        pipeline_mode = "real" if mode == "real" else "fallback"

        store.update_state(
            run_id,
            ProcessingState.RECONCILING,
            state_detail="Adaptive thinking engaged on ambiguous pairs",
        )

        cockpit = run_pipeline(
            processing_id=run_id,
            batch_id=batch_id,
            inputs=inputs,
            mode=pipeline_mode,  # type: ignore[arg-type]
        )
        store.set_cockpit(run_id, cockpit)
        store.update_state(
            run_id,
            ProcessingState.ROUTING,
            state_detail=None,
            adaptive_thinking_pairs=cockpit.processing.adaptive_thinking_pairs,
        )
        # Finalize state.
        store.update_state(
            run_id,
            ProcessingState.READY,
            state_detail=f"Pipeline mode: {pipeline_mode}",
            adaptive_thinking_pairs=cockpit.processing.adaptive_thinking_pairs,
        )
    except Exception as exc:
        logger.warning("[mise] real pipeline failed, falling back to fixture: %s", exc)
        store.materialize_ready_cockpit(run_id, batch_id)


def _select_pipeline():
    mode = os.environ.get("MISE_PIPELINE_MODE", "mock").lower()
    if mode in {"real", "fallback"}:
        return _advance_pipeline_real
    return _advance_pipeline_mock


@router.post(
    "/{batch_id}",
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_processing(batch_id: EntityId) -> dict[str, EntityId]:
    batch = store.get_batch(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail=f"batch {batch_id} not found")

    run_id = store.create_run(batch_id)
    thread = threading.Thread(
        target=_select_pipeline(),
        args=(run_id, batch_id),
        daemon=True,
        name=f"mise-pipeline-{run_id}",
    )
    thread.start()
    return {"processing_id": run_id}


@router.get("/{processing_id}", response_model=ProcessingRun)
async def get_processing(processing_id: EntityId) -> ProcessingRun:
    run = store.get_run_meta(processing_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"run {processing_id} not found")
    return run
