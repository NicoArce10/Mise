import type { CockpitState } from '../domain/types';
import { CanonicalDishCard } from '../components/CanonicalDishCard';
import { EphemeralCard } from '../components/EphemeralCard';
import { TopBar } from '../components/TopBar';
import { EvidenceRail } from '../components/EvidenceRail';
import { DetailRail } from '../components/DetailRail';
import { MetricsPane } from '../components/MetricsPane';
import { UnattachedModifiersLane } from '../components/UnattachedModifiersLane';
import type { ModerateTargetKind } from '../hooks/useCockpitState';
import { useState } from 'react';

interface Props {
  state: CockpitState;
  onModerate: (kind: ModerateTargetKind, id: string, status: 'approved' | 'edited' | 'rejected') => void;
  onPresent: () => void;
  onRestart: () => void;
}

export function Cockpit({ state, onModerate, onPresent, onRestart }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    state.canonical_dishes[0]?.id ?? '',
  );
  const selected = state.canonical_dishes.find(d => d.id === selectedId) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        adaptivePairs={state.processing.adaptive_thinking_pairs}
        onPresent={onPresent}
        onRestart={onRestart}
      />
      <main
        className="grid flex-1"
        style={{
          gridTemplateColumns: '280px minmax(0,1fr) 360px',
          gap: 0,
        }}
      >
        <EvidenceRail sources={state.sources} />
        <section className="flex flex-col gap-8 px-10 py-10">
          <div className="flex items-baseline justify-between">
            <h1
              className="font-display"
              style={{
                fontWeight: 500,
                fontSize: 40,
                lineHeight: '44px',
                color: 'var(--color-ink)',
              }}
            >
              Review pack
            </h1>
            <p
              className="caption"
              style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
            >
              {state.processing.state_detail}
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {state.canonical_dishes.map(dish => (
              <div
                key={dish.id}
                onClick={() => setSelectedId(dish.id)}
                style={{ cursor: 'pointer' }}
                data-testid={`dish-${dish.canonical_name}`}
              >
                <CanonicalDishCard
                  dish={dish}
                  sources={state.sources}
                  modifiers={state.modifiers}
                  onModerate={status => onModerate('canonical', dish.id, status)}
                />
              </div>
            ))}
          </div>

          <UnattachedModifiersLane modifiers={state.modifiers} />

          {state.ephemerals.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-baseline gap-3">
                <h2
                  className="font-display"
                  style={{ fontWeight: 500, fontSize: 28, lineHeight: '32px' }}
                >
                  Ephemeral
                </h2>
                <span
                  className="caption"
                  style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
                >
                  ROUTED
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {state.ephemerals.map(eph => (
                  <EphemeralCard
                    key={eph.id}
                    item={eph}
                    sources={state.sources}
                    onModerate={status => onModerate('ephemeral', eph.id, status)}
                  />
                ))}
              </div>
            </section>
          )}

          {state.metrics_preview && <MetricsPane metrics={state.metrics_preview} />}
        </section>
        <DetailRail dish={selected} trace={state.reconciliation_trace} sources={state.sources} />
      </main>
    </div>
  );
}
