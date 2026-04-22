import { ArrowRight } from 'lucide-react';

interface Props {
  onUpload: () => void;
  onSample: () => void;
}

const STEPS = [
  {
    n: '01',
    label: 'Upload',
    body: 'PDFs, photos, chalkboards, screenshots. Any format a restaurant actually has.',
  },
  {
    n: '02',
    label: 'Reconcile',
    body:
      'Opus 4.7 extracts candidates; a deterministic gate merges what obviously is the same dish; adaptive thinking resolves the ambiguous pairs.',
  },
  {
    n: '03',
    label: 'Review',
    body:
      'Every canonical dish carries aliases, provenance, confidence, and a one-line decision summary. Approve, edit, or reject — then export.',
  },
];

interface PreviewDish {
  name: string;
  aliases: string[];
  sources: string[];
  lead: 'Merged' | 'Not merged' | 'Routed';
  summary: string;
  confidence: string;
  emphasis?: boolean;
}

// Static preview rendered inline in place of a video. The three cards mirror
// the exact demo-critical decisions the pipeline enforces (Margherita
// merged across a typo, Pizza Funghi / Calzone Funghi kept separate) so a
// visitor sees the *output* of Mise without needing to upload anything.
const PREVIEW_DISHES: PreviewDish[] = [
  {
    name: 'Margherita',
    aliases: ['Pizza Marghertia', 'Margherita'],
    sources: ['PDF', 'PHOTO', 'BOARD'],
    lead: 'Merged',
    summary:
      'after name matched past a typo and ingredients matched across three branches.',
    confidence: '0.94',
    emphasis: true,
  },
  {
    name: 'Pizza Funghi',
    aliases: ['Pizza Funghi'],
    sources: ['PDF'],
    lead: 'Not merged',
    summary:
      'with Calzone Funghi — shared mushrooms but different dish type (pizza vs calzone).',
    confidence: '0.88',
  },
  {
    name: 'Calzone Funghi',
    aliases: ['Calzone Funghi'],
    sources: ['PHOTO'],
    lead: 'Not merged',
    summary:
      'with Pizza Funghi — different form factor; kept as a separate canonical record.',
    confidence: '0.88',
  },
];

