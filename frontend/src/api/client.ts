// Typed client for the Mise FastAPI backend.
// The external contract is `GET /api/catalog/{run_id}.json`; everything
// else is internal and may change.
//
// Usage: on unreachable backend, every call throws — the caller is expected
// to fall back to the local mock path (see App.tsx).

import type {
  CockpitState,
  ModerationStatus,
  ProcessingRun,
  UUID,
} from '../domain/types';

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://127.0.0.1:8000';

export const apiBase = API_BASE;

/**
 * URL for the raw bytes of an uploaded source. Returns a URL (not a blob)
 * so `<img>` and `<iframe>` tags can load it directly. The backend streams
 * the original upload back with the right Content-Type so PDFs render
 * inline and images show without a download prompt.
 */
export function sourceContentUrl(sourceId: UUID): string {
  return `${API_BASE}/api/sources/${encodeURIComponent(sourceId)}/content`;
}

/**
 * URL for a single rendered page of a PDF source as PNG. Backed by
 * `pypdfium2` on the server, with a per-(sha256, page) LRU cache so
 * the ScannerOverlay can ping the same page repeatedly as it cycles
 * without hammering pdfium.
 *
 * Page number is **1-indexed** to match the way users (and prompts)
 * talk about menus: "page 3 of 17". Only works for sources whose
 * kind === 'pdf'; requesting a page for an image source returns 404.
 */
export function sourcePageUrl(sourceId: UUID, page: number): string {
  const n = Math.max(1, Math.floor(page));
  return `${API_BASE}/api/sources/${encodeURIComponent(sourceId)}/page/${n}.png`;
}

/**
 * URL of the exportable dish-graph JSON for a processing run.
 * Browser download target for the "Export JSON" button in TryIt — the
 * backend sets `Content-Disposition: attachment` so the click saves the
 * file instead of navigating the page.
 */
export function catalogUrl(processingId: UUID): string {
  return `${API_BASE}/api/catalog/${encodeURIComponent(processingId)}.json`;
}

export class ApiError extends Error {
  readonly status: number;
  /**
   * The human-readable error message extracted from the response body
   * (FastAPI's `{detail: "..."}`), or null if the body wasn't JSON.
   * Callers should prefer this over `.message` for user-facing UI —
   * `.message` includes the request path and status code, which reads
   * like developer chrome to end users.
   */
  readonly detail: string | null;
  constructor(message: string, status: number, detail: string | null = null) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, init);
  if (!resp.ok) {
    // Best-effort read of the error body. FastAPI returns
    // `{ "detail": "..." }` on HTTPException; if the body is empty or
    // not JSON (CORS preflight, network error pages, etc.) we just
    // don't attach a `detail` and the UI falls back to the generic
    // status message. `response.clone()` isn't needed because we only
    // read the body once and don't return the response downstream.
    let detail: string | null = null;
    try {
      const body = await resp.json();
      const raw = (body as { detail?: unknown }).detail;
      if (typeof raw === 'string' && raw.trim()) {
        detail = raw;
      }
    } catch {
      /* body wasn't JSON — that's fine, detail stays null */
    }
    throw new ApiError(
      `${init?.method ?? 'GET'} ${path} → ${resp.status}`,
      resp.status,
      detail,
    );
  }
  return (await resp.json()) as T;
}

export interface UploadBatch {
  id: UUID;
  sources: unknown[];
  uploaded_at: string;
}

export async function apiHealth(): Promise<{ status: string; version: string; model: string }> {
  return request('/api/health');
}

export async function apiUpload(files: File[]): Promise<UploadBatch> {
  const form = new FormData();
  for (const f of files) form.append('files', f, f.name);
  return request('/api/upload', { method: 'POST', body: form });
}

/**
 * Kick off extraction for an uploaded batch. `userInstructions`, when
 * provided, is a short free-text directive passed to Opus alongside the
 * evidence on each page — "Exclude beverages", "Only pizzas", "Ignore
 * daily specials". Whitespace-only input is ignored by the backend.
 */
export async function apiStartProcessing(
  batchId: UUID,
  userInstructions?: string,
): Promise<{ processing_id: UUID }> {
  const trimmed = (userInstructions ?? '').trim();
  const init: RequestInit = trimmed
    ? {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_instructions: trimmed }),
      }
    : { method: 'POST' };
  return request(`/api/process/${encodeURIComponent(batchId)}`, init);
}

export async function apiGetProcessing(processingId: UUID): Promise<ProcessingRun> {
  return request(`/api/process/${encodeURIComponent(processingId)}`);
}

export async function apiGetReview(processingId: UUID): Promise<CockpitState> {
  return request(`/api/review/${encodeURIComponent(processingId)}`);
}

export type TargetKind = 'canonical' | 'modifier' | 'ephemeral';
export type Action = 'approve' | 'edit' | 'reject';

// ---------- Natural-language search ----------

export type SearchMatchedOn =
  | 'alias'
  | 'search_term'
  | 'canonical_name'
  | 'ingredient'
  | 'menu_category'
  | 'modifier'
  | 'semantic_inference';

export interface SearchMatch {
  dish_id: UUID;
  score: number;
  reason: string;
  matched_on: SearchMatchedOn[];
}

export interface SearchResult {
  query: string;
  interpretation: string;
  matches: SearchMatch[];
  used_adaptive_thinking: boolean;
  latency_ms: number;
  model: string;
}

export async function apiSearch(
  processingId: UUID,
  body: { query: string; top_k?: number },
): Promise<SearchResult> {
  return request(`/api/search/${encodeURIComponent(processingId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiPostDecision(
  processingId: UUID,
  body: {
    target_kind: TargetKind;
    target_id: UUID;
    action: Action;
    edit?: Record<string, unknown>;
  },
): Promise<CockpitState> {
  return request(`/api/review/${encodeURIComponent(processingId)}/decisions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------- Helpers ----------

export function moderationFromAction(action: Action): ModerationStatus {
  return action === 'approve' ? 'approved' : action === 'edit' ? 'edited' : 'rejected';
}
