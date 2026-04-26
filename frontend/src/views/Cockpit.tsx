import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ModerationStatus, type CanonicalDish, type CockpitState } from '../domain/types';
import { EphemeralCard } from '../components/EphemeralCard';
import { TopBar } from '../components/TopBar';
import { EvidenceRail } from '../components/EvidenceRail';
import { DetailRail } from '../components/DetailRail';
import { MetricsPane } from '../components/MetricsPane';
import { QualitySignalPane } from '../components/QualitySignalPane';
import { ReconciliationNarrative } from '../components/ReconciliationNarrative';
import { ExcludedByUserFilter } from '../components/ExcludedByUserFilter';
import { FilterAppliedBanner } from '../components/FilterAppliedBanner';
import { UnattachedModifiersLane } from '../components/UnattachedModifiersLane';
import { CockpitToolbar, type ViewDensity } from '../components/CockpitToolbar';
import { DishCategoryGroup } from '../components/DishCategoryGroup';
import { EditorialMeta } from '../components/EditorialMeta';
import { HelpDialog } from '../components/HelpDialog';
import { ExtractionDetailDialog } from '../components/ExtractionDetailDialog';
import { SourcePreviewModal } from '../components/SourcePreviewModal';
import { useShortcuts } from '../hooks/useShortcuts';
import type { DishEditPatch, ModerateTargetKind } from '../hooks/useCockpitState';
import { DishEditDialog } from '../components/DishEditDialog';
import { SaveToast, type SaveToastState } from '../components/SaveToast';
import { downloadCatalog } from '../api/exportCatalog';

interface Props {
  state: CockpitState;
  /**
   * Called when the reviewer approves / rejects / edits a dish. The
   * optional `patch` is only populated for EDIT actions — it carries
   * the fields that changed so the backend can persist them alongside
   * the new moderation status.
   */
  onModerate: (
    kind: ModerateTargetKind,
    id: string,
    status: 'approved' | 'edited' | 'rejected',
    patch?: DishEditPatch,
  ) => void;
  onRestart: () => void;
  onUpload: () => void;
  onLoadSample: () => void;
  onOpenTryIt?: () => void;
}

// Preferred display order for category buckets in the catalog. The list
// is intentionally multilingual + multi-cuisine: a single demo can show
// an Argentine bistró (parrilla, empanadas, milanesa), an Italian
// pizzeria (pizze, primi, dolci), an American burger joint (burgers,
// sides, salads), a Mexican taquería (tacos, burritos), a French bistrot
// (entrées, plats), a Japanese izakaya (sushi, ramen). Anything not in
// this list keeps its raw label and is appended after the known order so
// no menu category is ever silently lost.
//
// Lowercase keys for the lookup; the source-of-truth comes from
// `dish.menu_category` (Opus extracts it from the menu itself), not a
// keyword search on the dish name. Falling back to name-keyword
// inference is only the last resort for legacy/sparse extractions.
const CATEGORY_ORDER_KEYS = [
  'starters', 'antipasti', 'entradas', 'entrées', 'appetizers', 'tapas',
  'soups', 'soup', 'zuppe', 'sopas',
  'salads', 'salad', 'insalate', 'ensaladas',
  'pizzas', 'pizza', 'pizze', 'calzones', 'calzone',
  'pastas', 'pasta', 'primi', 'noodles', 'ramen',
  'tacos', 'taco', 'quesadillas', 'quesadilla', 'burritos', 'burrito',
  'sandwiches', 'sandwich', 'lomitos', 'lomito',
  'burgers', 'burger', 'hamburguesas',
  'mains', 'main', 'plats', 'secondi', 'principales', 'platos fuertes',
  'parrilla', 'parrillada', 'asado', 'carnes', 'carne', 'meat',
  'pescados', 'pesce', 'fish', 'mariscos', 'seafood', 'sushi',
  'aves', 'pollo', 'chicken',
  'cerdo', 'pork',
  'cordero', 'lamb',
  'empanadas', 'empanada',
  'milanesas', 'milanesa',
  'shared', 'compartir', 'tablas', 'para compartir',
  'sides', 'guarniciones', 'contorni', 'acompañamientos',
  'desserts', 'dessert', 'postres', 'postre', 'dolci', 'dolce',
  'beverages', 'drinks', 'bebidas', 'bebida', 'cocktails', 'wines', 'vinos',
  'specials', 'especiales', 'daily',
  'other', 'otros', 'unknown',
] as const;

const CATEGORY_KEY_INDEX = new Map<string, number>(
  CATEGORY_ORDER_KEYS.map((k, i) => [k, i]),
);

