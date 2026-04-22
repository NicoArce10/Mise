import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import {
  ReconciliationClass,
  type ReconciliationResult,
  type SourceDocument,
} from '../domain/types';

const EASE = [0.22, 0.61, 0.36, 1] as const;

interface Props {
  trace: ReconciliationResult[];
  sources: SourceDocument[];
}

/**
 * Tells the "how Opus 4.7 reasoned across your sources" story at the top
 * of the Cockpit. We intentionally only surface entries that are
 * genuinely interesting:
 *
 *   1. `obvious_merge` where the two candidate names actually DIFFER
 *      (e.g. "Mila Napo" ↔ "Milanesa Napolitana") — merges of literal
 *      duplicates are not a story worth telling.
 *   2. `ambiguous` — regardless of the decision. Ambiguous is where the
 *      model earned its keep by reasoning, so every ambiguous pair is a
 *      talking point.
 *
 * If neither category has entries the component renders nothing, which
 * keeps the Cockpit clean on menus that didn't need any reconciliation.
 */
function isInteresting(r: ReconciliationResult): boolean {
  const left = (r.left_name ?? '').trim().toLowerCase();
  const right = (r.right_name ?? '').trim().toLowerCase();
  const namesDiffer = Boolean(left) && Boolean(right) && left !== right;
  if (r.gate_class === ReconciliationClass.OBVIOUS_MERGE && namesDiffer) return true;
  if (r.gate_class === ReconciliationClass.AMBIGUOUS) return true;
  // Cross-source "obvious_non_merge" where the names are very similar
  // but the model kept them separate is also interesting (e.g. "Burger"
  // vs "Double Burger"). We gate on names-differ to avoid noise.
  if (r.gate_class === ReconciliationClass.OBVIOUS_NON_MERGE && namesDiffer) return true;
  return false;
}

function crossSource(r: ReconciliationResult): boolean {
  return (
    r.left_source_id != null &&
    r.right_source_id != null &&
    r.left_source_id !== r.right_source_id
  );
}

