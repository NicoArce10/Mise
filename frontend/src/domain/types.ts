// Mirrors backend/app/domain/models.py (§2.3 of docs/plans/2026-04-22-architecture.md).
// Keep in sync. No `any`.

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

export type LeadWord = 'Merged' | 'Not merged' | 'Routed' | 'Held';

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
  ingredients: string[];
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
}
