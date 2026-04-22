"""Process-local in-memory store for batches and processing runs.

Single-process only — the demo runs on one uvicorn worker. External DB
is intentionally out of MVP scope; the stable JSON catalog served by
`/api/catalog/{run_id}.json` is the external contract.
"""
from __future__ import annotations

import threading
import uuid
from datetime import UTC, datetime

from ..domain.fixtures import IDS, fixture_cockpit
from ..domain.models import (
    CockpitState,
    DecisionRequest,
    EntityId,
    LiveReconciliationEvent,
    ModerationStatus,
    ProcessingRun,
    ProcessingState,
    UploadBatch,
)


def _now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_id(prefix: str) -> EntityId:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class InMemoryStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._batches: dict[EntityId, UploadBatch] = {}
        self._run_meta: dict[EntityId, ProcessingRun] = {}
        self._cockpits: dict[EntityId, CockpitState] = {}
        self._source_bytes: dict[EntityId, bytes] = {}

    # ----- source bytes -----

    def save_source_bytes(self, source_id: EntityId, data: bytes) -> None:
        with self._lock:
            self._source_bytes[source_id] = data

    def get_source_bytes(self, source_id: EntityId) -> bytes | None:
        with self._lock:
            return self._source_bytes.get(source_id)

    def find_source(self, source_id: EntityId):
        """Return the `SourceDocument` for this id by scanning all batches.

        Used by the preview endpoint so the UI can render the menu the
        reviewer actually uploaded. O(batches × sources) but batch counts
        are trivially small for the demo.
        """
        with self._lock:
            for batch in self._batches.values():
                for src in batch.sources:
                    if src.id == source_id:
                        return src
        return None

    # ----- batches -----

    def save_batch(self, batch: UploadBatch) -> None:
        with self._lock:
            self._batches[batch.id] = batch

    def get_batch(self, batch_id: EntityId) -> UploadBatch | None:
        with self._lock:
            return self._batches.get(batch_id)

    # ----- runs -----

    def create_run(self, batch_id: EntityId) -> EntityId:
        """Register a new processing run, state=QUEUED. Returns processing_id."""
        run_id = new_id("run")
        run = ProcessingRun(
            id=run_id,
            batch_id=batch_id,
            state=ProcessingState.QUEUED,
            state_detail=None,
            adaptive_thinking_pairs=0,
            started_at=_now_iso(),
            ready_at=None,
        )
        with self._lock:
            self._run_meta[run_id] = run
        return run_id

    def update_state(
        self,
        run_id: EntityId,
        state: ProcessingState,
        state_detail: str | None = None,
        adaptive_thinking_pairs: int | None = None,
    ) -> ProcessingRun | None:
        with self._lock:
            existing = self._run_meta.get(run_id)
            if existing is None:
                return None
            updated = existing.model_copy(
                update={
                    "state": state,
                    "state_detail": state_detail,
                    **(
                        {"adaptive_thinking_pairs": adaptive_thinking_pairs}
                        if adaptive_thinking_pairs is not None
                        else {}
                    ),
                    **({"ready_at": _now_iso()} if state == ProcessingState.READY else {}),
                }
            )
            self._run_meta[run_id] = updated
            return updated

    # Max names surfaced on the Processing screen. We keep the most recent
    # so the chip wall churns as pages complete instead of quietly freezing.
    _RECENT_DISHES_CAP = 24
    # Cap on how many live-reconciliation events we keep per run. The
    # Processing screen scrolls through them at ~1 per 200-500ms, so 40
    # covers a generous multi-source batch (most runs have <10 pairs)
    # without bloating every poll response.
    _LIVE_RECONCILIATIONS_CAP = 40

    def append_live_reconciliation(
        self, run_id: EntityId, event: LiveReconciliationEvent
    ) -> ProcessingRun | None:
        """Append one reconciliation decision to the run's live feed.

        Called from the pipeline's on_stage('reconciling') callback as
        each pair completes. Polling clients pick it up on the next
        `GET /api/process/{id}` tick.

        Dedup is by (left_id, right_id) — re-emitting the same pair
        replaces the prior entry (useful if the pipeline ever retries
        a borderline decision; future-proof, not required today).
        """
        with self._lock:
            existing = self._run_meta.get(run_id)
            if existing is None:
                return None
            pair_key = (event.left_id, event.right_id)
            merged = [
                e for e in existing.live_reconciliations
                if (e.left_id, e.right_id) != pair_key
            ]
            merged.append(event)
            if len(merged) > self._LIVE_RECONCILIATIONS_CAP:
                merged = merged[-self._LIVE_RECONCILIATIONS_CAP:]
            updated = existing.model_copy(update={"live_reconciliations": merged})
            self._run_meta[run_id] = updated
            return updated

    def append_recent_dishes(
        self, run_id: EntityId, names: list[str]
    ) -> ProcessingRun | None:
        """Append newly-extracted dish names to the run's live chip wall.

        Dedup is case-insensitive, last-wins; the list is capped so the
        ProcessingRun payload stays small across many polls.
        """
        clean = [n.strip() for n in names if n and n.strip()]
        if not clean:
            return self._run_meta.get(run_id)
        with self._lock:
            existing = self._run_meta.get(run_id)
            if existing is None:
                return None
            merged = list(existing.recent_dishes)
            seen_lower = {n.lower() for n in merged}
            for name in clean:
                key = name.lower()
                if key in seen_lower:
                    continue
                merged.append(name)
                seen_lower.add(key)
            if len(merged) > self._RECENT_DISHES_CAP:
                merged = merged[-self._RECENT_DISHES_CAP:]
            updated = existing.model_copy(update={"recent_dishes": merged})
            self._run_meta[run_id] = updated
            return updated

    def get_run_meta(self, run_id: EntityId) -> ProcessingRun | None:
        with self._lock:
            return self._run_meta.get(run_id)

    # ----- cockpit -----

    def set_cockpit(self, run_id: EntityId, cockpit: CockpitState) -> None:
        with self._lock:
            self._cockpits[run_id] = cockpit

    def get_cockpit(self, run_id: EntityId) -> CockpitState | None:
        with self._lock:
            return self._cockpits.get(run_id)

    def materialize_ready_cockpit(self, run_id: EntityId, batch_id: EntityId) -> CockpitState:
        """Build the final CockpitState from the fixture, keyed to this run."""
        cockpit = fixture_cockpit(processing_id=run_id, batch_id=batch_id)
        self.set_cockpit(run_id, cockpit)
        with self._lock:
            self._run_meta[run_id] = cockpit.processing
        return cockpit

    # ----- decisions -----

    def apply_decision(
        self, run_id: EntityId, decision: DecisionRequest
    ) -> CockpitState | None:
        with self._lock:
            cockpit = self._cockpits.get(run_id)
            if cockpit is None:
                return None

            new_moderation = {
                "approve": ModerationStatus.APPROVED,
                "edit": ModerationStatus.EDITED,
                "reject": ModerationStatus.REJECTED,
            }[decision.action]

            if decision.target_kind == "canonical":
                # Whitelist the fields a reviewer can patch. Everything else
                # on the dish (ids, decision record, source refs, moderation
                # itself) is computed or authoritative and must not be
                # overwritten via the decisions endpoint.
                allowed_fields = {
                    "canonical_name",
                    "aliases",
                    "ingredients",
                    "price_value",
                    "price_currency",
                    "menu_category",
                }
                updated_dishes = []
                found = False
                for dish in cockpit.canonical_dishes:
                    if dish.id == decision.target_id:
                        edit = decision.edit or {}
                        patch = {k: edit[k] for k in edit if k in allowed_fields}
                        updated_dishes.append(
                            dish.model_copy(
                                update={
                                    "moderation": new_moderation,
                                    **patch,
                                }
                            )
                        )
                        found = True
                    else:
                        updated_dishes.append(dish)
                if not found:
                    return None
                cockpit = cockpit.model_copy(update={"canonical_dishes": updated_dishes})

            elif decision.target_kind == "ephemeral":
                updated_ephs = []
                found = False
                for eph in cockpit.ephemerals:
                    if eph.id == decision.target_id:
                        edit = decision.edit or {}
                        updated_ephs.append(
                            eph.model_copy(
                                update={
                                    "moderation": new_moderation,
                                    **({"text": edit["text"]} if "text" in edit else {}),
                                }
                            )
                        )
                        found = True
                    else:
                        updated_ephs.append(eph)
                if not found:
                    return None
                cockpit = cockpit.model_copy(update={"ephemerals": updated_ephs})

            else:  # modifier — no moderation field on Modifier yet; 404 to signal.
                # Modifiers are not independently moderated in the MVP. A reviewer
                # may detach a modifier by rejecting the parent canonical; for now
                # return 404 so the contract is honest.
                return None

            self._cockpits[run_id] = cockpit
            return cockpit


store = InMemoryStore()
