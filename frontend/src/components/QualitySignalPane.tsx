import { useState } from 'react';
import { Info, X } from 'lucide-react';
import type { QualitySignal } from '../domain/types';
import { QualityStatus } from '../domain/types';

interface Props {
  signal: QualitySignal;
}

const STATUS_COPY: Record<
  QualityStatus,
  { label: string; headline: string; tone: 'olive' | 'amber' | 'red' }
> = {
  [QualityStatus.READY]: {
    label: 'Ready to publish',
    headline:
      'The guardrail didn’t find anything that looks like an extraction failure on this run.',
    tone: 'olive',
  },
  [QualityStatus.REVIEW_RECOMMENDED]: {
    label: 'Review recommended',
    headline:
      'A reviewer should glance at this before it ships. The guardrail flagged one or two things worth a second look.',
    tone: 'amber',
  },
  [QualityStatus.LIKELY_FAILURE]: {
    label: 'Likely failure',
    headline:
      'The guardrail thinks this run is probably broken. Don’t ship without fixing what’s flagged below.',
    tone: 'red',
  },
};

const TONE_STYLES: Record<
  'olive' | 'amber' | 'red',
  { bg: string; border: string; accent: string; dot: string }
> = {
  olive: {
    bg: 'rgba(114, 124, 71, 0.08)',
    border: 'rgba(114, 124, 71, 0.35)',
    accent: 'var(--color-olive)',
    dot: 'var(--color-olive)',
  },
  amber: {
    bg: 'rgba(201, 159, 70, 0.09)',
    border: 'rgba(201, 159, 70, 0.45)',
    accent: 'var(--color-gold-leaf)',
    dot: 'var(--color-gold-leaf)',
  },
  red: {
    bg: 'rgba(168, 64, 50, 0.09)',
    border: 'rgba(168, 64, 50, 0.45)',
    accent: '#a84032',
    dot: '#a84032',
  },
};

export function QualitySignalPane({ signal }: Props) {
  const copy = STATUS_COPY[signal.status];
  const tone = TONE_STYLES[copy.tone];
  // Local state for the "what's this?" tooltip. Click-to-open keeps
  // things keyboard and touch accessible — hover-only was failing users
  // on tablets during the demo.
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <section
      className="flex flex-col gap-4"
      style={{
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 'var(--radius-card)',
        padding: 22,
        position: 'relative',
      }}
    >
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: tone.dot,
              display: 'inline-block',
            }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: tone.accent,
              fontWeight: 600,
            }}
          >
            Quality check · {copy.label}
          </span>
          <button
            type="button"
            onClick={() => setInfoOpen(v => !v)}
            aria-label="What is the quality check?"
            title="What is the quality check?"
            className="cursor-pointer inline-flex items-center justify-center"
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              border: `1px solid ${tone.border}`,
              background: 'var(--color-paper)',
              color: tone.accent,
              padding: 0,
            }}
          >
            <Info size={11} strokeWidth={2} />
          </button>
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--color-ink-subtle)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          confidence {(signal.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <p
        style={{
          fontSize: 14.5,
          lineHeight: '21px',
          color: 'var(--color-ink)',
          maxWidth: 760,
        }}
      >
        {copy.headline}
      </p>

      {signal.reasons.length > 0 && (
        <ul
          className="flex flex-col gap-2"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            borderTop: '1px solid var(--color-hairline)',
            paddingTop: 14,
          }}
        >
          {signal.reasons.map((reason, i) => (
            <li
              key={i}
              style={{
                fontSize: 13.5,
                lineHeight: '20px',
                color: 'var(--color-ink-muted)',
                display: 'flex',
                gap: 10,
              }}
            >
              <span
                aria-hidden
                style={{
                  color: tone.accent,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  paddingTop: 3,
                  minWidth: 16,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      <div
        className="font-mono flex flex-wrap gap-x-5 gap-y-1"
        style={{
          fontSize: 10.5,
          letterSpacing: '0.08em',
          color: 'var(--color-ink-subtle)',
          paddingTop: 10,
          borderTop: '1px solid var(--color-hairline)',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{signal.dish_count} dishes</span>
        <span>·</span>
        <span>{(signal.missing_price_ratio * 100).toFixed(0)}% no price</span>
        <span>·</span>
        <span>
          {(signal.missing_category_ratio * 100).toFixed(0)}% no section
        </span>
        <span>·</span>
        <span>
          {(signal.sparse_ingredient_ratio * 100).toFixed(0)}% empty
          ingredients
        </span>
      </div>

      {infoOpen && (
        <div
          role="dialog"
          aria-label="How the quality check works"
          style={{
            marginTop: 4,
            padding: 18,
            background: 'var(--color-paper)',
            border: `1px solid ${tone.border}`,
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-subtle)',
              }}
            >
              What is this?
            </span>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              aria-label="Close"
              className="cursor-pointer"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 2,
                color: 'var(--color-ink-subtle)',
              }}
            >
              <X size={12} strokeWidth={1.8} />
            </button>
          </div>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: '20px',
              color: 'var(--color-ink)',
            }}
          >
            Before Mise tells you the extraction is ready, it runs a short
            automated checklist against what Opus 4.7 returned: enough
            dishes for a real menu, prices present, categories detected,
            ingredients filled in, no obvious duplicates. If anything looks
            off, the verdict drops from <em>Ready</em> to{' '}
            <em>Review recommended</em> or <em>Likely failure</em> and the
            specific reasons show up below — so you know exactly what to
            look at before you publish.
          </p>
          <p
            style={{
              fontSize: 12.5,
              lineHeight: '19px',
              color: 'var(--color-ink-muted)',
            }}
          >
            It's a second pair of eyes, not an AI judging itself — the
            checks are deterministic rules over the extracted data, so the
            verdict is reproducible and can be audited.
          </p>
        </div>
      )}
    </section>
  );
}
