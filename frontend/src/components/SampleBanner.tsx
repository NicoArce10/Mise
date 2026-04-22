import { ArrowRight } from 'lucide-react';

interface Props {
  onClear: () => void;
}

/**
 * Persistent banner shown above the Cockpit when the user is viewing the
 * demo/sample data instead of their own upload. Keeps the product honest:
 * a reviewer can never mistake the italian fixture for something they
 * themselves uploaded.
 */
export function SampleBanner({ onClear }: Props) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-10 py-3"
      style={{
        background: 'var(--color-sienna-tint)',
        borderBottom: '1px solid var(--color-sienna)',
        color: 'var(--color-sienna)',
      }}
      role="status"
    >
      <div className="flex items-baseline gap-3">
        <span
          className="caption"
          style={{ letterSpacing: '0.14em', fontWeight: 600 }}
        >
          SAMPLE
        </span>
        <span style={{ fontSize: 14, lineHeight: '20px', color: 'var(--color-ink)' }}>
          You&apos;re exploring a{' '}
          <span className="font-accent" style={{ fontStyle: 'italic' }}>
            pre-loaded bistró menu
          </span>
          {' '}— the real pipeline runs on whatever menu you upload.
        </span>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="cursor-pointer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          color: 'var(--color-sienna)',
          border: '1px solid var(--color-sienna)',
          borderRadius: 'var(--radius-chip)',
          padding: '6px 12px',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.04em',
        }}
      >
        Upload your own menu
        <ArrowRight size={12} strokeWidth={1.5} />
      </button>
    </div>
  );
}
