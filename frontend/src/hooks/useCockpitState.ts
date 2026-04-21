import { useCallback, useEffect, useRef, useState } from 'react';

import {
  apiGetReview,
  apiPostDecision,
  moderationFromAction,
  type Action,
  type TargetKind,
} from '../api/client';
import type {
  CockpitState,
  ModerationStatus,
  UUID,
} from '../domain/types';
import { mockCockpit } from '../mocks/cockpit';

export type ModerateTargetKind = TargetKind;

export interface UseCockpit {
  state: CockpitState;
  moderate: (kind: ModerateTargetKind, id: UUID, status: ModerationStatus) => void;
  reload: () => Promise<void>;
  source: 'mock' | 'api';
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
export function useCockpitState(processingId: UUID | null = null): UseCockpit {
  const [state, setState] = useState<CockpitState>(mockCockpit);
  const [source, setSource] = useState<'mock' | 'api'>('mock');
  const currentProcessingId = useRef(processingId);

  useEffect(() => {
    currentProcessingId.current = processingId;
    if (processingId === null) {
      setState(mockCockpit);
      setSource('mock');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const fetched = await apiGetReview(processingId);
        if (cancelled) return;
        setState(fetched);
        setSource('api');
      } catch (err) {
        // Backend unreachable or run not found — fall back to mock so the demo still runs.
        if (!cancelled) {
          console.warn('[mise] api unreachable, using mock cockpit state', err);
          setState(mockCockpit);
          setSource('mock');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [processingId]);

  const reload = useCallback(async () => {
    const pid = currentProcessingId.current;
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
      const pid = currentProcessingId.current;
      const action = actionFromStatus(status);

      if (pid !== null && action !== null) {
        void (async () => {
          try {
            const updated = await apiPostDecision(pid, {
              target_kind: kind,
              target_id: id,
              action,
            });
            setState(updated);
            setSource('api');
            return;
          } catch (err) {
            console.warn('[mise] decision POST failed, applying optimistic local update', err);
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
