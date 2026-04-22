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

export function Landing({ onUpload, onSample }: Props) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--color-paper)' }}
    >
      <header
        className="flex items-baseline justify-between px-10 py-5"
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

      <main
        className="flex flex-1 flex-col"
        style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '80px 120px' }}
      >
        <section className="flex flex-col gap-8" style={{ maxWidth: 820 }}>
          <span
            className="font-mono"
            style={{
              fontSize: 12,
              lineHeight: '16px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
            }}
          >
            The ingestion engine for dish-first apps
          </span>
          <h1
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: 64,
              lineHeight: '68px',
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              fontStyle: 'italic',
            }}
          >
            Messy menus in. Canonical dish records out.
          </h1>
          <p
            className="font-accent"
            style={{
              fontStyle: 'italic',
              fontSize: 20,
              lineHeight: '30px',
              color: 'var(--color-ink-muted)',
              maxWidth: 720,
            }}
          >
            Drop PDFs, photos, chalkboards, and Instagram posts. Claude Opus 4.7
            extracts dishes, reconciles duplicates, and returns a catalog-ready
            JSON pack — auditable, with provenance and confidence on every decision.
          </p>
          <div className="flex flex-wrap items-center gap-6" style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={onUpload}
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
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              Upload your menus
              <ArrowRight size={16} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={onSample}
              className="cursor-pointer"
              style={{
                background: 'transparent',
                color: 'var(--color-ink)',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                fontWeight: 500,
                borderBottom: '1px solid var(--color-ink)',
              }}
            >
              See a live sample
            </button>
          </div>
        </section>

        <section
          className="grid gap-10"
          style={{
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            marginTop: 96,
            paddingTop: 48,
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
        className="flex items-center justify-between px-10 py-5"
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
