import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { CanonicalDish, CockpitState } from '../domain/types';
import { EphemeralCard } from '../components/EphemeralCard';
import { TopBar } from '../components/TopBar';
import { EvidenceRail } from '../components/EvidenceRail';
import { DetailRail } from '../components/DetailRail';
import { MetricsPane } from '../components/MetricsPane';
import { UnattachedModifiersLane } from '../components/UnattachedModifiersLane';
import { CockpitToolbar, type ViewDensity } from '../components/CockpitToolbar';
import { DishCategoryGroup } from '../components/DishCategoryGroup';
import { EditorialMeta } from '../components/EditorialMeta';
import { HelpDialog } from '../components/HelpDialog';
import { ExtractionDetailDialog } from '../components/ExtractionDetailDialog';
import { useShortcuts } from '../hooks/useShortcuts';
import type { ModerateTargetKind } from '../hooks/useCockpitState';

interface Props {
  state: CockpitState;
  onModerate: (kind: ModerateTargetKind, id: string, status: 'approved' | 'edited' | 'rejected') => void;
  onPresent: () => void;
  onRestart: () => void;
  onUpload: () => void;
  onLoadSample: () => void;
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

export function Cockpit({
  state,
  onModerate,
  onPresent,
  onRestart,
  onUpload,
  onLoadSample,
}: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    state.canonical_dishes[0]?.id ?? '',
  );
  const [query, setQuery] = useState('');
  const [density, setDensity] = useState<ViewDensity>(
    state.canonical_dishes.length > 10 ? 'compact' : 'card',
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selected = state.canonical_dishes.find(d => d.id === selectedId) ?? null;

  const filtered = useMemo(
    () => state.canonical_dishes.filter(d => matchesQuery(d, query)),
    [state.canonical_dishes, query],
  );

  const moveSelection = useCallback(
    (direction: 1 | -1) => {
      if (filtered.length === 0) return;
      const idx = filtered.findIndex(d => d.id === selectedId);
      const nextIdx =
        idx === -1
          ? 0
          : (idx + direction + filtered.length) % filtered.length;
      const next = filtered[nextIdx];
      if (next) setSelectedId(next.id);
    },
    [filtered, selectedId],
  );

  const moderateSelected = useCallback(
    (status: 'approved' | 'edited' | 'rejected') => {
      if (!selected) return;
      onModerate('canonical', selected.id, status);
    },
    [onModerate, selected],
  );

  useShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onNextDish: () => moveSelection(1),
    onPrevDish: () => moveSelection(-1),
    onOpenDetail: () => {
      if (!selected) return;
      // Scroll the selected dish into view so the DetailRail context is clear.
      const el = document.querySelector(
        `[data-testid="dish-${CSS.escape(selected.canonical_name)}"]`,
      );
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    onEscape: () => {
      if (helpOpen) setHelpOpen(false);
      else if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    onApprove: () => moderateSelected('approved'),
    onEdit: () => moderateSelected('edited'),
    onReject: () => moderateSelected('rejected'),
    onToggleDensity: () =>
      setDensity(d => (d === 'card' ? 'compact' : 'card')),
    onShowHelp: () => setHelpOpen(true),
  });

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
  const hasAnything =
    hasDishes ||
    state.modifiers.length > 0 ||
    state.ephemerals.length > 0;
  const processingFailed = state.processing.state === 'failed';
  // `empty` mode fires before any batch has been processed (no sources, no
  // processing id). The live-upload-with-0-dishes bug is the opposite: there
  // ARE sources but Opus returned nothing — that's the case we explain.
  const hasSources = state.sources.length > 0;
  const extractionEmpty =
    !hasAnything && !processingFailed && hasSources;
  const coldStart = !hasAnything && !processingFailed && !hasSources;

  // Shared button tokens — kept inline so this file stays the only surface
  // that renders the Cockpit recovery states. If we need another empty
  // state later we'll hoist these.
  const primaryBtn: CSSProperties = {
    background: 'var(--color-ink)',
    color: 'var(--color-paper)',
    border: '1px solid var(--color-ink)',
    borderRadius: 'var(--radius-chip)',
    padding: '10px 18px',
    fontSize: 14,
    lineHeight: '18px',
    letterSpacing: '0.02em',
    cursor: 'pointer',
  };
  const secondaryBtn: CSSProperties = {
    background: 'transparent',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-hairline)',
    borderRadius: 'var(--radius-chip)',
    padding: '10px 18px',
    fontSize: 14,
    lineHeight: '18px',
    letterSpacing: '0.02em',
    cursor: 'pointer',
  };

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
          <div className="flex flex-col gap-2">
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
            <EditorialMeta state={state} />
          </div>

