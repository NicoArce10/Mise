"""POST /api/process/{batch_id} and GET /api/process/{processing_id}.

In M3 the pipeline is a sleep-based mock running on a background thread.
M4 replaces the thread body with real Opus 4.7 calls without changing this
file's contract.

Thread-based background work is used instead of FastAPI's BackgroundTasks
because TestClient awaits BackgroundTasks synchronously before returning
the response, which would make the intermediate states (EXTRACTING,
RECONCILING, ROUTING) invisible to the Cockpit's polling.
"""
from __future__ import annotations

import threading
import time

from fastapi import APIRouter, HTTPException, status

from ..core.store import store
from ..domain.models import EntityId, ProcessingRun, ProcessingState

router = APIRouter(prefix="/api/process", tags=["processing"])


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
        target=_advance_pipeline_mock,
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
