import clsx from 'clsx';
import type { ModerationStatus } from '../domain/types';

interface Props {
  moderation: ModerationStatus;
  onModerate: (status: 'approved' | 'edited' | 'rejected') => void;
}

const buttons: Array<{
  label: string;
  value: 'approved' | 'edited' | 'rejected';
  activeBg: string;
  activeFg: string;
}> = [
  { label: 'Approve', value: 'approved', activeBg: 'var(--color-olive-tint)', activeFg: 'var(--color-olive)' },
  { label: 'Edit', value: 'edited', activeBg: 'var(--color-ochre-tint)', activeFg: 'var(--color-ochre)' },
  { label: 'Reject', value: 'rejected', activeBg: 'var(--color-sienna-tint)', activeFg: 'var(--color-sienna)' },
];

export function ActionBar({ moderation, onModerate }: Props) {
  return (
    <div className="flex items-center gap-2">
      {buttons.map(b => {
        const active = moderation === b.value;
        return (
          <button
            key={b.value}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onModerate(b.value);
            }}
            className={clsx(
              'caption transition-all duration-[140ms] cursor-pointer hover:opacity-90',
            )}
            style={{
              background: active ? b.activeFg : 'transparent',
              color: active ? '#fff' : 'var(--color-ink-muted)',
              border: `1px solid ${active ? b.activeFg : 'var(--color-hairline)'}`,
              borderRadius: 'var(--radius-chip)',
              padding: '6px 12px',
              letterSpacing: '0.04em',
              fontWeight: active ? 600 : 400,
              boxShadow: active ? `0 1px 2px ${b.activeFg}40` : 'none',
            }}
          >
            {active ? '✓ ' : ''}{b.label}
          </button>
        );
      })}
    </div>
  );
}