          <CockpitToolbar
            ref={searchInputRef}
            query={query}
            onQueryChange={setQuery}
            density={density}
            onDensityChange={setDensity}
            dishCount={state.canonical_dishes.length}
            filteredCount={filtered.length}
            onExport={handleExport}
            onShowHelp={() => setHelpOpen(true)}
          />

          {processingFailed && (
            <div
              className="flex flex-col gap-4"
              style={{
                background: 'var(--color-paper-tint)',
                border: '1px dashed var(--color-sienna)',
                borderRadius: 'var(--radius-card)',
                padding: 28,
              }}
            >
              <div className="flex flex-col gap-2">
                <span
                  className="caption"
                  style={{ color: 'var(--color-sienna)', letterSpacing: '0.04em' }}
                >
                  PIPELINE FAILED
                </span>
                <p
                  className="font-display"
                  style={{
                    fontWeight: 500,
                    fontSize: 24,
                    lineHeight: '30px',
                    color: 'var(--color-ink)',
                  }}
                >
                  Mise couldn't finish this run.
                </p>
                <p
                  style={{
                    color: 'var(--color-ink-muted)',
                    fontSize: 15,
                    lineHeight: '22px',
                    maxWidth: 560,
                  }}
                >
                  {state.processing.state_detail
                    ? state.processing.state_detail
                    : 'The pipeline raised an error before producing any dishes. Check the backend terminal for [mise] lines to see what broke.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDetailOpen(true)}
                  style={secondaryBtn}
                >
                  Show extraction detail
                </button>
                <button
                  type="button"
                  onClick={onUpload}
                  style={primaryBtn}
                >
                  Upload different files
                </button>
              </div>
            </div>
          )}

          {extractionEmpty && (
            <div
              className="flex flex-col gap-4"
              style={{
                background: 'var(--color-paper-tint)',
                border: '1px dashed var(--color-hairline)',
                borderRadius: 'var(--radius-card)',
                padding: 28,
              }}
            >
              <div className="flex flex-col gap-2">
                <span
                  className="caption"
                  style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
                >
                  NO DISHES FOUND
                </span>
                <p
                  className="font-display"
                  style={{
                    fontWeight: 500,
                    fontSize: 24,
                    lineHeight: '30px',
                    color: 'var(--color-ink)',
                  }}
                >
                  No dishes extracted from these sources.
                </p>
                <p
                  style={{
                    color: 'var(--color-ink-muted)',
                    fontSize: 15,
                    lineHeight: '22px',
                    maxWidth: 560,
                  }}
                >
                  Opus 4.7 read the file{state.sources.length === 1 ? '' : 's'} but didn't surface any
                  dish candidates. This usually means the menu is blurry,
                  handwritten in a hard-to-read font, or the image is low
                  resolution. Try a sharper photo, or load the built-in sample
                  to see how a clean run looks.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDetailOpen(true)}
                  style={secondaryBtn}
                >
                  Show extraction detail
                </button>
                <button
                  type="button"
                  onClick={onLoadSample}
                  style={secondaryBtn}
                >
                  Try the sample menu
                </button>
                <button
                  type="button"
                  onClick={onUpload}
                  style={primaryBtn}
                >
                  Upload different files
                </button>
              </div>
            </div>
          )}

          {coldStart && (
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
              batchId={state.processing.batch_id}
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
        <AnimatePresence mode="wait">
          <motion.div
            key={selected?.id ?? 'empty'}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            style={{ minHeight: '100%' }}
          >
            <DetailRail dish={selected} trace={state.reconciliation_trace} sources={state.sources} />
          </motion.div>
        </AnimatePresence>
      </main>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ExtractionDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        processing={state.processing}
        sources={state.sources}
      />
    </div>
  );
}
