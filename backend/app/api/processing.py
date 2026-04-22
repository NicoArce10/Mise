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
        # Read the bytes the user uploaded. Uploads persist them via
        # store.save_source_bytes so the worker thread can reach them here.
        inputs = [
            PipelineInput(source=src, data=store.get_source_bytes(src.id))
            for src in batch.sources
        ]

        # Decide mode the same way _select_pipeline does — use real when
        # explicitly asked OR when an API key is present. Fallback only
        # when neither applies.
        explicit = os.environ.get("MISE_PIPELINE_MODE", "").lower()
        if explicit == "real":
            pipeline_mode = "real"
        elif explicit == "fallback":
            pipeline_mode = "fallback"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            pipeline_mode = "real"
        else:
            pipeline_mode = "fallback"

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
        # Previously this branch fell back to the italian fixture, which
        # made the UI show fake dishes unrelated to what the user uploaded.
        # Honesty over cosmetics: surface the failure in state_detail and
        # leave an empty CockpitState so the reviewer sees there was a
        # pipeline error instead of a misleading result.
        logger.warning("[mise] real pipeline failed: %s", exc)
        from ..domain.models import CockpitState, MetricsPreview

        batch = store.get_batch(batch_id)
        store.update_state(
            run_id,
            ProcessingState.FAILED,
            state_detail=f"pipeline error: {type(exc).__name__}",
        )
        run = store.get_run_meta(run_id)
        if run is None or batch is None:
            return
        empty = CockpitState(
            processing=run,
            sources=list(batch.sources),
            canonical_dishes=[],
            modifiers=[],
            ephemerals=[],
            reconciliation_trace=[],
            metrics_preview=MetricsPreview(
                sources_ingested=len(batch.sources),
                canonical_count=0,
                modifier_count=0,
                ephemeral_count=0,
            ),
        )
        store.set_cockpit(run_id, empty)


def _select_pipeline():
    """Pick the pipeline to run for this upload.

    Priority:
    1. If MISE_PIPELINE_MODE is set explicitly, honor it.
    2. Else if ANTHROPIC_API_KEY is present, use the real pipeline so an
       uploaded file actually gets processed (not overwritten with the
       italian fixture). This is the honest default — a user who boots
       the stack with a valid key expects the product to read their bytes.
    3. Else fall back to mock (fixture walk-through), which is only
       appropriate for a UI-only demo without an API key.
    """
    explicit = os.environ.get("MISE_PIPELINE_MODE", "").lower()
    if explicit in {"real", "fallback", "mock"}:
        if explicit == "mock":
            return _advance_pipeline_mock
        return _advance_pipeline_real
    if os.environ.get("ANTHROPIC_API_KEY"):
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
