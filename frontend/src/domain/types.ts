// Mirrors backend/app/domain/models.py. Keep in sync. No `any`.

export type UUID = string;
export type ISODate = string;

export const ModerationStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  EDITED: 'edited',
  REJECTED: 'rejected',
} as const;
export type ModerationStatus = typeof ModerationStatus[keyof typeof ModerationStatus];

export const RouteLabel = {
  CANONICAL: 'canonical',
  MODIFIER: 'modifier',
  EPHEMERAL: 'ephemeral',
  NEEDS_REVIEW: 'needs_review',
} as const;
export type RouteLabel = typeof RouteLabel[keyof typeof RouteLabel];

export const SourceKind = {
  PDF: 'pdf',
  PHOTO: 'photo',
  POST: 'post',
  BOARD: 'board',
} as const;
export type SourceKind = typeof SourceKind[keyof typeof SourceKind];

export const ReconciliationClass = {
  OBVIOUS_MERGE: 'obvious_merge',
  OBVIOUS_NON_MERGE: 'obvious_non_merge',
  AMBIGUOUS: 'ambiguous',
} as const;
export type ReconciliationClass =
  typeof ReconciliationClass[keyof typeof ReconciliationClass];

export const ProcessingState = {
  QUEUED: 'queued',
  EXTRACTING: 'extracting',
  RECONCILING: 'reconciling',
  ROUTING: 'routing',
  READY: 'ready',
  FAILED: 'failed',
} as const;
export type ProcessingState = typeof ProcessingState[keyof typeof ProcessingState];

// "Extracted" is the single-restaurant default: no cross-branch merge decision,
// the dish simply comes from the menu. "Merged" / "Not merged" stay for
// multi-source dedup cases that the backend still handles internally. The UI
// collapses all non-"Not merged" values into a single neutral label because
// end users don't care about pairwise dedup narrative.
export type LeadWord =
  | 'Extracted'
  | 'Merged'
  | 'Not merged'
  | 'Routed'
  | 'Held';

export interface SourceDocument {
  id: UUID;
  filename: string;
  kind: SourceKind;
  content_type: string;
  sha256: string;
  width_px: number | null;
  height_px: number | null;
}

export interface EvidenceRecord {
  source_id: UUID;
  raw_text: string;
  span_hint: string | null;
}

export interface DishCandidate {
  id: UUID;
  source_id: UUID;
  raw_name: string;
  normalized_name: string;
  inferred_dish_type: string | null;
  ingredients: string[];
  price_value: number | null;
  price_currency: string | null;
  is_modifier_candidate: boolean;
  is_ephemeral_candidate: boolean;
  aliases: string[];
  search_terms: string[];
  menu_category: string | null;
  evidence: EvidenceRecord;
}

export interface ReconciliationResult {
  left_id: UUID;
  right_id: UUID;
  gate_class: ReconciliationClass;
  merged: boolean;
  canonical_name: string | null;
  confidence: number;
  decision_summary: string;
  used_adaptive_thinking: boolean;
}

export interface RoutingDecision {
  candidate_id: UUID;
  route: RouteLabel;
  parent_dish_id: UUID | null;
  decision_summary: string;
  confidence: number;
}

export interface DecisionSummary {
  text: string;
  lead_word: LeadWord;
  confidence: number;
}

export interface Modifier {
  id: UUID;
  text: string;
  price_delta_value: number | null;
  price_delta_currency: string | null;
  parent_dish_id: UUID | null;
  source_ids: UUID[];
}

export interface CanonicalDish {
  id: UUID;
  canonical_name: string;
  aliases: string[];
  search_terms: string[];
  menu_category: string | null;
  ingredients: string[];
  price_value: number | null;
  price_currency: string | null;
  source_ids: UUID[];
  modifier_ids: UUID[];
  decision: DecisionSummary;
  moderation: ModerationStatus;
}

export interface EphemeralItem {
  id: UUID;
  text: string;
  source_ids: UUID[];
  decision: DecisionSummary;
  moderation: ModerationStatus;
}

export interface ProcessingRun {
  id: UUID;
  batch_id: UUID;
  state: ProcessingState;
  state_detail: string | null;
  adaptive_thinking_pairs: number;
  started_at: ISODate;
  ready_at: ISODate | null;
  // Live feed of dish names as Opus 4.7 extracts them page-by-page.
  // Empty until the first page returns; bounded server-side so the
  // ProcessingRun payload never balloons across many polls.
  recent_dishes: string[];
}

export interface MetricsPreview {
  sources_ingested: number;
  canonical_count: number;
  modifier_count: number;
  ephemeral_count: number;
  merge_precision: number | null;
  non_merge_accuracy: number | null;
  time_to_review_pack_seconds: number | null;
}

// Mirrors backend/app/core/quality.py. The guardrail verdict the backend
// attaches to every run. UI reads `status` to pick a badge tone and
// `reasons[]` to fill the tooltip / panel body.
export const QualityStatus = {
  READY: 'ready',
  REVIEW_RECOMMENDED: 'review_recommended',
  LIKELY_FAILURE: 'likely_failure',
} as const;
export type QualityStatus = typeof QualityStatus[keyof typeof QualityStatus];

export type QualityFlag =
  | 'low_dish_count'
  | 'missing_prices'
  | 'missing_categories'
  | 'sparse_ingredients'
  | 'price_outlier'
  | 'duplicate_canonicals'
  | 'partial_extraction';

export interface QualitySignal {
  status: QualityStatus;
  confidence: number;
  flags: QualityFlag[];
  reasons: string[];
  dish_count: number;
  missing_price_ratio: number;
  missing_category_ratio: number;
  sparse_ingredient_ratio: number;
}

export interface CockpitState {
  processing: ProcessingRun;
  sources: SourceDocument[];
  canonical_dishes: CanonicalDish[];
  // Flat list of ALL modifiers (attached + unattached). UI derives "unattached lane"
  // as the subset where parent_dish_id === null. Small extension of §2.4 contract:
  // the original split into unattached_modifiers + modifier_ids forced lookups;
  // a single flat list keeps the frontend and backend trivially in sync.
  modifiers: Modifier[];
  ephemerals: EphemeralItem[];
  reconciliation_trace: ReconciliationResult[];
  metrics_preview: MetricsPreview | null;
  quality_signal: QualitySignal | null;
}
