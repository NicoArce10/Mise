import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Download,
  FileText,
  Network,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  apiSearch,
  ApiError,
  type SearchResult,
  type SearchMatch,
  type SearchMatchedOn,
} from '../api/client';
import { downloadCatalog } from '../api/exportCatalog';
import { SourcePreviewModal } from '../components/SourcePreviewModal';
import type { CanonicalDish, CockpitState } from '../domain/types';

// Error states TryIt can reach. `expired` means the backend no longer knows
// this processing_id (typical after a `uvicorn --reload`). That is a recovery
// scenario, not a crash — the UI surfaces a clear path back to upload.
type SearchError =
  | { kind: 'generic'; message: string }
  | { kind: 'expired' };

// Deterministic, explainable search for the sample dataset so the demo works
// without hitting the live Opus endpoint. We score each dish by the best
// match across canonical_name / aliases / search_terms / menu_category /
// ingredients and return matched_on labels the UI can render. This keeps the
// sample narrative honest: no fake LLM output, no phantom dishes.
function sampleSearch(query: string, state: CockpitState, topK: number): SearchResult {
  const q = query.trim().toLowerCase();
  const qTokens = q.split(/\s+/).filter(t => t.length >= 2);
  interface Hit {
    dish: CanonicalDish;
    score: number;
    matched_on: Set<SearchMatchedOn>;
    reasonBits: string[];
  }
  const hits: Hit[] = [];
  const overlap = (s: string): number => {
    const hay = s.toLowerCase();
    if (!qTokens.length) return 0;
    let n = 0;
    for (const t of qTokens) if (hay.includes(t)) n += 1;
    return n / qTokens.length;
  };
  for (const dish of state.canonical_dishes) {
    let score = 0;
    const matched = new Set<SearchMatchedOn>();
    const bits: string[] = [];

    const nameOv = overlap(dish.canonical_name);
    if (nameOv > 0) { score = Math.max(score, 0.6 + 0.3 * nameOv); matched.add('canonical_name'); bits.push(`name mentions ${dish.canonical_name}`); }

    for (const alias of dish.aliases) {
      const ov = overlap(alias);
      if (ov > 0) { score = Math.max(score, 0.62 + 0.3 * ov); matched.add('alias'); bits.push(`alias ${alias}`); break; }
    }
    for (const term of dish.search_terms) {
      const ov = overlap(term);
      if (ov > 0) { score = Math.max(score, 0.7 + 0.25 * ov); matched.add('search_term'); bits.push(`search term ${term}`); break; }
    }
    if (dish.menu_category) {
      const ov = overlap(dish.menu_category);
      if (ov > 0) { score = Math.max(score, 0.55 + 0.2 * ov); matched.add('menu_category'); bits.push(`${dish.menu_category} category`); }
    }
    for (const ing of dish.ingredients) {
      const ov = overlap(ing);
      if (ov > 0) { score = Math.max(score, 0.5 + 0.2 * ov); matched.add('ingredient'); bits.push(`has ${ing}`); break; }
    }
    if (score > 0) {
      hits.push({ dish, score: Math.min(score, 0.97), matched_on: matched, reasonBits: bits });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, topK);
  return {
    query,
    interpretation: top.length
      ? `Looking for "${query}" in the extracted catalog — best matches by name, alias, search term, and category.`
      : `Nothing on this menu matches "${query}". Mise will not invent dishes that aren't on the evidence.`,
    matches: top.map(h => ({
      dish_id: h.dish.id,
      score: h.score,
      reason: h.reasonBits.slice(0, 2).join(' · ') || 'Matched extracted metadata for this dish.',
      matched_on: Array.from(h.matched_on),
    })),
    used_adaptive_thinking: false,
    latency_ms: 12,
    model: 'sample · local match',
  };
}

interface Props {
  state: CockpitState;
  processingId: string | null;
  onOpenCatalog: () => void;
  onRestart: () => void;
}

const EASE = [0.22, 0.61, 0.36, 1] as const;
const CONTAINER_MAX = 1100;

// Curated queries in the local vernacular the demo script relies on. These
// are evidence-grounded: the model can only surface what is actually in the
// menu that was uploaded. A fresh menu will surface fresh examples via
// `suggestedQueries()` — these are the fallback the hero demo leans on.
const DEFAULT_QUERIES = [
  'mila napo abundante',
  'algo veggie que no sea ensalada',
  'burger doble cheddar con papas',
  'lomito como steak sandwich',
  'algo tipo cuarto de libra',
  'sandwich de queso derretido',
];

// Semantic queries that showcase what the graph can do beyond lexical
// matching: exclusions, dietary filters, price budgets, shareability. We
// append 2 of these to the curated pool when the extracted menu has the
// signal to back them (has vegetarian dishes, has prices, etc.). If the
// evidence doesn't support the capability, we don't advertise it.
function semanticQueries(state: CockpitState): string[] {
  const out: string[] = [];
  const hay = state.canonical_dishes
    .map(d =>
      [
        d.canonical_name,
        ...d.search_terms,
        ...d.aliases,
        ...d.ingredients,
        d.menu_category ?? '',
      ].join(' '),
    )
    .join(' ')
    .toLowerCase();
  const hasDietary = /veget|vegan|sin gluten|gluten[- ]?free|lacteos|lactose/.test(hay);
  const hasPrice = state.canonical_dishes.some(d => d.price_value != null);
  const hasShareable = /compart|tabla|para dos|share/.test(hay);
  if (hasDietary) out.push('algo sin gluten');
  if (hasPrice) out.push('menos de 15');
  if (hasShareable) out.push('para compartir entre dos');
  return out;
}

// Pick 4–6 example queries biased to whatever the uploaded menu seems to
// contain — look at each dish's search_terms and sample from them. Falls
// back to DEFAULT_QUERIES when extraction didn't populate search_terms.
function suggestedQueries(state: CockpitState): string[] {
  const pool = new Set<string>();
  for (const dish of state.canonical_dishes) {
    for (const term of dish.search_terms) {
      const trimmed = term.trim();
      if (trimmed.length >= 6 && trimmed.split(/\s+/).length >= 2) {
        pool.add(trimmed);
      }
    }
  }
  const arr = Array.from(pool);
  if (arr.length < 4) return DEFAULT_QUERIES.slice(0, 6);
  // Take a spread: every nth item so we don't cluster around one dish.
  const step = Math.max(1, Math.floor(arr.length / 6));
  const picked = arr.filter((_, i) => i % step === 0).slice(0, 6);
  return picked.length >= 4 ? picked : DEFAULT_QUERIES.slice(0, 6);
}

function formatPrice(value: number | null, currency: string | null): string {
  if (value == null) return '';
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'ARS' ? '$' : '';
  const num = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
  return symbol ? `${symbol}${num}` : `${num} ${currency ?? ''}`.trim();
}

function MatchedOnChip({ kind }: { kind: SearchMatchedOn }) {
  const labelMap: Record<SearchMatchedOn, string> = {
    alias: 'alias',
    search_term: 'search term',
    canonical_name: 'name',
    ingredient: 'ingredient',
    menu_category: 'category',
    modifier: 'modifier',
    semantic_inference: 'semantic',
  };
  return (
    <span
      className="font-mono"
      style={{
        background: 'var(--color-paper)',
        color: 'var(--color-ink-muted)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-chip)',
        padding: '2px 8px',
        fontSize: 10,
        lineHeight: '14px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      {labelMap[kind]}
    </span>
  );
}

function MatchCard({
  match,
  dish,
  rank,
}: {
  match: SearchMatch;
  dish: CanonicalDish | undefined;
  rank: number;
}) {
  if (!dish) return null;
  const scorePct = Math.round(match.score * 100);
  const priceLabel = formatPrice(dish.price_value, dish.price_currency);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.24, ease: EASE, delay: rank * 0.04 }}
      style={{
        background: 'var(--color-paper)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
        padding: 24,
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto',
        gap: 16,
        alignItems: 'start',
      }}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'var(--color-ink-subtle)',
              minWidth: 20,
            }}
          >
            {String(rank + 1).padStart(2, '0')}
          </span>
          <h3
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: 28,
              lineHeight: '32px',
              letterSpacing: '-0.01em',
              color: 'var(--color-ink)',
            }}
          >
            {dish.canonical_name}
          </h3>
          {dish.menu_category && (
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-subtle)',
              }}
            >
              · {dish.menu_category}
            </span>
          )}
        </div>

        <p
          style={{
            fontSize: 16,
            lineHeight: '24px',
            color: 'var(--color-ink-muted)',
          }}
        >
          <span
            className="font-accent"
            style={{
              fontStyle: 'italic',
              color: 'var(--color-olive)',
              fontSize: 17,
              marginRight: 6,
            }}
          >
            Why
          </span>
          {match.reason}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {match.matched_on.map(kind => (
            <MatchedOnChip key={kind} kind={kind} />
          ))}
          {dish.aliases.length > 0 && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-ink-subtle)',
                marginLeft: 4,
              }}
            >
              also known as {dish.aliases.slice(0, 3).join(' · ')}
            </span>
          )}
        </div>

        {dish.source_ids.length > 0 && (
          <div
            className="flex items-center gap-2"
            style={{
              paddingTop: 8,
              borderTop: '1px solid var(--color-hairline)',
              fontSize: 12,
              color: 'var(--color-ink-subtle)',
            }}
          >
            <span
              className="font-mono"
              style={{
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontSize: 10,
              }}
            >
              source
            </span>
            <span>
              {dish.source_ids.length} {dish.source_ids.length === 1 ? 'file' : 'files'}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-3 text-right">
        <span
          className="font-mono"
          style={{
            fontSize: 13,
            color: scorePct >= 85 ? 'var(--color-olive)' : 'var(--color-ink-muted)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.04em',
          }}
        >
          {scorePct}%
        </span>
        {priceLabel && (
          <span
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: 22,
              lineHeight: '26px',
              color: 'var(--color-ink)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {priceLabel}
          </span>
        )}
      </div>
    </motion.article>
  );
}

