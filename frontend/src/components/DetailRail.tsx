import type {
  CanonicalDish,
  ReconciliationResult,
  SourceDocument,
} from '../domain/types';
import { Confidence } from './Confidence';

interface Props {
  dish: CanonicalDish | null;
  trace: ReconciliationResult[];
  sources: SourceDocument[];
}

export function DetailRail({ dish, trace, sources }: Props) {
  if (!dish) {
    return (
      <aside
        className="px-6 py-10"
        style={{ borderLeft: '1px solid var(--color-hairline)' }}
      >
        <p style={{ color: 'var(--color-ink-subtle)' }}>Select a dish to see provenance.</p>
      </aside>
    );
  }
  const bySource = new Map(sources.map(s => [s.id, s]));
  const dishTrace = trace.filter(
    t => t.left_id === dish.id || t.right_id === dish.id,
  );
  return (
    <aside
      className="flex flex-col gap-6 px-6 py-10"
      style={{ borderLeft: '1px solid var(--color-hairline)' }}
    >
      <div className="flex flex-col gap-1">
        <span
          className="caption"
          style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
        >
          Selected
        </span>
        <h3
          className="font-display"
          style={{ fontWeight: 500, fontSize: 22, lineHeight: '28px' }}
        >
          {dish.canonical_name}
        </h3>
      </div>

      <section className="flex flex-col gap-2">
        <span
          className="caption"
          style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
        >
          Provenance
        </span>
        <ul className="flex flex-col gap-2">
          {dish.source_ids.map(id => {
            const s = bySource.get(id);
            return (
              <li
                key={id}
                className="font-mono"
                style={{ fontSize: 13, lineHeight: '20px', color: 'var(--color-ink)' }}
              >
                → {s?.filename ?? id}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <span
          className="caption"
          style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
        >
          Ingredients
        </span>
        <p style={{ color: 'var(--color-ink-muted)' }}>
          {dish.ingredients.join(' · ')}
        </p>
      </section>

      {dishTrace.length > 0 && (
        <section className="flex flex-col gap-3">
          <span
            className="caption"
            style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
          >
            Reconciliation trace
          </span>
          {dishTrace.map(t => (
            <div
              key={`${t.left_id}-${t.right_id}`}
              className="flex flex-col gap-2"
              style={{
                borderTop: '1px solid var(--color-hairline)',
                paddingTop: 12,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-mono"
                  style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}
                >
                  {t.gate_class}
                  {t.used_adaptive_thinking && ' · adaptive'}
                </span>
                <Confidence value={t.confidence} />
              </div>
              <p
                style={{
                  color: 'var(--color-ink)',
                  fontSize: 14,
                  lineHeight: '20px',
                }}
              >
                {t.decision_summary}
              </p>
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}
