import type { Modifier } from '../domain/types';
import { ModifierChip } from './ModifierChip';

interface Props {
  modifiers: Modifier[];
}

export function UnattachedModifiersLane({ modifiers }: Props) {
  const unattached = modifiers.filter(m => m.parent_dish_id === null);
  if (unattached.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h2
          className="font-display"
          style={{ fontWeight: 500, fontSize: 28, lineHeight: '32px' }}
        >
          Unattached modifiers
        </h2>
        <span
          className="caption"
          style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
        >
          NEEDS ATTACHMENT
        </span>
      </div>
      <div
        className="flex flex-wrap gap-2"
        style={{
          background: 'var(--color-paper-tint)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-card)',
          padding: 16,
        }}
      >
        {unattached.map(m => (
          <ModifierChip key={m.id} modifier={m} />
        ))}
      </div>
    </section>
  );
}
