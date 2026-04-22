import { Sparkles } from 'lucide-react';

interface Props {
  instructions: string | null | undefined;
}

/**
 * Shows the natural-language filter the reviewer attached to this run,
 * if any. Renders nothing when no filter was passed. The intent is to
 * make the contract visible: "this is what Opus 4.7 was told to do —
 * now look at the canonical list and judge whether it honored you."
 *
 * We deliberately do NOT claim machine-verification of the filter. The
 * reviewer's eyes on the dish list are the ground truth; promising
 * "filter applied ✓" when we only forwarded the string to the model
 * would be dishonest.
 */
export function FilterAppliedBanner({ instructions }: Props) {
  const trimmed = (instructions ?? '').trim();
  if (!trimmed) return null;

  return (
    <section
      aria-label="Natural-language filter applied to this run"
      className="flex flex-col"
      style={{
        background: 'var(--color-paper-tint)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
        padding: 18,
        gap: 8,
      }}
    >
      <span
        className="font-mono inline-flex items-center gap-1.5"
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-subtle)',
        }}
      >
        <Sparkles size={11} strokeWidth={1.8} />
        Filter applied to this run
      </span>
      <p
        className="font-accent"
        style={{
          fontSize: 18,
          lineHeight: '24px',
          color: 'var(--color-ink)',
          fontStyle: 'italic',
        }}
      >
        &ldquo;{trimmed}&rdquo;
      </p>
      <p
        style={{
          fontSize: 12,
          lineHeight: '16px',
          color: 'var(--color-ink-subtle)',
        }}
      >
        Opus 4.7 received this instruction alongside your menu. Scan the
        canonical list below — any dish that slipped through is a click
        away from <strong>Reject</strong>, which will drop it from the
        exported JSON.
      </p>
    </section>
  );
}
