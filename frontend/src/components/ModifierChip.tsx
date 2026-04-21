import type { Modifier } from '../domain/types';

interface Props {
  modifier: Modifier;
}

export function ModifierChip({ modifier }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-accent"
      style={{
        background: 'var(--color-paper-deep)',
        color: 'var(--color-ink-muted)',
        borderRadius: 'var(--radius-chip)',
        padding: '4px 10px',
        fontStyle: 'italic',
        fontSize: 14,
        lineHeight: '20px',
      }}
    >
      {modifier.text}
    </span>
  );
}