export function TryIt({ state, processingId, onOpenCatalog, onRestart }: Props) {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // `processingId === 'sample'` is set by App.tsx when we loaded the
  // bundled typographic preview. Real backend runs always carry a UUID.
  const isSample = processingId === 'sample';

  const dishById = useMemo(() => {
    const m = new Map<string, CanonicalDish>();
    for (const d of state.canonical_dishes) m.set(d.id, d);
    return m;
  }, [state.canonical_dishes]);

  const examples = useMemo(() => {
    const base = suggestedQueries(state);
    const sem = semanticQueries(state);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const q of [...base, ...sem]) {
      const k = q.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(q);
      if (out.length >= 7) break;
    }
    return out;
  }, [state]);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      if (!processingId) {
        setError({
          kind: 'generic',
          message: 'Upload a menu first so Mise has something to search.',
        });
        return;
      }
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setActiveQuery(trimmed);
      setLoading(true);
      setError(null);
      try {
        if (processingId === 'sample') {
          // Sample mode runs deterministic local matching so the demo works
          // offline and doesn't burn API calls on canned data. Real menus
          // (live processingId) still hit Opus 4.7 with adaptive thinking.
          await new Promise(res => setTimeout(res, 420));
          if (controller.signal.aborted) return;
          setResult(sampleSearch(trimmed, state, 5));
          return;
        }
        const r = await apiSearch(processingId, { query: trimmed, top_k: 5 });
        if (controller.signal.aborted) return;
        setResult(r);
      } catch (err) {
        if (controller.signal.aborted) return;
        // 404 = the backend no longer knows this processing_id (the server
        // was restarted, or the run was evicted from the in-memory store).
        // That's a recoverable state, not a crash — push the user to start
        // over rather than refresh the tab.
        if (err instanceof ApiError && err.status === 404) {
          setError({ kind: 'expired' });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          setError({ kind: 'generic', message: msg });
        }
        setResult(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [processingId, state],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const catalogCount = state.canonical_dishes.length;
  const firstSource = state.sources[0];
  const menuLabel =
    state.sources.length === 0
      ? 'No menu loaded'
      : state.sources.length === 1
        ? firstSource?.filename ?? 'Uploaded menu'
        : `${state.sources.length} files`;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--color-paper)' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 md:px-10 py-5"
        style={{
          borderBottom: '1px solid var(--color-hairline)',
          maxWidth: CONTAINER_MAX,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div className="flex items-baseline gap-3">
          <button
            type="button"
            onClick={onRestart}
            aria-label="Mise — back to home"
            title="Back to home"
            className="font-display cursor-pointer"
            style={{
              fontWeight: 500,
              fontSize: 22,
              lineHeight: '26px',
              letterSpacing: '-0.01em',
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--color-ink)',
            }}
          >
            Mise
          </button>
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              lineHeight: '14px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
            }}
          >
            Try it · {catalogCount} dish{catalogCount === 1 ? '' : 'es'} · {menuLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Tertiary: start-over link. Kept as a quiet text-style
              affordance so it doesn't steal attention from the primary
              path (see the dish graph). In sample mode this doubles as
              the "Upload your own menu" nudge. */}
          <button
            type="button"
            onClick={() => {
              // Sample mode never has anything to lose — skip the
              // confirm so the "upload yours" nudge feels frictionless.
              if (isSample) {
                onRestart();
                return;
              }
              const hasWork = activeQuery.length > 0 || result !== null;
              if (!hasWork) {
                onRestart();
                return;
              }
              const ok = window.confirm(
                'Start over? This search will be cleared.',
              );
              if (ok) onRestart();
            }}
            className="cursor-pointer"
            style={{
              background: isSample ? 'var(--color-paper-tint)' : 'transparent',
              color: isSample ? 'var(--color-ink)' : 'var(--color-ink-muted)',
              border: isSample ? '1px solid var(--color-ink)' : 'none',
              borderRadius: isSample ? 'var(--radius-chip)' : 0,
              padding: isSample ? '8px 14px' : '8px 0',
              fontSize: 13,
              letterSpacing: isSample ? '0.02em' : 0,
              fontWeight: isSample ? 500 : 400,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title={
              isSample
                ? 'You are looking at the sample menu. Upload your own PDF or photo to run it against Opus 4.7 live.'
                : 'Start over with a fresh menu'
            }
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            {isSample ? 'Upload your menu' : 'new menu'}
          </button>

          {/* Secondary: view the uploaded source + export the JSON.
              Both are valid follow-up actions but neither is the point
              of the product — the dish graph is. Ghost buttons, lighter
              visual weight. */}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={state.sources.length === 0}
            className="cursor-pointer inline-flex items-center gap-2"
            style={{
              background: 'transparent',
              color: 'var(--color-ink-muted)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-chip)',
              padding: '8px 14px',
              fontSize: 13,
              letterSpacing: '0.02em',
              opacity: state.sources.length === 0 ? 0.5 : 1,
            }}
            title="See the menu this demo loaded"
          >
            <FileText size={13} strokeWidth={1.7} />
            View menu
          </button>
          <button
            type="button"
            onClick={() => downloadCatalog(state, processingId)}
            disabled={state.canonical_dishes.length === 0}
            className="cursor-pointer inline-flex items-center gap-2"
            style={{
              background: 'transparent',
              color: 'var(--color-ink-muted)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-chip)',
              padding: '8px 14px',
              fontSize: 13,
              letterSpacing: '0.02em',
              opacity: state.canonical_dishes.length === 0 ? 0.5 : 1,
            }}
            title="Download the dish graph as JSON — plug it into any downstream system"
          >
            <Download size={13} strokeWidth={1.7} />
            Export JSON
          </button>

          {/* PRIMARY CTA. The dish graph is the product. Everything
              else on this page is a support surface (search demo,
              export download, menu preview). A reviewer who lands here
              from the landing page needs to see *what Opus actually
              built* in one click — not play with the search box and
              wander off. The button inherits the dark ink background
              from the landing's primary CTA ("Run your own menu") so
              the visual language is continuous across the app.

              Value-rich copy: the dish count lives in the label so the
              button doubles as a tiny data point instead of a blank
              "See full catalog" that forces the eye to look elsewhere
              for the N. */}
          <button
            type="button"
            onClick={onOpenCatalog}
            className="cursor-pointer inline-flex items-center gap-2"
            style={{
              background: 'var(--color-ink)',
              color: 'var(--color-paper)',
              border: '1px solid var(--color-ink)',
              borderRadius: 'var(--radius-chip)',
              padding: '10px 18px',
              fontSize: 13,
              letterSpacing: '0.02em',
              fontWeight: 500,
              boxShadow: '0 1px 2px rgba(18,18,20,0.06)',
            }}
            title="Open the full dish graph Opus built from your upload — canonical dishes, modifiers, ephemeral specials, reconciliation decisions."
          >
            <Network size={14} strokeWidth={1.7} />
            See the {catalogCount} dish{catalogCount === 1 ? '' : 'es'} Opus built
            <ArrowRight size={13} strokeWidth={1.7} />
          </button>

        </div>
      </header>

      {/* Hero search */}
      <section
        className="px-6 md:px-10 pt-16 md:pt-24 pb-12"
        style={{
          maxWidth: CONTAINER_MAX,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="flex items-center gap-3 mb-5"
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 28,
              height: 1,
              background: 'var(--color-ink-subtle)',
            }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-muted)',
            }}
          >
            Playground · verify your dish graph with real diner questions
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE, delay: 0.04 }}
          className="font-display"
          style={{
            fontWeight: 500,
            lineHeight: 1.04,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
            fontSize: 'clamp(34px, 4.8vw, 56px)',
            marginBottom: 20,
            maxWidth: 820,
          }}
        >
          What would you like to eat?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE, delay: 0.06 }}
          style={{
            fontSize: 15,
            lineHeight: '24px',
            color: 'var(--color-ink-muted)',
            maxWidth: 720,
            marginBottom: 28,
          }}
        >
          Opus 4.7 runs here <strong style={{ color: 'var(--color-ink)', fontWeight: 500 }}>only</strong> so you can judge the graph's quality before integrating.{' '}
          Your downstream app doesn't need Opus at query time —{' '}
          <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>aliases, search terms and ingredients</span>{' '}
          are pre-computed in the JSON catalog, so Postgres, Elastic or a vector DB can serve lookups in milliseconds.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE, delay: 0.08 }}
          onSubmit={e => {
            e.preventDefault();
            void runSearch(query);
          }}
          className="flex items-center gap-3"
          style={{
            background: 'var(--color-paper-tint)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-card)',
            padding: '10px 12px 10px 20px',
            boxShadow: 'var(--shadow-atmosphere)',
          }}
        >
          <Search size={20} strokeWidth={1.5} style={{ color: 'var(--color-ink-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="mila napo abundante · algo veggie que no sea ensalada · burger doble cheddar con papas"
            className="flex-1 bg-transparent outline-none"
            style={{
              fontSize: 18,
              lineHeight: '28px',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-sans)',
              minHeight: 40,
            }}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="cursor-pointer"
            style={{
              background: 'var(--color-ink)',
              color: 'var(--color-paper)',
              border: '1px solid var(--color-ink)',
              borderRadius: 'var(--radius-chip)',
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '0.01em',
              opacity: loading || !query.trim() ? 0.5 : 1,
              transition: 'opacity 160ms ease',
            }}
          >
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </motion.form>

        {/* Example chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.32, ease: EASE, delay: 0.16 }}
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
              marginRight: 4,
            }}
          >
            try
          </span>
          {examples.map(ex => {
            const isActive = activeQuery.trim().toLowerCase() === ex.toLowerCase();
            return (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuery(ex);
                  void runSearch(ex);
                }}
                className="cursor-pointer"
                style={{
                  background: isActive ? 'var(--color-ink)' : 'var(--color-paper)',
                  color: isActive ? 'var(--color-paper)' : 'var(--color-ink-muted)',
                  border: isActive
                    ? '1px solid var(--color-ink)'
                    : '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-chip)',
                  padding: '6px 12px',
                  fontSize: 13,
                  lineHeight: '18px',
                  fontFamily: 'var(--font-accent)',
                  fontStyle: 'italic',
                  letterSpacing: '-0.005em',
                  transition: 'background-color 160ms ease, color 160ms ease',
                }}
                onMouseEnter={e => {
                  if (isActive) return;
                  e.currentTarget.style.background = 'var(--color-ink)';
                  e.currentTarget.style.color = 'var(--color-paper)';
                }}
                onMouseLeave={e => {
                  if (isActive) return;
                  e.currentTarget.style.background = 'var(--color-paper)';
                  e.currentTarget.style.color = 'var(--color-ink-muted)';
                }}
              >
                {ex}
              </button>
            );
          })}
        </motion.div>
      </section>

      {/* Results */}
      <section
        className="px-6 md:px-10 pb-24"
        style={{
          maxWidth: CONTAINER_MAX,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <AnimatePresence mode="wait">
          {error && !loading && (
            <motion.div
              key={`error-${error.kind}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
              style={{
                background: 'var(--color-paper-tint)',
                border: '1px dashed var(--color-sienna)',
                borderRadius: 'var(--radius-card)',
                padding: 24,
                color: 'var(--color-ink-muted)',
                fontSize: 14,
              }}
            >
              {error.kind === 'expired' ? (
                <>
                  <div className="flex flex-col gap-2">
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--color-sienna)',
                      }}
                    >
                      This processing run expired
                    </span>
                    <p
                      className="font-accent"
                      style={{
                        fontStyle: 'italic',
                        fontSize: 18,
                        lineHeight: '26px',
                        color: 'var(--color-ink)',
                      }}
                    >
                      The backend was restarted and doesn't remember this run
                      anymore. Upload the menu again to pick up where you left off.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={onRestart}
                      className="cursor-pointer inline-flex items-center gap-2"
                      style={{
                        background: 'var(--color-ink)',
                        color: 'var(--color-paper)',
                        border: '1px solid var(--color-ink)',
                        borderRadius: 'var(--radius-chip)',
                        padding: '10px 16px',
                        fontSize: 13,
                        letterSpacing: '0.02em',
                      }}
                    >
                      <RotateCcw size={13} strokeWidth={1.7} />
                      Start over
                    </button>
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className="cursor-pointer"
                      style={{
                        background: 'transparent',
                        color: 'var(--color-ink-muted)',
                        border: '1px solid var(--color-hairline)',
                        borderRadius: 'var(--radius-chip)',
                        padding: '10px 16px',
                        fontSize: 13,
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </>
              ) : (
                <span>{error.message}</span>
              )}
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
              style={{
                padding: '32px 0',
                color: 'var(--color-ink-muted)',
              }}
            >
              <div className="flex items-center gap-2">
                <Brain size={16} strokeWidth={1.5} style={{ color: 'var(--color-gold-leaf)' }} />
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  Opus 4.7 is reading the menu
                </span>
              </div>
              <p
                className="font-accent"
                style={{
                  fontStyle: 'italic',
                  fontSize: 20,
                  lineHeight: '28px',
                  color: 'var(--color-ink)',
                }}
              >
                “{activeQuery}”
              </p>
              <div
                style={{
                  width: '100%',
                  maxWidth: 480,
                  height: 1,
                  background:
                    'linear-gradient(90deg, transparent, var(--color-ink) 50%, transparent)',
                  animation: 'mise-pulse 1.6s ease-in-out infinite',
                }}
              />
            </motion.div>
          )}

          {result && !loading && !error && (
            <motion.div
              key={`result-${activeQuery}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-8"
            >
              <div
                className="flex flex-col gap-3"
                style={{
                  borderBottom: '1px solid var(--color-hairline)',
                  paddingBottom: 16,
                }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--color-ink-subtle)',
                    }}
                  >
                    Interpretation
                  </span>
                  {result.used_adaptive_thinking && (
                    <span
                      className="font-mono inline-flex items-center gap-1"
                      style={{
                        background: 'var(--color-paper-tint)',
                        color: 'var(--color-gold-leaf)',
                        border: '1px solid var(--color-hairline)',
                        borderRadius: 'var(--radius-chip)',
                        padding: '3px 10px',
                        fontSize: 10,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <Sparkles size={11} strokeWidth={1.8} />
                      Adaptive thinking engaged
                    </span>
                  )}
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      color: 'var(--color-ink-subtle)',
                      marginLeft: 'auto',
                    }}
                  >
                    {result.latency_ms}ms · {result.model}
                  </span>
                </div>
                <p
                  className="font-accent"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 22,
                    lineHeight: '30px',
                    color: 'var(--color-ink)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {result.interpretation}
                </p>
              </div>

              {result.matches.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    border: '1px dashed var(--color-hairline)',
                    borderRadius: 'var(--radius-card)',
                    background: 'var(--color-paper-tint)',
                    color: 'var(--color-ink-muted)',
                    fontSize: 15,
                  }}
                >
                  Nothing on this menu matches that request. Mise will not
                  invent dishes that aren't in the evidence.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {result.matches.map((m, i) => (
                    <MatchCard
                      key={`${m.dish_id}-${i}`}
                      match={m}
                      dish={dishById.get(m.dish_id)}
                      rank={i}
                    />
                  ))}
                </div>
              )}

              {/* Post-success nudge. A reviewer who just got a useful
                  search result is in the best possible frame to care
                  about the rest of the product. Showing the "full dish
                  graph" CTA right here (vs only in the header) is the
                  classic SaaS repeat-CTA pattern — the primary action
                  appears once above the fold, then again after the
                  first moment of product-value. Hidden when there are
                  no matches: surfacing a triumphant CTA on an empty
                  result would feel tone-deaf. */}
              {result.matches.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, ease: EASE, delay: 0.15 }}
                  className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                  style={{
                    marginTop: 8,
                    padding: '20px 22px',
                    borderRadius: 'var(--radius-card)',
                    background: 'var(--color-paper-tint)',
                    border: '1px solid var(--color-hairline)',
                  }}
                >
                  <div className="flex flex-col gap-1" style={{ maxWidth: 540 }}>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'var(--color-ink-subtle)',
                      }}
                    >
                      You just verified one query · there are{' '}
                      {catalogCount - 1} more dish
                      {catalogCount - 1 === 1 ? '' : 'es'} below
                    </span>
                    <p
                      className="font-accent"
                      style={{
                        fontStyle: 'italic',
                        fontSize: 17,
                        lineHeight: '24px',
                        color: 'var(--color-ink)',
                      }}
                    >
                      This search ran against the full dish graph Opus
                      built from your upload. Open it to see every
                      canonical dish, its aliases, the modifiers
                      attached to it, and the merge/split decisions
                      that got it there.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenCatalog}
                    className="cursor-pointer inline-flex items-center gap-2 shrink-0"
                    style={{
                      background: 'var(--color-ink)',
                      color: 'var(--color-paper)',
                      border: '1px solid var(--color-ink)',
                      borderRadius: 'var(--radius-chip)',
                      padding: '12px 20px',
                      fontSize: 13,
                      letterSpacing: '0.02em',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 2px rgba(18,18,20,0.06)',
                    }}
                    title="Open the full dish graph — canonical dishes, modifiers, ephemerals, reconciliation decisions."
                  >
                    <Network size={14} strokeWidth={1.7} />
                    Open the full dish graph
                    <ArrowRight size={13} strokeWidth={1.7} />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {!result && !loading && !error && (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.32, ease: EASE, delay: 0.2 }}
              className="flex flex-col gap-3"
              style={{
                padding: '40px 0',
                color: 'var(--color-ink-subtle)',
                fontSize: 14,
                lineHeight: '22px',
                maxWidth: 640,
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                How this works
              </span>
              <p>
                Mise extracted <strong style={{ color: 'var(--color-ink)' }}>{catalogCount}</strong>{' '}
                dish{catalogCount === 1 ? '' : 'es'} from your upload, including every alias and
                local search term Opus 4.7 could surface. Queries run against that graph — the
                model interprets the intent, honors exclusions, and only returns dishes actually on
                this menu.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <style>{`
        @keyframes mise-pulse {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.95; }
        }
      `}</style>

      <SourcePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        sources={state.sources}
        dishes={state.canonical_dishes}
        isSample={isSample}
      />
    </div>
  );
}
