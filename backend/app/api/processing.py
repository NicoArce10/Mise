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
from typing import Any

from fastapi import APIRouter, Body, HTTPException, status
from pydantic import BaseModel, Field

from ..core.store import store
from ..domain.models import EntityId, ProcessingRun, ProcessingState

router = APIRouter(prefix="/api/process", tags=["processing"])
logger = logging.getLogger(__name__)


_MOCK_STAGE_SECONDS = 0.4  # 1.6s total for queued -> ready
# Cap on the optional user_instructions payload. This text is copied into
# every Opus call for the run, so a runaway textarea would bloat prompts
# and waste tokens. 2k chars is ~500 tokens — room for a concrete filter
# without letting people paste an entire menu in as "instructions".
_MAX_USER_INSTRUCTIONS = 2000


class StartProcessingBody(BaseModel):
    """Optional body for POST /api/process/{batch_id}.

    When absent (or when `user_instructions` is blank/whitespace) the
    pipeline behaves exactly like before: the system prompt and the
    evidence are the only inputs Opus sees. When provided, a short
    user-authored directive rides alongside each per-page call so the
    model can apply a per-run filter ("Exclude beverages", "Only extract
    pizzas", "Ignore the daily specials section") without us needing to
    edit the system prompt.
    """

    user_instructions: str | None = Field(
        default=None,
        max_length=_MAX_USER_INSTRUCTIONS,
    )


def _advance_pipeline_mock(run_id: EntityId, batch_id: EntityId) -> None:
    """Worker-thread mock pipeline. Advances state with short sleeps."""
    try:
        time.sleep(_MOCK_STAGE_SECONDS)
        store.update_state(
            run_id,
            ProcessingState.EXTRACTING,
            state_detail="Reading the menu",
        )

        time.sleep(_MOCK_STAGE_SECONDS)
        store.update_state(
            run_id,
            ProcessingState.RECONCILING,
            state_detail="Building the dish graph",
            adaptive_thinking_pairs=0,
        )

        time.sleep(_MOCK_STAGE_SECONDS)
        store.update_state(
            run_id,
            ProcessingState.ROUTING,
            state_detail="Organizing the catalog",
        )

        time.sleep(_MOCK_STAGE_SECONDS)
        store.materialize_ready_cockpit(run_id, batch_id)
    except Exception:
        store.update_state(run_id, ProcessingState.FAILED, state_detail="pipeline error")
        raise


