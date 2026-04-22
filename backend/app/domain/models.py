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
    """Output of comparing one PAIR of DishCandidates."""

    left_id: EntityId
    right_id: EntityId
    gate_class: ReconciliationClass
    merged: bool
    canonical_name: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    decision_summary: str = Field(max_length=240)
    used_adaptive_thinking: bool


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


class ProcessingRun(BaseModel):
    id: EntityId
    batch_id: EntityId
    state: ProcessingState
    state_detail: str | None = None
    adaptive_thinking_pairs: int = 0
    started_at: str
    ready_at: str | None = None
    # Live-extracted dish names, streamed during the EXTRACTING stage.
    # The Processing screen renders these as an animated chip wall so a
    # long Opus call on a 5-page menu never feels like a frozen spinner.
    # Deduped (case-insensitive) and capped server-side — see the store.
    recent_dishes: list[str] = Field(default_factory=list)


class MetricsPreview(BaseModel):
    """Subset of evals report surfaced in the Cockpit metrics pane."""

    sources_ingested: int
    canonical_count: int
    modifier_count: int
    ephemeral_count: int
    merge_precision: float | None = None
    non_merge_accuracy: float | None = None
    time_to_review_pack_seconds: float | None = None


class CockpitState(BaseModel):
    """Exactly what `GET /api/review/{processing_id}` returns.

    `modifiers` is the flat list of ALL modifiers (attached + unattached).
    The UI derives the "unattached lane" client-side as the subset where
    `parent_dish_id is None`.
    """

    processing: ProcessingRun
    sources: list[SourceDocument]
    canonical_dishes: list[CanonicalDish]
    modifiers: list[Modifier]
    ephemerals: list[EphemeralItem]
    reconciliation_trace: list[ReconciliationResult]
    metrics_preview: MetricsPreview | None = None


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