function prettyCategoryLabel(raw: string): string {
  if (!raw) return 'Other';
  const norm = raw.trim();
  if (!norm || norm.toLowerCase() === 'unknown' || norm.toLowerCase() === 'other') {
    return 'Other';
  }
  // Title-case while preserving accents and punctuation. Most menu
  // categories from Opus already arrive Title Cased ("Pizze", "Postres",
  // "Plats principaux"); the ones that arrive lowercase (older fixtures,
  // mocks, manual edits) get cleaned up here.
  if (norm === norm.toLowerCase() || norm === norm.toUpperCase()) {
    return norm
      .split(/\s+/)
      .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
      .join(' ');
  }
  return norm;
}

/** Choose the bucket key for grouping a dish in the Catalog view.
 *
 *   1. Trust `dish.menu_category` (Opus extracts this directly from the
 *      uploaded menu — "Pizze", "Postres", "Burgers") — that is the
 *      single source of truth. Mismatched casing is normalized so
 *      "Pizze" / "pizze" / "PIZZE" all bucket together.
 *   2. Fall back to keyword inference on the canonical name only when
 *      the extraction did not produce a category. This guards legacy
 *      mock data and mid-rollback runs.
 */
function dishBucketKey(dish: CanonicalDish): string {
  const fromExtraction = (dish.menu_category ?? '').trim();
  if (fromExtraction) return fromExtraction.toLowerCase();
  const lower = (dish.canonical_name + ' ' + dish.aliases.join(' ')).toLowerCase();
  for (const key of CATEGORY_ORDER_KEYS) {
    if (lower.includes(key)) return key;
  }
  return 'other';
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

export function Cockpit({
  state,
  onModerate,
  onRestart,
  onUpload,
  onLoadSample,
  onOpenTryIt,
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
  const [previewOpen, setPreviewOpen] = useState(false);
  // Which dish is currently being edited in the inline dialog. `null`
  // means no dialog is open. We store the id (not the CanonicalDish)
  // so that if `state.canonical_dishes` updates (e.g. a save succeeded),
  // the dialog rerenders against the fresh data.
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  // Transient toast confirming a moderation write reached the store.
  // Before this, the Edit flow felt like a no-op — the dialog closed
  // and there was no obvious signal that the change was persisted and
  // would show up in the exported JSON. See `SaveToast`.
  const [saveToast, setSaveToast] = useState<SaveToastState | null>(null);
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

  // Wrap the host's `onModerate` so every successful write flashes a
  // toast. We can't await the actual persistence (the hook is
  // fire-and-forget), but posting the toast at call time is honest
  // enough — the hook only falls back to local-only updates if the
  // backend is unreachable, and in that case the UI already reflects
  // the local change. This keeps the reviewer's mental model simple:
  // "I clicked, the catalog changed, and a toast confirmed it".
  const moderateWithToast = useCallback(
    (
      kind: ModerateTargetKind,
      id: string,
      status: 'approved' | 'edited' | 'rejected',
      patch?: DishEditPatch,
    ) => {
      onModerate(kind, id, status, patch);
      const label = (() => {
        const dish = state.canonical_dishes.find(d => d.id === id);
        const name =
          (patch?.canonical_name && patch.canonical_name.trim()) ||
          dish?.canonical_name ||
          'item';
        if (status === 'approved') return `Approved: ${name}`;
        if (status === 'rejected')
          return `Rejected: ${name} — will be excluded from the export`;
        return `Saved: ${name} — changes will appear in the exported JSON`;
      })();
      setSaveToast({ message: label, key: Date.now() });
    },
    [onModerate, state.canonical_dishes],
  );

  // Route every "edit" action through the inline dialog. Approve / reject
  // still apply immediately — they're binary and don't need a form.
  const onDishModerate = useCallback(
    (id: string, status: 'approved' | 'edited' | 'rejected') => {
      if (status === 'edited') {
        setEditingDishId(id);
        return;
      }
      moderateWithToast('canonical', id, status);
    },
    [moderateWithToast],
  );

  const moderateSelected = useCallback(
    (status: 'approved' | 'edited' | 'rejected') => {
      if (!selected) return;
      onDishModerate(selected.id, status);
    },
    [onDishModerate, selected],
  );

  const editingDish =
    editingDishId == null
      ? null
      : state.canonical_dishes.find(d => d.id === editingDishId) ?? null;

  const onEditSave = useCallback(
    (patch: DishEditPatch) => {
      if (editingDishId == null) return;
      moderateWithToast('canonical', editingDishId, 'edited', patch);
      setEditingDishId(null);
    },
    [editingDishId, moderateWithToast],
  );

  // Bulk action: only targets dishes that are (a) in the current filtered
  // view and (b) still `pending`. We intentionally do NOT touch dishes
  // that the reviewer has already approved/edited/rejected — those are
  // deliberate decisions and shouldn't be overwritten by a "select all".
  const pendingVisible = useMemo(
    () => filtered.filter(d => d.moderation === ModerationStatus.PENDING),
    [filtered],
  );
  const bulkModerate = useCallback(
    (status: 'approved' | 'rejected') => {
      if (pendingVisible.length === 0) return;
      const verb = status === 'approved' ? 'Approve' : 'Reject';
      const scope = query.trim().length > 0 ? ' (matching the current filter)' : '';
      const ok = window.confirm(
        `${verb} ${pendingVisible.length} pending dish${
          pendingVisible.length === 1 ? '' : 'es'
        }${scope}?\n\nAlready-moderated dishes are left untouched.`,
      );
      if (!ok) return;
      for (const d of pendingVisible) {
        onModerate('canonical', d.id, status);
      }
      // Single summary toast instead of one per dish — N individual
      // toasts on a bulk action felt like a spam cascade.
      setSaveToast({
        message:
          status === 'approved'
            ? `Approved ${pendingVisible.length} dish${pendingVisible.length === 1 ? '' : 'es'}`
            : `Rejected ${pendingVisible.length} dish${pendingVisible.length === 1 ? '' : 'es'} — excluded from the export`,
        key: Date.now(),
      });
    },
    [pendingVisible, query, onModerate],
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

  // Bucket dishes by their menu_category (extracted by Opus). When two
  // dishes share the same category but with different casing
  // ("Pizze" vs "pizze"), they collapse into one bucket using the
  // first-seen pretty label so the Catalog never shows two near-identical
  // section headers.
  //
  // Honest fallback for unsectioned menus: if fewer than 20% of dishes
  // have a real `menu_category` from Opus (the common case for chalkboards,
  // single-page handouts, photos that crop into a menu), keyword bucketing
  // produces a misleading mix ("Salad (6)", "Burger (1)", "Other (30)")
  // that suggests structure the source doesn't have. We instead surface a
  // single "All dishes" bucket — that is what the menu actually looks like.
  // The `quality_signal.flags` already carries the `missing_categories`
  // signal for downstream consumers; the UI just stops pretending.
  const byCategory = useMemo(() => {
    const totalDishes = filtered.length;
    const dishesWithCategory = filtered.filter(
      (d) => (d.menu_category ?? '').trim().length > 0,
    ).length;
    const ratioWithCategory =
      totalDishes === 0 ? 0 : dishesWithCategory / totalDishes;
    const treatAsUnsectioned = totalDishes >= 5 && ratioWithCategory < 0.2;

    if (treatAsUnsectioned) {
      return {
        all: { label: 'All dishes', dishes: filtered.slice() },
      } as Record<string, { label: string; dishes: CanonicalDish[] }>;
    }

    const buckets: Record<string, { label: string; dishes: CanonicalDish[] }> =
      {};
    for (const d of filtered) {
      const key = dishBucketKey(d);
      const bucket = buckets[key];
      if (bucket) {
        bucket.dishes.push(d);
      } else {
        const rawLabel = (d.menu_category ?? '').trim() || key;
        buckets[key] = { label: prettyCategoryLabel(rawLabel), dishes: [d] };
      }
    }
    return buckets;
  }, [filtered]);

  const sortedCategories = useMemo(() => {
    const present = Object.keys(byCategory);
    return present.slice().sort((a, b) => {
      const ai = CATEGORY_KEY_INDEX.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bi = CATEGORY_KEY_INDEX.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      // Stable ordering for unknown categories: alphabetical, so the
      // section list doesn't shuffle every render.
      return a.localeCompare(b);
    });
  }, [byCategory]);

  // Single source of truth for the JSON export — shared with TryIt so both
  // surfaces produce an identical file. The helper honors the Reject button
  // (excludes rejected dishes from the export) and stamps approved/edited
  // dishes with a `review_status` field for downstream consumers.
  const handleExport = useCallback(() => {
    const pid = state.processing.id.startsWith('run-sample')
      ? 'sample'
      : state.processing.id;
    downloadCatalog(state, pid);
  }, [state]);

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
        dishCount={state.canonical_dishes.length}
        onExport={handleExport}
        canExport={state.canonical_dishes.length > 0}
        // The Mise word-mark goes home (to landing). The "New menu"
        // button goes to the uploader (/upload). These USED to share a
        // single callback which silently collided — clicking the
        // upload-new button sent the user to the marketing landing
        // mid-session, which looked broken.
        onGoHome={onRestart}
        onUploadNew={onUpload}
        onOpenTryIt={onOpenTryIt}
        onViewMenu={
          state.sources.length > 0 ? () => setPreviewOpen(true) : undefined
        }
        sampleMode={state.processing.id.startsWith('run-sample')}
      />
      <main
        className="grid flex-1"
        style={{
          gridTemplateColumns: '280px minmax(0,1fr) 360px',
          gap: 0,
          // Row alignment set to `start` so the sticky right rail (see
          // DetailRail wrapper below) doesn't get stretched to the full
          // catalog height by the grid's default `stretch`. Without
          // this, `position: sticky` has nothing to stick against — the
          // aside already spans the whole scroll area so it never
          // appears to move. With `start`, the aside takes only its
          // own content height and sticks to the top of the viewport
          // while the catalog column scrolls underneath.
          alignItems: 'start',
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
                  Catalog
                </h1>
                <span
                  className="font-mono"
                  style={{ fontSize: 13, color: 'var(--color-ink-subtle)' }}
                >
                  {state.canonical_dishes.length} dish
                  {state.canonical_dishes.length === 1 ? '' : 'es'}
                  {state.modifiers.length > 0 && (
                    <> · {state.modifiers.length} modifier{state.modifiers.length === 1 ? '' : 's'}</>
                  )}
                  {state.ephemerals.length > 0 && (
                    <> · {state.ephemerals.length} special{state.ephemerals.length === 1 ? '' : 's'}</>
                  )}
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
            onShowHelp={() => setHelpOpen(true)}
            pendingCount={pendingVisible.length}
            onBulkApprove={() => bulkModerate('approved')}
            onBulkReject={() => bulkModerate('rejected')}
          />

          {/* Filter applied — shown above the dish list so the reviewer sees
              exactly what Opus was instructed to do BEFORE scanning the
              results. Renders nothing if the reviewer didn't attach a filter. */}
          <FilterAppliedBanner instructions={state.user_instructions} />

          {/* Receipt of every dish Opus dropped due to the filter. The
              FilterAppliedBanner above tells the user *what* the filter
              was; this block tells them *what came out* — the auditable
              counterpart that turns "trust me" into a verifiable list. */}
          <ExcludedByUserFilter
            items={state.excluded_by_user_filter}
            instructions={state.user_instructions}
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
              label={byCategory[cat].label}
              count={byCategory[cat].dishes.length}
              density={density}
              dishes={byCategory[cat].dishes}
              sources={state.sources}
              modifiers={state.modifiers}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onModerate={onDishModerate}
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

          {state.quality_signal && (
            <QualitySignalPane signal={state.quality_signal} />
          )}

          <ReconciliationNarrative
            trace={state.reconciliation_trace}
            sources={state.sources}
          />

          {state.metrics_preview && <MetricsPane metrics={state.metrics_preview} />}
        </section>
        {/* Sticky "Selected" rail. Pinned to the top of the viewport so
            the reviewer can click on a dish at the bottom of a long
            catalog and still see its provenance / trace without
            scrolling back up. `max-height: 100vh` + internal overflow
            means the rail scrolls within itself when the content
            exceeds the viewport — same pattern Linear, Notion, and
            GitHub PR reviewers use for their right inspector panels.
            `top` offset is a bit below 0 so the rail stays clear of
            the platform window chrome on macOS/Windows 125% scaling. */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            maxHeight: '100vh',
            overflowY: 'auto',
            alignSelf: 'start',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={selected?.id ?? 'empty'}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <DetailRail dish={selected} trace={state.reconciliation_trace} sources={state.sources} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ExtractionDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        processing={state.processing}
        sources={state.sources}
      />
      <SourcePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        sources={state.sources}
        dishes={state.canonical_dishes}
        // Sample run ids start with `run-sample-` (see frontend mock and
        // evals/fixtures/bistro_argentino.py). Real uploads carry a UUID.
        isSample={state.processing.id.startsWith('run-sample')}
      />
      <DishEditDialog
        open={editingDish !== null}
        dish={editingDish}
        onClose={() => setEditingDishId(null)}
        onSave={onEditSave}
      />
      <SaveToast toast={saveToast} onDismiss={() => setSaveToast(null)} />
    </div>
  );
}
