import { useMemo, useState } from 'react';
import type { CanonicalDish, CockpitState } from '../domain/types';
import { EphemeralCard } from '../components/EphemeralCard';
import { TopBar } from '../components/TopBar';
import { EvidenceRail } from '../components/EvidenceRail';
import { DetailRail } from '../components/DetailRail';
import { MetricsPane } from '../components/MetricsPane';
import { UnattachedModifiersLane } from '../components/UnattachedModifiersLane';
import { CockpitToolbar, type ViewDensity } from '../components/CockpitToolbar';
import { DishCategoryGroup } from '../components/DishCategoryGroup';
import type { ModerateTargetKind } from '../hooks/useCockpitState';

interface Props {
  state: CockpitState;
  onModerate: (kind: ModerateTargetKind, id: string, status: 'approved' | 'edited' | 'rejected') => void;
  onPresent: () => void;
  onRestart: () => void;
}

const CATEGORY_ORDER = [
  'pizza', 'calzone', 'pasta', 'gnudi', 'toast', 'tartare',
  'taco', 'quesadilla', 'burrito',
  'salad', 'soup', 'sandwich', 'burger',
  'fish', 'halibut', 'salmon', 'chicken', 'pork', 'lamb', 'rib', 'steak',
  'dessert', 'unknown',
] as const;

function prettyCategoryLabel(raw: string): string {
  if (!raw || raw === 'unknown') return 'Other';
  const known: Record<string, string> = {
    pizza: 'Pizzas',
    calzone: 'Calzones',
    pasta: 'Pasta',
    gnudi: 'Gnudi',
    toast: 'Toasts',
    tartare: 'Tartares',
    taco: 'Tacos',
    quesadilla: 'Quesadillas',
    burrito: 'Burritos',
    salad: 'Salads',
    soup: 'Soups',
    sandwich: 'Sandwiches',
    burger: 'Burgers',
    fish: 'Fish',
    halibut: 'Fish',
    salmon: 'Fish',
    chicken: 'Chicken',
    pork: 'Pork',
    lamb: 'Lamb',
    rib: 'Ribs',
    steak: 'Steaks',
    dessert: 'Desserts',
  };
  return known[raw] ?? raw[0].toUpperCase() + raw.slice(1);
}

function inferDishCategory(dish: CanonicalDish): string {
  const lower = (dish.canonical_name + ' ' + dish.aliases.join(' ')).toLowerCase();
  for (const key of CATEGORY_ORDER) {
    if (lower.includes(key)) return key;
  }
  return 'unknown';
}

