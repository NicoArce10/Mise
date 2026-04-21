import { useCallback, useState } from 'react';
import type {
  CockpitState,
  ModerationStatus,
  UUID,
} from '../domain/types';
import { mockCockpit } from '../mocks/cockpit';

export type ModerateTargetKind = 'canonical' | 'modifier' | 'ephemeral';

export interface UseCockpit {
  state: CockpitState;
  moderate: (kind: ModerateTargetKind, id: UUID, status: ModerationStatus) => void;
}

export function useCockpitState(): UseCockpit {
  const [state, setState] = useState<CockpitState>(mockCockpit);

  const moderate = useCallback(
    (kind: ModerateTargetKind, id: UUID, status: ModerationStatus) => {
      setState(prev => {
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
        // kind === 'modifier' — unattached modifiers lane uses this in a later iteration;
        // for now the mock does not expose modifier-level moderation actions.
        return prev;
      });
    },
    [],
  );

  return { state, moderate };
}
