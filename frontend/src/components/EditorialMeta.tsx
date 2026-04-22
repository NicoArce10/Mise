import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import type { CockpitState } from '../domain/types';

interface Props {
  state: CockpitState;
}

function humanStats(state: CockpitState) {
  const dishCount = state.canonical_dishes.length;
  const sourceCount = state.sources.length;
  const modifiers = state.modifiers.length;
  const ephemerals = state.ephemerals.length;
  // Duplicates merged = evidence sources that collapsed into canonical dishes.
  // For each dish with more than one source, it hid (sources - 1) duplicates.
  const merges = state.canonical_dishes.reduce(
    (acc, d) => acc + Math.max(0, d.source_ids.length - 1),
    0,
  );
  const ambiguous = state.processing.adaptive_thinking_pairs;
  const time = state.metrics_preview?.time_to_review_pack_seconds ?? null;
  return { dishCount, sourceCount, modifiers, ephemerals, merges, ambiguous, time };
}

function HumanLine({ state }: Props) {
  const s = humanStats(state);
  if (s.dishCount === 0 && s.sourceCount === 0) return null;

  // Build only the segments that have meaningful data.
  const parts: string[] = [
    `Reviewing ${s.dishCount} dish${s.dishCount === 1 ? '' : 'es'} from ${s.sourceCount} source${s.sourceCount === 1 ? '' : 's'}`,
  ];
  if (s.merges > 0) {
    parts.push(`${s.merges} duplicate${s.merges === 1 ? '' : 's'} merged`);
  }
  if (s.ambiguous > 0) {
    parts.push(
      `${s.ambiguous} ambiguous case${s.ambiguous === 1 ? '' : 's'} resolved with adaptive thinking`,
    );
  }
  if (s.modifiers > 0) {
    parts.push(`${s.modifiers} modifier${s.modifiers === 1 ? '' : 's'} detected`);
  }
  if (s.ephemerals > 0) {
    parts.push(`${s.ephemerals} special${s.ephemerals === 1 ? '' : 's'} flagged as ephemeral`);
  }
  if (s.time != null) {
    parts.push(`ready in ${s.time.toFixed(1)}s`);
  }

  return (
    <p
      className="font-accent"
      style={{
        fontStyle: 'italic',
        fontSize: 18,
        lineHeight: '26px',
        color: 'var(--color-ink-muted)',
      }}
    >
      {parts.join(' · ')}
    </p>
  );
}

function EngineeringTable({ state }: Props) {
  const metrics = state.metrics_preview;
  const rows: { label: string; value: string }[] = useMemo(() => {
    if (!metrics) return [];
    const num = (v: number | null | undefined, digits = 2) =>
      v == null ? '—' : v.toFixed(digits);
    return [
      { label: 'Merge precision', value: num(metrics.merge_precision) },
      { label: 'Non-merge accuracy', value: num(metrics.non_merge_accuracy) },
      { label: 'Sources ingested', value: String(metrics.sources_ingested) },
      { label: 'Canonical / modifier / ephemeral', value: `${metrics.canonical_count} / ${metrics.modifier_count} / ${metrics.ephemeral_count}` },
      {
        label: 'Time to review pack',
        value: metrics.time_to_review_pack_seconds != null ? `${metrics.time_to_review_pack_seconds.toFixed(2)} s` : '—',
      },
      {
        label: 'Adaptive thinking pairs',
        value: String(state.processing.adaptive_thinking_pairs),
      },
      { label: 'Eval report', value: 'evals/reports/eval_real.json' },
    ];
  }, [metrics, state.processing.adaptive_thinking_pairs]);

  if (rows.length === 0) return null;

  return (
    <div
      className="flex flex-col"
      style={{
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-input)',
        padding: 16,
        background: 'var(--color-paper-tint)',
      }}
    >
      <div
        className="caption"
        style={{
          color: 'var(--color-ink-subtle)',
          letterSpacing: '0.14em',
          marginBottom: 10,
        }}
      >
        ENGINEERING METRICS
      </div>
      <dl
        className="grid gap-x-6"
        style={{ gridTemplateColumns: 'auto 1fr', rowGap: 6 }}
      >
        {rows.map(r => (
          <div
            key={r.label}
            style={{ display: 'contents' }}
          >
            <dt
              style={{
                fontSize: 13,
                lineHeight: '20px',
                color: 'var(--color-ink-muted)',
              }}
            >
              {r.label}
            </dt>
            <dd
              className="font-mono"
              style={{
                fontSize: 13,
                lineHeight: '20px',
                color: 'var(--color-ink)',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function EditorialMeta({ state }: Props) {
  const [open, setOpen] = useState(false);

  // When there is nothing to summarize, render nothing.
  if (state.canonical_dishes.length === 0 && state.sources.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <HumanLine state={state} />
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="cursor-pointer self-start"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          color: 'var(--color-ink-subtle)',
          border: 'none',
          padding: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          letterSpacing: '0.02em',
        }}
        aria-expanded={open}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
          style={{ display: 'inline-flex' }}
        >
          <ChevronRight size={12} strokeWidth={1.5} />
        </motion.span>
        {open ? 'Hide engineering metrics' : 'Show engineering metrics'}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <EngineeringTable state={state} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
