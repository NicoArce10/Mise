"""Live cross-source reconciliation feed — pipeline emits, store buffers,
API exposes.

The panel the user sees on the Processing screen is fed by a chain of
three things that have to line up:

1. `_reconcile_all` in the pipeline fires `on_pair_event(left, right, result)`
   for every completed pair.
2. The API `on_stage` handler filters the pipeline's raw event and, for
   every reconciling tick that carries a `pair_event`, calls
   `store.append_live_reconciliation` with a fully-typed
   `LiveReconciliationEvent`.
3. `GET /api/process/{id}` serialises `ProcessingRun.live_reconciliations`
   back to the client so the Processing view can render it.

These tests exercise each link directly (no network, no real Opus call)
so a regression in any of the three surfaces here instead of only being
caught at demo time.
"""
from __future__ import annotations

import mimetypes
from pathlib import Path

from app.domain.models import (
    DishCandidate,
    EntityId,
    EvidenceRecord,
    LiveReconciliationEvent,
    SourceDocument,
    SourceKind,
)
from app.pipeline import PipelineInput, _reconcile_all, run_pipeline

BUNDLES = Path(__file__).resolve().parent.parent.parent / "evals" / "datasets"


def _mk_candidate(
    id_: str, source_id: str, raw: str, normalized: str | None = None
) -> DishCandidate:
    return DishCandidate(
        id=id_,
        source_id=source_id,
        raw_name=raw,
        normalized_name=normalized or raw,
        evidence=EvidenceRecord(source_id=source_id, raw_text=raw),
    )


# ---------- pipeline emits ----------


def test_reconcile_all_emits_one_event_per_pair_in_deterministic_mode() -> None:
    """`_reconcile_all` fires `on_pair_event` once per pair — this is the
    contract every downstream layer relies on. We exercise the
    deterministic path (no network) so the test is fast and stable."""
    candidates = [
        _mk_candidate("c1", "src-a", "Mila Napo", "Milanesa Napolitana"),
        _mk_candidate("c2", "src-b", "Milanesa Napolitana"),
        _mk_candidate("c3", "src-a", "Coca-Cola"),
    ]
    emitted: list[tuple[str, str]] = []

    _reconcile_all(
        candidates,
        mode="fallback",
        on_pair_event=lambda a, b, r: emitted.append((a.id, b.id)),
    )

    # 3 candidates → C(3,2) = 3 pairs.
    assert len(emitted) == 3
    # Every pair is a unique (left, right) tuple.
    assert len(set(emitted)) == 3


# ---------- store buffers ----------


def test_append_live_reconciliation_dedupes_by_pair_and_caps() -> None:
    """Re-emitting the same (left_id, right_id) pair replaces the prior
    entry (useful if we ever retry). The buffer is capped so a runaway
    reconciliation never bloats the ProcessingRun payload."""
    # Fresh store — reload it the same way the client fixture does.
    import importlib
    import app.core.store as store_mod
    importlib.reload(store_mod)
    from app.core.store import store

    run_id: EntityId = store.create_run(batch_id="b-1")

    def _ev(left: str, right: str, merged: bool = False) -> LiveReconciliationEvent:
        return LiveReconciliationEvent(
            left_id=left,
            right_id=right,
            left_name="L",
            right_name="R",
            merged=merged,
            decision_summary="sample",
        )

    # Append 50 distinct pairs — cap is 40, oldest should be dropped.
    for i in range(50):
        store.append_live_reconciliation(run_id, _ev(f"l{i}", f"r{i}"))
    meta = store.get_run_meta(run_id)
    assert meta is not None
    assert len(meta.live_reconciliations) == 40
    # The oldest ids (l0..l9) must have been evicted.
    retained = {(e.left_id, e.right_id) for e in meta.live_reconciliations}
    assert ("l0", "r0") not in retained
    assert ("l49", "r49") in retained

    # Re-emit an existing pair with a DIFFERENT verdict — should replace.
    store.append_live_reconciliation(run_id, _ev("l49", "r49", merged=True))
    meta = store.get_run_meta(run_id)
    assert meta is not None
    tail = [e for e in meta.live_reconciliations if e.left_id == "l49"]
    assert len(tail) == 1
    assert tail[0].merged is True


# ---------- API exposes ----------


def _kind(name: str) -> SourceKind:
    low = name.lower()
    if low.endswith(".pdf"):
        return SourceKind.PDF
    if "chalk" in low or "board" in low:
        return SourceKind.BOARD
    if "instagram" in low or "post" in low:
        return SourceKind.POST
    return SourceKind.PHOTO


def _inputs(bundle: str) -> list[PipelineInput]:
    out: list[PipelineInput] = []
    for p in sorted((BUNDLES / bundle / "evidence").iterdir()):
        mime, _ = mimetypes.guess_type(str(p))
        src = SourceDocument(
            id=f"src-{p.stem}",
            filename=p.name,
            kind=_kind(p.name),
            content_type=mime or "application/octet-stream",
            sha256="deadbeef",
        )
        out.append(PipelineInput(source=src, filepath=p))
    return out


def test_full_pipeline_populates_events_via_on_stage_handler() -> None:
    """End-to-end on the deterministic fallback pipeline: run the pipeline
    with a real on_stage callback that mirrors the API's logic, and
    verify that interesting pairs land in the collected events. This is
    the functional contract that feeds the Processing screen."""
    events: list[dict[str, object]] = []

    def on_stage(
        stage: str, detail: str | None, extra: dict[str, object] | None
    ) -> None:
        # Mirror the filtering logic in app/api/processing.py — only
        # pair_event ticks matter for the live feed.
        if stage == "reconciling" and extra and extra.get("pair_event"):
            events.append(extra["pair_event"])  # type: ignore[arg-type]

    run_pipeline(
        processing_id="test-live-ev",
        batch_id="b-live-ev",
        inputs=_inputs("bundle_01_italian"),
        mode="fallback",
        on_stage=on_stage,
    )

    # At least one interesting pair must have been emitted. Bundle 01 is
    # deliberately chosen because it includes cross-source duplicates
    # (Margherita across PDF + chalkboard photo).
    assert len(events) > 0
    ev = events[0]
    # Payload contract — the API relies on these keys being present.
    for key in (
        "left_id",
        "right_id",
        "left_name",
        "right_name",
        "left_source_id",
        "right_source_id",
        "merged",
        "decision_summary",
        "used_adaptive_thinking",
    ):
        assert key in ev, f"pair_event missing key: {key}"
