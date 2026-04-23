import { useState, useRef, useEffect } from 'react';

/**
 * Inline glossary term with a hover/focus popover.
 *
 * Non-technical readers hit the landing and immediately see "OCR",
 * "vision-native", "adaptive thinking", "LTO", "POS" — jargon that
 * quietly loses them. Instead of sanitizing every term (which guts
 * the technical credibility the judges want to see), we render the
 * term with a subtle dotted underline and a definition popover on
 * hover or keyboard focus. Fully accessible: it's a real button so
 * keyboard users get the same UX as mouse users, and the popover is
 * a role="tooltip" region.
 *
 * The popover positions absolutely below the trigger and sizes to
 * the definition length — no virtual-DOM positioning logic so it
 * stays cheap and predictable.
 */
interface Props {
  term: string;
  definition: React.ReactNode;
  /** Optional — "what it means in practice" plain-language follow-up. */
  practical?: React.ReactNode;
}

export function GlossaryTerm({ term, definition, practical }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label={`What is ${term}?`}
        className="cursor-help"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          color: 'inherit',
          font: 'inherit',
          borderBottom: '1px dotted var(--color-ink-muted)',
          paddingBottom: 1,
        }}
      >
        {term}
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 40,
            minWidth: 260,
            maxWidth: 340,
            background: 'var(--color-ink)',
            color: 'var(--color-paper)',
            padding: '12px 14px',
            borderRadius: 8,
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            lineHeight: '19px',
            letterSpacing: 0,
            textTransform: 'none',
            fontStyle: 'normal',
            fontWeight: 400,
            textAlign: 'left',
            boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-paper-deep)',
              marginBottom: 4,
            }}
          >
            {term}
          </span>
          <span style={{ display: 'block' }}>{definition}</span>
          {practical && (
            <span
              style={{
                display: 'block',
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px solid rgba(251, 248, 242, 0.18)',
                color: 'var(--color-paper-deep)',
                fontSize: 12,
              }}
            >
              {practical}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