def _advance_pipeline_real(
    run_id: EntityId,
    batch_id: EntityId,
    user_instructions: str | None = None,
) -> None:
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

        # Stage callback — translates pipeline ticks into the ProcessingRun
        # state machine the Cockpit polls. No more starting in 'reconciling';
        # the UI now sees 'extracting N/M' first, then 'reconciling i/pairs',
        # then 'routing', then 'ready'.
        def _on_stage(stage: str, detail: str | None, extra: dict[str, Any] | None) -> None:
            adaptive = int(extra.get("adaptive", 0)) if extra else 0
            if stage == "extracting":
                # Names-only tick (a page just returned its candidates): append
                # to the live chip wall WITHOUT touching state_detail so the
                # page-counter stays intact between detail updates.
                new_names = list(extra.get("new_dish_names") or []) if extra else []
                if new_names and detail is None:
                    store.append_recent_dishes(run_id, new_names)
                    return
                store.update_state(
                    run_id,
                    ProcessingState.EXTRACTING,
                    state_detail=detail or "Reading your menus",
                    adaptive_thinking_pairs=adaptive,
                )
                if new_names:
                    store.append_recent_dishes(run_id, new_names)
            elif stage == "reconciling":
                total = int(extra.get("total", 0)) if extra else 0
                pair = int(extra.get("pair", 0)) if extra else 0
                if detail is None and total > 0:
                    detail = f"Normalizing dish names ({pair}/{total})"
                store.update_state(
                    run_id,
                    ProcessingState.RECONCILING,
                    state_detail=detail or "Building the dish graph",
                    adaptive_thinking_pairs=adaptive,
                )
            elif stage == "routing":
                store.update_state(
                    run_id,
                    ProcessingState.ROUTING,
                    state_detail=detail or "Organizing your catalog",
                    adaptive_thinking_pairs=adaptive,
                )
            # 'ready' is handled after the cockpit is stored.

        cockpit = run_pipeline(
            processing_id=run_id,
            batch_id=batch_id,
            inputs=inputs,
            mode=pipeline_mode,  # type: ignore[arg-type]
            on_stage=_on_stage,
            user_instructions=user_instructions,
        )
        store.set_cockpit(run_id, cockpit)

        # Honest READY summary: reflects what actually came out, not just that
        # we finished running. Empty extraction now reads 'No dishes extracted
        # — open Review to see why', so the user never guesses.
        dish_count = len(cockpit.canonical_dishes)
        if dish_count == 0:
            ready_detail = "No dishes extracted from the uploaded sources"
        else:
            mod_count = len(cockpit.modifiers)
            eph_count = len(cockpit.ephemerals)
            ready_detail = (
                f"{dish_count} dish{'es' if dish_count != 1 else ''} · "
                f"{mod_count} modifier{'s' if mod_count != 1 else ''} · "
                f"{eph_count} ephemeral{'s' if eph_count != 1 else ''}"
            )
        store.update_state(
            run_id,
            ProcessingState.READY,
            state_detail=ready_detail,
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
        from ..pipeline import PipelineExtractionFailure  # noqa: WPS433

        # Translate the exception into a user-facing detail string. The UI
        # keys off this string to decide whether to show "try again" vs
        # "this file can't be read".
        if isinstance(exc, PipelineExtractionFailure):
            if exc.transient:
                failure_detail = (
                    "Claude’s API had a hiccup while reading your menu. "
                    "It happens — hit retry and it usually goes through."
                )
            else:
                names = ", ".join(f.filename for f in exc.failures[:3])
                more = f" (+{len(exc.failures) - 3} more)" if len(exc.failures) > 3 else ""
                failure_detail = (
                    f"Couldn’t read: {names}{more}. "
                    "Try a cleaner photo, a smaller file, or a different format."
                )
        elif "ANTHROPIC_API_KEY" in str(exc):
            # Most common self-host issue — call it out explicitly so the
            # operator knows exactly what to fix instead of guessing from a
            # generic stack-trace name.
            failure_detail = (
                "ANTHROPIC_API_KEY is not set — Mise needs a Claude API key "
                "to extract real menus. Load a .env or export the var, then retry."
            )
        else:
            failure_detail = f"pipeline error: {type(exc).__name__}"

        batch = store.get_batch(batch_id)
        store.update_state(
            run_id,
            ProcessingState.FAILED,
            state_detail=failure_detail,
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
    1. If MISE_PIPELINE_MODE is set explicitly, honor it. `mock` is the
       only way to request the italian-fixture walk-through — that path
       is for UI-only demos where we can't call the real model. It must
       NEVER silently fire when a user uploads a real menu, because the
       Cockpit would then show pizza/margherita/funghi unrelated to their
       bytes (which is exactly what the user called "pizza/funghi vieja").
    2. Else if ANTHROPIC_API_KEY is present, use the real pipeline.
    3. Else still use the real pipeline — it will surface the missing-key
       error in `state_detail` ("Claude's API had a hiccup..."). An honest
       error beats a misleading fixture.
    """
    explicit = os.environ.get("MISE_PIPELINE_MODE", "").lower()
    if explicit in {"real", "fallback", "mock"}:
        if explicit == "mock":
            return _advance_pipeline_mock
        return _advance_pipeline_real
    return _advance_pipeline_real


@router.post(
    "/{batch_id}",
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_processing(
    batch_id: EntityId,
    body: StartProcessingBody | None = Body(default=None),
) -> dict[str, EntityId]:
    """Kick off the extraction pipeline for a previously-uploaded batch.

    The request body is optional to stay backward-compatible: existing
    clients that POST an empty body keep working. Clients that want to
    filter the extraction ("exclude beverages", "only pizzas", etc.)
    send `{"user_instructions": "..."}`.
    """
    batch = store.get_batch(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail=f"batch {batch_id} not found")

    run_id = store.create_run(batch_id)
    # Trim + normalize once at the boundary so nothing downstream has to
    # worry about whitespace-only input.
    raw_instructions = body.user_instructions if body is not None else None
    trimmed = (raw_instructions or "").strip()
    user_instructions: str | None = trimmed if trimmed else None

    pipeline_fn = _select_pipeline()
    # The real pipeline accepts the optional third arg; the mock pipeline
    # ignores it. A tiny closure lets us use a single Thread call site.
    if pipeline_fn is _advance_pipeline_real:
        thread_args: tuple[Any, ...] = (run_id, batch_id, user_instructions)
    else:
        thread_args = (run_id, batch_id)

    thread = threading.Thread(
        target=pipeline_fn,
        args=thread_args,
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
