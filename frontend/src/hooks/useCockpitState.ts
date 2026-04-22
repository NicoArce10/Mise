import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  apiGetReview,
  apiPostDecision,
  moderationFromAction,
  type Action,
  type TargetKind,
} from '../api/client';
import type {
  CockpitState,
  MetricsPreview,
  ModerationStatus,
  ProcessingRun,
  ProcessingState,
  UUID,
} from '../domain/types';
import { mockCockpit } from '../mocks/cockpit';

export type ModerateTargetKind = TargetKind;

export type CockpitMode =
  | { kind: 'empty' }
  | { kind: 'sample' }
  | { kind: 'live'; processingId: UUID };

export interface UseCockpit {
  state: CockpitState;
  moderate: (kind: ModerateTargetKind, id: UUID, status: ModerationStatus) => void;
  reload: () => Promise<void>;
  source: 'empty' | 'sample' | 'api';
}

function emptyState(): CockpitState {
  const now = new Date().toISOString();
  const run: ProcessingRun = {
    id: 'empty',
    batch_id: 'empty',
    state: 'ready' as ProcessingState,
    state_detail: null,
    adaptive_thinking_pairs: 0,
    started_at: now,
    ready_at: now,
    recent_dishes: [],
  };
  const metrics: MetricsPreview = {
    sources_ingested: 0,
    canonical_count: 0,
    modifier_count: 0,
    ephemeral_count: 0,
    merge_precision: null,
    non_merge_accuracy: null,
    time_to_review_pack_seconds: null,
  };
  return {
    processing: run,
    sources: [],
    canonical_dishes: [],
    modifiers: [],
    ephemerals: [],
    reconciliation_trace: [],
    metrics_preview: metrics,
  };
}

const actionFromStatus = (status: ModerationStatus): Action | null => {
  if (status === 'approved') return 'approve';
  if (status === 'rejected') return 'reject';
  if (status === 'edited') return 'edit';
  return null;
};

/**
 * Cockpit state hook.
 *
 * - If `processingId` is null the hook runs in local-mock mode (M2 behaviour).
 * - If `processingId` is set, the hook fetches `GET /api/review/{id}` on mount
 *   and on every explicit `reload()`. Moderation writes are POSTed to the
 *   backend and the server-returned `CockpitState` replaces local state.
 *
 * If the first fetch fails the hook falls back to the mock so the demo
 * survives even if the backend is offline.
 */
export function useCockpitState(mode: CockpitMode = { kind: 'empty' }): UseCockpit {
  // Pick the initial state from the mode so the first paint matches intent
  // (empty = no ghost dishes while mounting, sample = italian fixture, live = empty until fetch resolves).
  const initial = useMemo<CockpitState>(() => {
    if (mode.kind === 'sample') return mockCockpit;
    return emptyState();
  }, [mode.kind]);
  const [state, setState] = useState<CockpitState>(initial);
  const [source, setSource] = useState<'empty' | 'sample' | 'api'>(
    mode.kind === 'sample' ? 'sample' : 'empty',
  );
  const processingIdRef = useRef<UUID | null>(
    mode.kind === 'live' ? mode.processingId : null,
  );

  useEffect(() => {
    if (mode.kind === 'sample') {
      setState(mockCockpit);
      setSource('sample');
      processingIdRef.current = null;
      return;
    }
    if (mode.kind === 'empty') {
      setState(emptyState());
      setSource('empty');
      processingIdRef.current = null;
      return;
    }
    // live
    const pid = mode.processingId;
    processingIdRef.current = pid;
    let cancelled = false;
    void (async () => {
      try {
        const fetched = await apiGetReview(pid);
        if (cancelled) return;
        setState(fetched);
        setSource('api');
      } catch (err) {
        if (!cancelled) {
          console.warn('[mise] api unreachable, showing empty cockpit', err);
          setState(emptyState());
          setSource('empty');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode.kind, mode.kind === 'live' ? mode.processingId : null]);

  const reload = useCallback(async () => {
    const pid = processingIdRef.current;
    if (pid === null) return;
    try {
      const fetched = await apiGetReview(pid);
      setState(fetched);
      setSource('api');
    } catch (err) {
      console.warn('[mise] reload failed', err);
    }
  }, []);

  const moderate = useCallback(
    (kind: ModerateTargetKind, id: UUID, status: ModerationStatus) => {
      const pid = processingIdRef.current;
      const action = actionFromStatus(status);

      if (pid !== null && action !== null) {
        console.info('[mise] moderate →', { kind, id, action, processingId: pid });
        void (async () => {
          try {
            const updated = await apiPostDecision(pid, {
              target_kind: kind,
              target_id: id,
              action,
            });
            console.info('[mise] moderate OK — dish now', {
              id,
              newModeration: status,
            });
            setState(updated);
            setSource('api');
            return;
          } catch (err) {
            console.error('[mise] decision POST failed, falling back to local-only update', err);
          }
          // fallthrough to local update
          setState(applyLocalModeration(state, kind, id, status));
        })();
        return;
      }

      // Mock-only path
      setState(prev => applyLocalModeration(prev, kind, id, status));
    },
    [state],
  );

  return { state, moderate, reload, source };
}

function applyLocalModeration(
  prev: CockpitState,
  kind: ModerateTargetKind,
  id: UUID,
  status: ModerationStatus,
): CockpitState {
  if (kind === 'canonical') {
    return {
      ...prev,
      canonical_dishes: prev.canonical_dishes.map(d =>
        d.id === id ? { ...d, moderation: status } : d,
      ),
    };
  }
  if (kind === 'ephemeral') {
    return {
      ...prev,
      ephemerals: prev.ephemerals.map(e =>
        e.id === id ? { ...e, moderation: status } : e,
      ),
    };
  }
  // Modifiers — lane shows them but moderation is not exposed in M3.
  return prev;
}

// Re-export mock so views can reference it for cache-busting if needed.
export { moderationFromAction };
