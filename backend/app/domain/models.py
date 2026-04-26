"""Pydantic domain models.

Authoritative contract for the entire stack. The frontend TypeScript types
in `frontend/src/domain/types.ts` mirror this file one-for-one.

IDs are opaque strings so human-readable fixture IDs like `dish-margherita`
are accepted as-is.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field

EntityId: TypeAlias = str


class ModerationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    EDITED = "edited"
    REJECTED = "rejected"


class RouteLabel(str, Enum):
    CANONICAL = "canonical"
    MODIFIER = "modifier"
    EPHEMERAL = "ephemeral"
    NEEDS_REVIEW = "needs_review"


class SourceKind(str, Enum):
    PDF = "pdf"
    PHOTO = "photo"
    POST = "post"
    BOARD = "board"


class ReconciliationClass(str, Enum):
    OBVIOUS_MERGE = "obvious_merge"
    OBVIOUS_NON_MERGE = "obvious_non_merge"
    AMBIGUOUS = "ambiguous"


class ProcessingState(str, Enum):
    QUEUED = "queued"
    EXTRACTING = "extracting"
    RECONCILING = "reconciling"
    ROUTING = "routing"
    READY = "ready"
    FAILED = "failed"


# ---------- Evidence ----------


class SourceDocument(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: EntityId
    filename: str
    kind: SourceKind
    content_type: str
    sha256: str
    width_px: int | None = None
    height_px: int | None = None
    # PDFs only. Populated at upload time from `pypdf.PdfReader(...).pages`
    # so the frontend can render a "page 1 of N" ribbon in the scanner
    # preview. `None` on photos/posts/chalkboards — those are always
    # single-page artifacts conceptually.
    page_count: int | None = None


class EvidenceRecord(BaseModel):
    """One snippet of raw evidence anchored back to a source."""

    source_id: EntityId
    raw_text: str
    span_hint: str | None = None


# ---------- Extraction ----------


class DishCandidate(BaseModel):
    id: EntityId
    source_id: EntityId
    raw_name: str
    normalized_name: str
    inferred_dish_type: str | None = None
    ingredients: list[str] = Field(default_factory=list)
    price_value: float | None = None
    price_currency: str | None = None
    is_modifier_candidate: bool = False
    is_ephemeral_candidate: bool = False
    # Populated by Opus during extraction — these feed the /api/search
    # endpoint so natural-language queries in Spanish / Spanglish can land
    # on the dish without manual curation.
    aliases: list[str] = Field(default_factory=list)
    search_terms: list[str] = Field(default_factory=list)
    menu_category: str | None = None
    evidence: EvidenceRecord


# ---------- Reconciliation ----------


class ReconciliationResult(BaseModel):
    """Output of comparing one PAIR of DishCandidates.

    The *_id / *_name / *_source_id fields refer to the two DishCandidates
    that went into the pair. `left_name` and `right_name` are the raw (or
    normalized) candidate names captured at reconciliation time. They're
    *optional* on this model so the gate-stage code (which only knows IDs)
    can emit bare records; the pipeline enriches them in `_build_cockpit`
    before shipping to the UI so the frontend can render a narrative
    trace without needing access to the full `DishCandidate` list.
    """

    left_id: EntityId
    right_id: EntityId
    gate_class: ReconciliationClass
    merged: bool
    canonical_name: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    decision_summary: str = Field(max_length=240)
    used_adaptive_thinking: bool
    # Enrichment fields — populated by `_build_cockpit` so the UI can show
    # "`Milanesa Napolitana` (from lunch.pdf) ↔ `Mila Napo` (from photo.jpg)
    # → merged" without having to cross-reference internal candidate IDs.
    left_name: str | None = None
    right_name: str | None = None
    left_source_id: EntityId | None = None
    right_source_id: EntityId | None = None


# ---------- Routing ----------


class RoutingDecision(BaseModel):
    candidate_id: EntityId
    route: RouteLabel
    parent_dish_id: EntityId | None = None
    decision_summary: str = Field(max_length=240)
    confidence: float = Field(ge=0.0, le=1.0)


# ---------- Decision summary (Cockpit-facing) ----------


class DecisionSummary(BaseModel):
    """The product-surface decision. Never contains raw thinking."""

    text: str = Field(max_length=240)
    lead_word: Literal["Extracted", "Merged", "Not merged", "Routed", "Held"]
    confidence: float = Field(ge=0.0, le=1.0)


# ---------- Canonical output ----------


class Modifier(BaseModel):
    id: EntityId
    text: str
    price_delta_value: float | None = None
    price_delta_currency: str | None = None
    parent_dish_id: EntityId | None = None
    source_ids: list[EntityId]


class CanonicalDish(BaseModel):
    id: EntityId
    canonical_name: str
    aliases: list[str] = Field(default_factory=list)
    # Natural-language search handles. These are the terms a diner might
    # use in Spanish / Spanglish / shorthand — populated by Opus from the
    # evidence plus the model's knowledge of how locals talk about food.
    search_terms: list[str] = Field(default_factory=list)
    menu_category: str | None = None
    ingredients: list[str] = Field(default_factory=list)
    price_value: float | None = None
    price_currency: str | None = None
    source_ids: list[EntityId]
    modifier_ids: list[EntityId] = Field(default_factory=list)
    decision: DecisionSummary
    moderation: ModerationStatus = ModerationStatus.PENDING


class EphemeralItem(BaseModel):
    id: EntityId
    text: str
    source_ids: list[EntityId]
    decision: DecisionSummary
    moderation: ModerationStatus = ModerationStatus.PENDING


# ---------- Processing run ----------


class LiveReconciliationEvent(BaseModel):
    """A single reconciliation decision, emitted by the pipeline as it
    completes each pair and consumed by the Processing screen to animate
    an "Opus is deciding right now" panel.

    The payload is a strict subset of `ReconciliationResult` — only the
    fields the live UI actually renders. We keep it small because the
    Processing endpoint is polled every ~400 ms and every extra byte
    ships on every poll.
    """

    left_id: EntityId
    right_id: EntityId
    left_name: str
    right_name: str
    left_source_id: EntityId | None = None
    right_source_id: EntityId | None = None
    # Presentation-only hints so the Processing screen can render the
    # side-by-side "evidence" header without a second fetch. `kind` is a
    # coarse bucket used to pick the right thumbnail strategy:
    #   "image" → render <img src="/api/sources/{id}/content">
    #   "pdf"   → render a PDF glyph + filename chip (no inline viewer)
    #   "other" / None → filename chip only
    left_source_filename: str | None = None
    right_source_filename: str | None = None
    left_source_kind: Literal["image", "pdf", "other"] | None = None
    right_source_kind: Literal["image", "pdf", "other"] | None = None
    merged: bool
    decision_summary: str = Field(max_length=240)
    used_adaptive_thinking: bool = False


class ExtractionProgress(BaseModel):
    """Per-source / per-page extraction status, emitted by the pipeline
    every time an Opus page call completes.

    This is the structured signal the Processing screen uses to drive its
    "reading page X of N" thumbnail animation — *honestly* tied to what
    the model actually did, instead of a wall-clock timer. A multi-page
    PDF is split into one vision call per page (see `extraction._split_pdf_pages`),
    and each time one of those calls returns we bump `pages_done`.

    Because the workers can run 2 page calls concurrently, `pages_done`
    represents "pages that have COMPLETED" — the UI can safely show
    `pages_done + 1` as "page currently being processed".
    """

    source_id: EntityId
    source_idx: int = Field(ge=1, description="1-indexed position in the batch")
    source_total: int = Field(ge=1)
    source_name: str
    pages_done: int = Field(ge=0, description="Pages whose Opus call finished")
    pages_total: int = Field(ge=1)


class ProcessingRun(BaseModel):
    id: EntityId
    batch_id: EntityId
    state: ProcessingState
    state_detail: str | None = None
    adaptive_thinking_pairs: int = 0
    started_at: str
    ready_at: str | None = None
    # Structured, real-time extraction progress. The Processing screen's
    # thumbnail uses this (when present) to decide which source is
    # currently being read and which page Opus is working on — replacing
    # the earlier wall-clock heuristic. `None` during reconciling /
    # routing / ready, and during the mock pipeline which doesn't
    # produce page-level telemetry.
    extraction_progress: "ExtractionProgress | None" = None
    # Live-extracted dish names, streamed during the EXTRACTING stage.
    # The Processing screen renders these as an animated chip wall so a
    # long Opus call on a 5-page menu never feels like a frozen spinner.
    # Deduped (case-insensitive) and capped server-side — see the store.
    recent_dishes: list[str] = Field(default_factory=list)
    # Cross-source reconciliation decisions, streamed during the
    # RECONCILING stage. Each entry is one pair Opus just compared: the
    # Processing screen renders this as a live side-by-side feed
    # ("<left> vs <right> → Merged / Kept separate"). Capped server-side
    # so the poll payload never runs away.
    live_reconciliations: list[LiveReconciliationEvent] = Field(default_factory=list)
    # Uploaded source documents for this run's batch. The Processing
    # screen renders these big — one thumbnail per source with a scanner
    # line animation and the live `recent_dishes` chips stacked beside —
    # so the user has something to look at while Opus is reading, and
    # can *see* which PDF/photo each extracted dish came from. Populated
    # server-side on the GET endpoint; default-empty so the field is
    # additive (tests and fixtures don't have to construct sources).
    sources: list[SourceDocument] = Field(default_factory=list)


class MetricsPreview(BaseModel):
    """Subset of evals report surfaced in the Cockpit metrics pane."""

    sources_ingested: int
    canonical_count: int
    modifier_count: int
    ephemeral_count: int
    merge_precision: float | None = None
    non_merge_accuracy: float | None = None
    time_to_review_pack_seconds: float | None = None


class ExcludedItem(BaseModel):
    """One dish Opus 4.7 dropped because it matched the reviewer's filter.

    Surfaced as a "receipt" in the Cockpit so the reviewer can verify the
    filter actually fired, and downstream consumers reading the exported
    JSON can audit why a dish that appears printed on the menu image is
    not in the catalog.

    `reason` is set when the second-pass keep/drop classifier produced
    one (e.g. "purely vegetarian"); the in-prompt HARD FILTER pass during
    extraction returns names without an explanation, in which case
    `reason` stays None and the UI renders a generic "matched user
    filter" caption.
    """

    name: str
    reason: str | None = None


class CockpitState(BaseModel):
    """Exactly what `GET /api/review/{processing_id}` returns.

    `modifiers` is the flat list of ALL modifiers (attached + unattached).
    The UI derives the "unattached lane" client-side as the subset where
    `parent_dish_id is None`.

    `quality_signal` is the heuristic guardrail's verdict on this run
    (ready / review_recommended / likely_failure). The schema for it
    lives in `backend.app.core.quality` so the domain layer stays free
    of heuristic logic — we import the model here via the delayed type
    hint to avoid a circular dependency.
    """

    processing: ProcessingRun
    sources: list[SourceDocument]
    canonical_dishes: list[CanonicalDish]
    modifiers: list[Modifier]
    ephemerals: list[EphemeralItem]
    reconciliation_trace: list[ReconciliationResult]
    metrics_preview: MetricsPreview | None = None
    quality_signal: "QualitySignal | None" = None
    # The natural-language filter the reviewer attached to THIS run (or
    # None if they just dropped files). Surfaced back in the Cockpit so the
    # reviewer can see exactly what Opus was told to do — "Filter applied:
    # exclude beverages" — and judge for themselves whether the output
    # honors it. We intentionally don't try to machine-verify the filter:
    # the reviewer's eyes on the canonical list are the ground truth.
    user_instructions: str | None = None
    # Receipt of every dish Opus 4.7 dropped because of `user_instructions`.
    # Combines the in-prompt HARD FILTER pass (no reason) and the post-
    # extraction keep/drop classifier (reason supplied by the model). Empty
    # on runs without a filter or runs that excluded nothing.
    excluded_by_user_filter: list[ExcludedItem] = Field(default_factory=list)


# ---------- Internal wire models (not exposed in the CockpitState) ----------


class UploadBatch(BaseModel):
    """Output of `POST /api/upload`. Internal to the backend."""

    id: EntityId
    sources: list[SourceDocument]
    uploaded_at: str


class DecisionRequest(BaseModel):
    """Body of `POST /api/review/{processing_id}/decisions`."""

    target_kind: Literal["canonical", "modifier", "ephemeral"]
    target_id: EntityId
    action: Literal["approve", "edit", "reject"]
    edit: dict | None = None


class ApiError(BaseModel):
    """Uniform 4xx error body: `{ "error": { code, message, request_id } }`."""

    code: str
    message: str
    request_id: str | None = None


# Resolve the forward reference on `CockpitState.quality_signal`.
# The import is deferred to avoid a cycle between `domain.models` and
# `core.quality` (quality imports CanonicalDish from this module).
from ..core.quality import QualitySignal  # noqa: E402,F401

CockpitState.model_rebuild()