function matchesQuery(dish: CanonicalDish, q: string): boolean {
  if (!q) return true;
  const hay = [
    dish.canonical_name,
    ...dish.aliases,
    ...dish.ingredients,
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

function downloadJSON(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function Cockpit({ state, onModerate, onPresent, onRestart }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    state.canonical_dishes[0]?.id ?? '',
  );
  const [query, setQuery] = useState('');
  // Auto-density: compact when the catalog is busy.
  const [density, setDensity] = useState<ViewDensity>(
    state.canonical_dishes.length > 10 ? 'compact' : 'card',
  );

  const selected = state.canonical_dishes.find(d => d.id === selectedId) ?? null;

  const filtered = useMemo(
    () => state.canonical_dishes.filter(d => matchesQuery(d, query)),
    [state.canonical_dishes, query],
  );

  const byCategory = useMemo(() => {
    const buckets: Record<string, CanonicalDish[]> = {};
    for (const d of filtered) {
      const cat = inferDishCategory(d);
      (buckets[cat] = buckets[cat] ?? []).push(d);
    }
    return buckets;
  }, [filtered]);

  const sortedCategories = useMemo(() => {
    const present = Object.keys(byCategory);
    const known = CATEGORY_ORDER.filter(c => present.includes(c));
    const extra = present.filter(c => !CATEGORY_ORDER.includes(c as never));
    return [...known, ...extra];
  }, [byCategory]);

  const handleExport = () => {
    const canonicalPack = {
      exported_at: new Date().toISOString(),
      processing_id: state.processing.id,
      source_count: state.sources.length,
      canonical_dishes: state.canonical_dishes.map(d => ({
        canonical_name: d.canonical_name,
        aliases: d.aliases,
        ingredients: d.ingredients,
        source_ids: d.source_ids,
        modifier_ids: d.modifier_ids,
        decision: d.decision,
        moderation: d.moderation,
      })),
      modifiers: state.modifiers,
      ephemerals: state.ephemerals.map(e => ({
        text: e.text,
        source_ids: e.source_ids,
        decision: e.decision,
        moderation: e.moderation,
      })),
    };
    downloadJSON(`mise-canonical-pack-${state.processing.id}.json`, canonicalPack);
  };

  const hasDishes = state.canonical_dishes.length > 0;
  const processingFailed = state.processing.state === 'failed';

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
        <section className="flex min-w-0 flex-col gap-6 px-8 py-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h1
                className="font-display"
                style={{
                  fontWeight: 500,
                  fontSize: 32,
                  lineHeight: '36px',
                  color: 'var(--color-ink)',
                }}
              >
                Review pack
              </h1>
              <span
                className="font-mono"
                style={{ fontSize: 13, color: 'var(--color-ink-subtle)' }}
              >
                {state.canonical_dishes.length} dish{state.canonical_dishes.length === 1 ? '' : 'es'} ·{' '}
                {state.modifiers.length} mod · {state.ephemerals.length} eph
              </span>
            </div>
            {state.processing.state_detail && (
              <p
                className="caption"
                style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
              >
                {state.processing.state_detail}
              </p>
            )}
          </div>

          <CockpitToolbar
            query={query}
            onQueryChange={setQuery}
            density={density}
            onDensityChange={setDensity}
            dishCount={state.canonical_dishes.length}
            filteredCount={filtered.length}
            onExport={handleExport}
          />

          {!hasDishes && processingFailed && (
            <div
              className="flex flex-col gap-2"
              style={{
                background: 'var(--color-paper-tint)',
                border: '1px dashed var(--color-sienna)',
                borderRadius: 'var(--radius-card)',
                padding: 24,
              }}
            >
              <p
                className="font-display"
                style={{ fontWeight: 500, fontSize: 20, lineHeight: '26px', color: 'var(--color-sienna)' }}
              >
                Pipeline error
              </p>
              <p style={{ color: 'var(--color-ink-muted)' }}>
                No dishes were extracted from the uploaded evidence. Check the backend logs and try again.
              </p>
            </div>
          )}

          {!hasDishes && !processingFailed && (
            <div
              className="flex flex-col gap-2"
              style={{
                background: 'var(--color-paper-tint)',
                border: '1px dashed var(--color-hairline)',
                borderRadius: 'var(--radius-card)',
                padding: 24,
              }}
            >
              <p
                className="font-display"
                style={{ fontWeight: 500, fontSize: 20, lineHeight: '26px' }}
              >
                Nothing to review yet
              </p>
              <p style={{ color: 'var(--color-ink-muted)' }}>
                Upload a batch of evidence and Mise will surface dishes here.
              </p>
            </div>
          )}

          {hasDishes && sortedCategories.map(cat => (
            <DishCategoryGroup
              key={cat}
              label={prettyCategoryLabel(cat)}
              count={byCategory[cat].length}
              density={density}
              dishes={byCategory[cat]}
              sources={state.sources}
              modifiers={state.modifiers}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onModerate={(id, status) => onModerate('canonical', id, status)}
            />
          ))}

          <UnattachedModifiersLane modifiers={state.modifiers} />

          {state.ephemerals.length > 0 && (
            <section className="flex flex-col gap-4">
              <div
                className="flex items-baseline gap-3"
                style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: 8 }}
              >
                <h2
                  className="font-display"
                  style={{ fontWeight: 500, fontSize: 22, lineHeight: '28px' }}
                >
                  Ephemeral
                </h2>
                <span
                  className="font-mono"
                  style={{ fontSize: 12, color: 'var(--color-ink-subtle)' }}
                >
                  {state.ephemerals.length}
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
