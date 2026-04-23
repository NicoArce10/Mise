import type { ReactNode } from 'react';

/**
 * Small all-caps label that sits above section headings throughout the
 * landing page. Factored out of `Landing.tsx` so sub-components
 * (e.g. `DishCardPreview`) can render it without cross-importing the
 * landing module.
 */
export function Eyebrow({
  children,
  tone = 'subtle',
}: {
  children: ReactNode;
  tone?: 'subtle' | 'strong';
}) {
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 12,
        lineHeight: '16px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color:
          tone === 'strong'
            ? 'var(--color-ink-muted)'
            : 'var(--color-ink-subtle)',
      }}
    >
      {children}
    </span>
  );
}