export function ReconciliationNarrative({ trace, sources }: Props) {
  const [expanded, setExpanded] = useState(false);
  const bySource = useMemo(() => {
    const m = new Map<string, SourceDocument>();
    for (const s of sources) m.set(s.id, s);
    return m;
  }, [sources]);

  const entries = useMemo(() => {
    const interesting = trace.filter(isInteresting);
    // Rank cross-source + ambiguous first; those carry the best
    // narrative. Tie-break by confidence descending.
    return interesting
      .map(r => ({
        r,
        score:
          (crossSource(r) ? 10 : 0) +
          (r.gate_class === ReconciliationClass.AMBIGUOUS ? 5 : 0) +
          (r.used_adaptive_thinking ? 2 : 0) +
          r.confidence,
      }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.r);
  }, [trace]);

  if (entries.length === 0) return null;

  const crossCount = entries.filter(crossSource).length;
  const mergeCount = entries.filter(r => r.merged).length;
  const adaptiveCount = entries.filter(r => r.used_adaptive_thinking).length;
  const visible = expanded ? entries : entries.slice(0, 3);

  return (
    <section
      aria-label="Cross-source reconciliation"
      style={{
        background: 'var(--color-paper-tint)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
            }}
          >
            How Opus 4.7 reasoned about your {sources.length > 1 ? 'sources' : 'menu'}
          </span>
          <h3
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: 20,
              lineHeight: '26px',
              color: 'var(--color-ink)',
              letterSpacing: '-0.005em',
            }}
          >
            {mergeCount > 0 ? (
              <>
                Merged <span style={{ fontVariantNumeric: 'tabular-nums' }}>{mergeCount}</span>{' '}
                duplicate aliases
                {crossCount > 0 && (
                  <>
                    {' '}
                    across{' '}
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{crossCount}</span>{' '}
                    cross-source pair{crossCount === 1 ? '' : 's'}
                  </>
                )}
                .
              </>
            ) : (
              <>Reviewed {entries.length} borderline pair{entries.length === 1 ? '' : 's'}.</>
            )}
          </h3>
        </div>
        {adaptiveCount > 0 && (
          <span
            className="font-mono inline-flex items-center gap-1"
            style={{
              background: 'var(--color-paper)',
              color: 'var(--color-gold-leaf, var(--color-ink))',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-chip)',
              padding: '4px 10px',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
            title="Opus 4.7 escalated into adaptive thinking to resolve these pairs"
          >
            <Sparkles size={11} strokeWidth={1.8} />
            {adaptiveCount} adaptive
          </span>
        )}
      </div>

      <p
        style={{
          fontSize: 13,
          lineHeight: '20px',
          color: 'var(--color-ink-muted)',
          maxWidth: 720,
        }}
      >
        This is the reconciliation layer an OCR pipeline doesn't have: Opus 4.7 compared candidate
        pairs and decided whether two listings refer to the same dish. Everything below is
        evidence-grounded — no invented dishes, no guesses.
      </p>

      <ul className="flex flex-col" style={{ gap: 8 }}>
        <AnimatePresence initial={false}>
          {visible.map((r, i) => (
            <motion.li
              key={`${r.left_id}-${r.right_id}`}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE, delay: i * 0.03 }}
              style={{
                background: 'var(--color-paper)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-chip)',
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr) auto',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div className="flex min-w-0 flex-col">
                <span
                  className="font-accent"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 15,
                    lineHeight: '20px',
                    color: 'var(--color-ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {r.left_name ?? 'Candidate A'}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    color: 'var(--color-ink-subtle)',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  from{' '}
                  {r.left_source_id && bySource.get(r.left_source_id)?.filename
                    ? bySource.get(r.left_source_id)!.filename
                    : '—'}
                </span>
              </div>

              <ArrowRight
                size={14}
                strokeWidth={1.5}
                style={{ color: 'var(--color-ink-subtle)' }}
                aria-hidden
              />

              <div className="flex min-w-0 flex-col">
                <span
                  className="font-accent"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 15,
                    lineHeight: '20px',
                    color: 'var(--color-ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {r.right_name ?? 'Candidate B'}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    color: 'var(--color-ink-subtle)',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  from{' '}
                  {r.right_source_id && bySource.get(r.right_source_id)?.filename
                    ? bySource.get(r.right_source_id)!.filename
                    : '—'}
                </span>
              </div>

              <VerdictBadge r={r} />

              <p
                style={{
                  gridColumn: '1 / -1',
                  fontSize: 13,
                  lineHeight: '19px',
                  color: 'var(--color-ink-muted)',
                  borderTop: '1px solid var(--color-hairline)',
                  paddingTop: 10,
                  marginTop: 2,
                }}
              >
                <span
                  className="font-accent"
                  style={{
                    fontStyle: 'italic',
                    color: 'var(--color-olive, var(--color-ink))',
                    marginRight: 6,
                  }}
                >
                  Why
                </span>
                {r.decision_summary}
              </p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {entries.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="cursor-pointer inline-flex items-center gap-1 self-start"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-ink-muted)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: 0,
          }}
        >
          <span>
            {expanded
              ? 'Collapse'
              : `Show ${entries.length - 3} more pair${entries.length - 3 === 1 ? '' : 's'}`}
          </span>
          <ChevronDown
            size={12}
            strokeWidth={1.8}
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 160ms ease',
            }}
          />
        </button>
      )}
    </section>
  );
}

function VerdictBadge({ r }: { r: ReconciliationResult }) {
  const label = r.merged
    ? 'Merged'
    : r.gate_class === ReconciliationClass.AMBIGUOUS
      ? 'Kept separate'
      : 'Not merged';
  const tone = r.merged
    ? 'var(--color-moss, var(--color-ink))'
    : r.gate_class === ReconciliationClass.AMBIGUOUS
      ? 'var(--color-gold-leaf, var(--color-ink))'
      : 'var(--color-ink-muted)';
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: tone,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          color: 'var(--color-ink-subtle)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.round(r.confidence * 100)}%
      </span>
    </div>
  );
}
