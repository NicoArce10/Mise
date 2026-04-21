import type { MetricsPreview } from '../domain/types';

interface Props {
  metrics: MetricsPreview;
}

function Metric({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="caption"
        style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
      >
        {label}
      </span>
      <span
        className={mono ? 'font-mono' : 'font-display'}
        style={{
          fontSize: mono ? 20 : 24,
          lineHeight: '28px',
          color: 'var(--color-ink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function MetricsPane({ metrics }: Props) {
  return (
    <section
      className="flex flex-col gap-5"
      style={{
        background: 'var(--color-paper-tint)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
        padding: 24,
      }}
    >
      <div className="flex items-baseline justify-between">
        <h2
          className="font-display"
          style={{ fontWeight: 500, fontSize: 22, lineHeight: '28px' }}
        >
          Run metrics
        </h2>
        <span
          className="caption"
          style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
        >
          from evals/run_eval.py
        </span>
      </div>
      <div className="grid grid-cols-3 gap-6 md:grid-cols-4">
        <Metric label="Sources" value={String(metrics.sources_ingested)} />
        <Metric label="Canonical" value={String(metrics.canonical_count)} />
        <Metric label="Modifiers" value={String(metrics.modifier_count)} />
        <Metric label="Ephemeral" value={String(metrics.ephemeral_count)} />
        <Metric
          label="Merge precision"
          value={
            metrics.merge_precision === null ? '—' : metrics.merge_precision.toFixed(2)
          }
        />
        <Metric
          label="Non-merge accuracy"
          value={
            metrics.non_merge_accuracy === null
              ? '—'
              : metrics.non_merge_accuracy.toFixed(2)
          }
        />
        <Metric
          label="Time to pack"
          value={
            metrics.time_to_review_pack_seconds === null
              ? '—'
              : `${metrics.time_to_review_pack_seconds.toFixed(1)}s`
          }
        />
      </div>
    </section>
  );
}
