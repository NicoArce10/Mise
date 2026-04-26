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
  /**
   * PDFs only. `null` on photos/posts/chalkboards (conceptually
   * single-page) and on PDFs whose page count could not be determined
   * at upload time (encrypted, truncated, or otherwise unreadable by
   * pypdf). Used by the scanner preview to render a "page 1 of N"
   * ribbon — omitted when the count is 1 or null.
   */
  page_count: number | null;
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
  // Enrichment fields populated by the pipeline so the UI can narrate
  // cross-source merges. `*_name` is the raw / normalized candidate
  // name; `*_source_id` is the id of the `SourceDocument` each side
  // came from. Null when the pipeline couldn't resolve the candidate.
  left_name: string | null;
  right_name: string | null;
  left_source_id: UUID | null;
  right_source_id: UUID | null;
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

/** One reconciliation decision, streamed while Opus 4.7 is still
 * comparing pairs. The Processing screen renders these as a live
 * side-by-side feed. Small on the wire by design — we ship this on
 * every poll. */
export interface LiveReconciliationEvent {
  left_id: UUID;
  right_id: UUID;
  left_name: string;
  right_name: string;
  left_source_id: UUID | null;
  right_source_id: UUID | null;
  left_source_filename: string | null;
  right_source_filename: string | null;
  left_source_kind: 'image' | 'pdf' | 'other' | null;
  right_source_kind: 'image' | 'pdf' | 'other' | null;
  merged: boolean;
  decision_summary: string;
  used_adaptive_thinking: boolean;
}

/**
 * Structured per-source / per-page extraction status emitted by the
 * backend every time an Opus page call completes. Replaces the earlier
 * parsed `state_detail` string + wall-clock heuristic — the ScannerOverlay
 * now reads this directly to decide which source is the hero and which
 * page the thumbnail should render.
 *
 * Populated only during the real pipeline's extracting stage; null
 * during reconciling/routing/ready and during the mock pipeline.
 */
export interface ExtractionProgress {
  source_id: UUID;
  /** 1-indexed position of the currently-processing source in the batch. */
  source_idx: number;
  source_total: number;
  source_name: string;
  /** Pages whose Opus call has *completed* (success or error). */
  pages_done: number;
  pages_total: number;
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
  // Live feed of cross-source reconciliation decisions. Empty until the
  // reconciling stage starts. Filtered server-side to only "interesting"
  // pairs (cross-source / merged / adaptive-thinking / typo-disagreement),
  // so the user doesn't see the trivial same-source same-name pairs.
  live_reconciliations: LiveReconciliationEvent[];
  // The uploaded PDFs/photos that belong to this run's batch. The
  // Processing screen renders these big (with a scanner overlay) so the
  // user sees "Opus is reading *this* document right now" instead of a
  // bare progress bar. Empty on mock timelines.
  sources: SourceDocument[];
  // Structured, real-time "Opus just finished page X of source Y"
  // snapshot. Null until the first page of the first source completes,
  // and during non-extraction stages. Consumed by ScannerOverlay to
  // align its thumbnail+ribbon with reality instead of a timer.
  extraction_progress?: ExtractionProgress | null;
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

/**
 * One dish Opus 4.7 dropped because it matched the reviewer's filter.
 * Pairs name (always present) with reason (model-supplied when the
 * second-pass keep/drop classifier produced one; null when the in-prompt
 * HARD FILTER pass returned the name without an explanation).
 */
export interface ExcludedItem {
  name: string;
  reason?: string | null;
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
  /**
   * The natural-language filter the reviewer attached to this upload, if
   * any. Echoed back by the backend so the Cockpit can show exactly what
   * Opus was told to do — and the reviewer can judge whether the output
   * honored it.
   */
  user_instructions?: string | null;
  /**
   * Receipt of every dish Opus 4.7 dropped because of `user_instructions`.
   * Combines both filter passes (in-prompt HARD FILTER + post-extraction
   * keep/drop classifier). Empty on runs without a filter or runs that
   * excluded nothing.
   */
  excluded_by_user_filter?: ExcludedItem[];
}
