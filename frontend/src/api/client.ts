// Typed client for the Mise FastAPI backend.
// Mirrors the contract in docs/plans/2026-04-22-architecture.md §3.
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

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, init);
  if (!resp.ok) {
    throw new ApiError(
      `${init?.method ?? 'GET'} ${path} → ${resp.status}`,
      resp.status,
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

export async function apiStartProcessing(batchId: UUID): Promise<{ processing_id: UUID }> {
  return request(`/api/process/${encodeURIComponent(batchId)}`, { method: 'POST' });
}

export async function apiGetProcessing(processingId: UUID): Promise<ProcessingRun> {
  return request(`/api/process/${encodeURIComponent(processingId)}`);
}

export async function apiGetReview(processingId: UUID): Promise<CockpitState> {
  return request(`/api/review/${encodeURIComponent(processingId)}`);
}

export type TargetKind = 'canonical' | 'modifier' | 'ephemeral';
export type Action = 'approve' | 'edit' | 'reject';

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