function DishPreviewCard({ dish }: { dish: PreviewDish }) {
  return (
    <article
      className="flex min-w-0 flex-col gap-3"
      style={{
        background: dish.emphasis ? 'var(--color-paper-tint)' : 'var(--color-paper)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
        boxShadow: dish.emphasis ? 'var(--shadow-atmosphere)' : 'none',
        padding: 24,
      }}
    >
      <header className="flex items-baseline justify-between gap-4">
        <h3
          className="font-display"
          style={{
            fontWeight: 500,
            fontSize: 26,
            lineHeight: '30px',
            color: 'var(--color-ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {dish.name}
        </h3>
        <span
          className="font-mono"
          style={{
            fontSize: 13,
            lineHeight: '18px',
            color:
              parseFloat(dish.confidence) >= 0.9
                ? 'var(--color-gold-leaf)'
                : 'var(--color-ink)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {dish.confidence}
        </span>
      </header>

      {dish.aliases.length > 1 && (
        <p
          style={{
            fontSize: 13,
            lineHeight: '18px',
            color: 'var(--color-ink-muted)',
          }}
        >
          {dish.aliases.map((alias, i) => (
            <span key={alias}>
              {i > 0 && <span style={{ color: 'var(--color-ink-subtle)' }}>{' · '}</span>}
              <span
                className={alias.toLowerCase().includes('margh') && alias !== 'Margherita' ? 'font-accent' : ''}
                style={
                  alias.toLowerCase().includes('margh') && alias !== 'Margherita'
                    ? { fontStyle: 'italic' }
                    : undefined
                }
              >
                {alias}
              </span>
            </span>
          ))}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {dish.sources.map(src => (
          <span
            key={src}
            className="caption font-mono"
            style={{
              background: 'var(--color-paper-deep)',
              color: 'var(--color-ink-muted)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-chip)',
              padding: '2px 8px',
              letterSpacing: '0.04em',
              fontSize: 11,
              lineHeight: '16px',
            }}
          >
            {src}
          </span>
        ))}
      </div>

      <p
        style={{
          fontSize: 14,
          lineHeight: '20px',
          color: 'var(--color-ink)',
        }}
      >
        <span
          className="font-accent"
          style={{
            fontStyle: 'italic',
            color:
              dish.lead === 'Merged'
                ? 'var(--color-olive)'
                : dish.lead === 'Not merged'
                  ? 'var(--color-sienna)'
                  : 'var(--color-ink)',
          }}
        >
          {dish.lead}
        </span>{' '}
        <span style={{ color: 'var(--color-ink-muted)' }}>{dish.summary}</span>
      </p>
    </article>
  );
}

export function Landing({ onUpload, onSample }: Props) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--color-paper)' }}
    >
      <header
        className="flex items-baseline justify-between px-6 py-5 md:px-10"
        style={{ borderBottom: '1px solid var(--color-hairline)' }}
      >
        <span
          className="font-display"
          style={{ fontWeight: 500, fontSize: 28, lineHeight: '32px' }}
        >
          Mise
        </span>
        <a
          href="https://github.com/NicoArce10/Mise"
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 14,
            lineHeight: '20px',
            color: 'var(--color-ink-muted)',
            textDecoration: 'none',
            borderBottom: '1px solid var(--color-hairline)',
            paddingBottom: 2,
          }}
        >
          GitHub ↗
        </a>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ---------- Hero block ---------- */}
        <section
          className="flex flex-col items-center gap-8 px-6 pb-12 pt-16 text-center md:px-10 md:pb-20 md:pt-24"
          style={{ maxWidth: 1200, width: '100%', margin: '0 auto' }}
        >
          <h1
            className="font-display"
            style={{
              fontWeight: 500,
              lineHeight: 0.95,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              maxWidth: 900,
              fontStyle: 'normal',
            }}
          >
            <span className="block text-[48px] md:text-[72px]">Messy menus.</span>
            <span className="block text-[48px] md:text-[72px]">Clean catalogs.</span>
          </h1>

          <p
            className="text-[17px] leading-[26px] md:text-[20px] md:leading-[30px]"
            style={{
              color: 'var(--color-ink-muted)',
              maxWidth: 640,
            }}
          >
            Drop any menu — PDF, photo, chalkboard, Instagram post. Mise
            extracts every dish, resolves duplicates across sources, and
            returns a catalog-ready JSON pack with provenance and confidence
            on every decision.
          </p>

          <div className="flex flex-col flex-wrap items-center gap-5 sm:flex-row sm:gap-6" style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={onSample}
              className="cursor-pointer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--color-ochre)',
                color: 'var(--color-paper)',
                border: '1px solid var(--color-ochre)',
                borderRadius: 'var(--radius-input)',
                padding: '14px 24px',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                minHeight: 44,
              }}
            >
              Try a live sample
            </button>
            <button
              type="button"
              onClick={onUpload}
              className="cursor-pointer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                color: 'var(--color-ink)',
                border: 'none',
                padding: '10px 4px',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                fontWeight: 500,
                borderBottom: '1px solid var(--color-ink)',
                minHeight: 44,
              }}
            >
              Upload your own menu
              <ArrowRight size={16} strokeWidth={1.5} />
            </button>
          </div>

          <span
            className="font-mono text-[11px] leading-[16px] md:text-[12px]"
            style={{
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
              marginTop: 4,
              maxWidth: 820,
            }}
          >
            Real Claude Opus 4.7 · Not a canned demo · Open source MIT
          </span>
        </section>

        {/* ---------- Product preview ---------- */}
        <section
          className="px-6 pb-16 md:px-10 md:pb-24"
          style={{ maxWidth: 1200, width: '100%', margin: '0 auto' }}
          aria-label="Example output"
        >
          <div className="flex flex-col gap-3" style={{ marginBottom: 24 }}>
            <span
              className="caption"
              style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
            >
              WHAT MISE RETURNS
            </span>
            <h2
              className="font-display text-[28px] leading-[32px] md:text-[32px] md:leading-[36px]"
              style={{
                fontWeight: 500,
                color: 'var(--color-ink)',
                letterSpacing: '-0.01em',
                maxWidth: 720,
              }}
            >
              One trustworthy record per dish, across every source.
            </h2>
          </div>
          <div
            className="grid gap-6"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            }}
          >
            {PREVIEW_DISHES.map(dish => (
              <DishPreviewCard key={dish.name} dish={dish} />
            ))}
          </div>
        </section>

        {/* ---------- Three steps ---------- */}
        <section
          className="grid gap-10 px-6 py-16 md:px-10 md:py-20"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            maxWidth: 1200,
            width: '100%',
            margin: '0 auto',
            borderTop: '1px solid var(--color-hairline)',
          }}
        >
          {STEPS.map(step => (
            <div key={step.n} className="flex flex-col gap-3">
              <span
                className="font-mono"
                style={{
                  fontSize: 12,
                  lineHeight: '16px',
                  color: 'var(--color-ink-subtle)',
                  letterSpacing: '0.14em',
                }}
              >
                {step.n}
              </span>
              <h3
                className="font-display"
                style={{
                  fontWeight: 500,
                  fontSize: 22,
                  lineHeight: '26px',
                  color: 'var(--color-ink)',
                }}
              >
                {step.label}
              </h3>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: '22px',
                  color: 'var(--color-ink-muted)',
                }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer
        className="flex flex-col items-start justify-between gap-2 px-6 py-5 md:flex-row md:items-center md:px-10"
        style={{
          borderTop: '1px solid var(--color-hairline)',
          fontSize: 13,
          color: 'var(--color-ink-subtle)',
        }}
      >
        <span>Open source · MIT · Built for the Built with Opus 4.7 hackathon</span>
        <span className="font-mono" style={{ fontSize: 12 }}>claude-opus-4-7</span>
      </footer>
    </div>
  );
}
