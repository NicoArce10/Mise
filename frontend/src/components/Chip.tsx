import type { ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'merged' | 'not-merged' | 'modifier' | 'ephemeral' | 'needs-review' | 'neutral';

const styles: Record<Variant, { bg: string; fg: string; border?: string; dashed?: boolean }> = {
  merged: { bg: 'var(--color-olive-tint)', fg: 'var(--color-olive)' },
  'not-merged': { bg: 'var(--color-sienna-tint)', fg: 'var(--color-sienna)' },
  modifier: { bg: 'var(--color-paper-deep)', fg: 'var(--color-ink-muted)' },
  ephemeral: { bg: 'var(--color-ochre-tint)', fg: 'var(--color-ochre)', border: 'var(--color-ochre)', dashed: true },
  'needs-review': { bg: 'var(--color-paper-tint)', fg: 'var(--color-ochre)', border: 'var(--color-ochre)', dashed: true },
  neutral: { bg: 'var(--color-paper-tint)', fg: 'var(--color-ink-muted)' },
};

interface Props {
  variant: Variant;
  children: ReactNode;
  className?: string;
}

export function Chip({ variant, children, className }: Props) {
  const s = styles[variant];
  return (
    <span
      className={clsx(
        'caption inline-flex items-center transition-colors duration-[120ms]',
        className,
      )}
      style={{
        background: s.bg,
        color: s.fg,
        borderRadius: 'var(--radius-chip)',
        padding: '4px 8px',
        letterSpacing: '0.04em',
        border: s.border ? `1px ${s.dashed ? 'dashed' : 'solid'} ${s.border}` : undefined,
      }}
    >
      {children}
    </span>
  );
}
