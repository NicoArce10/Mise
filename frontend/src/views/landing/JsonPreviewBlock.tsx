import { motion } from 'motion/react';

import { Eyebrow } from '../../components/Eyebrow';

const EASE = [0.22, 0.61, 0.36, 1] as const;

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-10% 0px' },
  transition: { duration: 0.5, ease: EASE, delay },
});

/**
 * Concrete evidence for every claim in the "How Mise compares" table above:
 * aliases, search terms, and the ephemerals lane are populated by the model
 * on the first call — no post-processing, no secondary endpoint.
 *
 * Rendered as its own section after the comparison grid so non-technical
 * readers get the story first (hero → problem → compare) and the JSON
 * lands as proof, not as the hero itself.
 */
export function JsonPreviewBlock() {
  return (
    <>
      <motion.div {...reveal(0.1)} className="mb-8" style={{ maxWidth: 880 }}>
        <div className="mb-4 flex items-center gap-3">
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 24,
              height: 1,
              background: 'var(--color-ink-subtle)',
            }}
          />
          <Eyebrow tone="strong">Proof · the actual first-call response</Eyebrow>
        </div>
        <p
          style={{
            fontSize: 'clamp(15px, 1.25vw, 17px)',
            lineHeight: 1.55,
            color: 'var(--color-ink-muted)',
            maxWidth: 720,
          }}
        >
          Everything the grid above claims Mise returns is in this payload.
          The aliases diners type, the vernacular search terms, the specials
          lane split from the canonical menu — all populated by the model,
          in one call, with no post-processing on the integrator's side.
        </p>
      </motion.div>

      <motion.div
        {...reveal(0.18)}
        style={{
          background: 'var(--color-ink)',
          borderRadius: 'var(--radius-card)',
          padding: '24px 28px 28px',
          maxWidth: 880,
          boxShadow: 'var(--shadow-atmosphere)',
          overflow: 'hidden',
        }}
      >
        <div
          className="mb-4 flex items-center justify-between gap-3"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-paper-deep)',
          }}
        >
          <span>First-call response · full menu</span>
          <span
            style={{
              background: 'var(--color-olive)',
              color: 'var(--color-paper)',
              padding: '2px 10px',
              borderRadius: 'var(--radius-chip)',
              fontSize: 10,
              letterSpacing: '0.12em',
              fontWeight: 600,
            }}
          >
            200 OK
          </span>
        </div>

        <pre
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: '20px',
            color: 'var(--color-paper)',
            whiteSpace: 'pre',
            margin: 0,
            overflowX: 'auto',
          }}
        >
          <span style={{ color: 'var(--color-paper-deep)' }}>{`{`}</span>
          {'\n  '}
          <span style={{ color: '#FFD27A' }}>"dishes"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>: [</span>
          {'\n    {'}
          {'\n      '}
          <span style={{ color: '#FFD27A' }}>"canonical_name"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>: </span>
          <span style={{ color: '#9FD99F' }}>"Milanesa Napolitana"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>,</span>
          {'\n      '}
          <span style={{ color: '#FFD27A' }}>"aliases"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>: [</span>
          <span style={{ color: '#9FD99F' }}>"mila napo"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>, </span>
          <span style={{ color: '#9FD99F' }}>"mila a la napo"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>, </span>
          <span style={{ color: '#9FD99F' }}>"napo XL"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>],</span>
          <span
            style={{
              color: 'var(--color-gold-leaf)',
              marginLeft: 12,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            ← typed by diners
          </span>
          {'\n      '}
          <span style={{ color: '#FFD27A' }}>"search_terms"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>: [</span>
          <span style={{ color: '#9FD99F' }}>"breaded cutlet"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>, </span>
          <span style={{ color: '#9FD99F' }}>"ham cheese tomato"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>],</span>
          {'\n      '}
          <span style={{ color: '#FFD27A' }}>"ingredients"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>: [</span>
          <span style={{ color: '#9FD99F' }}>"beef"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>, </span>
          <span style={{ color: '#9FD99F' }}>"breadcrumb"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>, </span>
          <span style={{ color: '#9FD99F' }}>"ham"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>, </span>
          <span style={{ color: '#9FD99F' }}>"mozzarella"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>],</span>
          {'\n      '}
          <span style={{ color: '#FFD27A' }}>"price"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>: </span>
          <span style={{ color: '#E8B4FF' }}>18500</span>
          {'\n    },'}
          {'\n    '}
          <span style={{ color: 'var(--color-paper-deep)' }}>… 23 more canonical dishes</span>
          {'\n  ],'}
          {'\n  '}
          <span style={{ color: '#FFD27A' }}>"ephemerals"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>: [</span>
          <span
            style={{
              color: 'var(--color-gold-leaf)',
              marginLeft: 12,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            ← separated from canonical, never returned by Veryfi / Klippa
          </span>
          {'\n    {'}
          {'\n      '}
          <span style={{ color: '#FFD27A' }}>"name"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>: </span>
          <span style={{ color: '#9FD99F' }}>"Berenjenas a la napoletana"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>,</span>
          {'\n      '}
          <span style={{ color: '#FFD27A' }}>"lane"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>: </span>
          <span style={{ color: '#9FD99F' }}>"chef_suggestions"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>,</span>
          {'\n      '}
          <span style={{ color: '#FFD27A' }}>"evidence"</span>
          <span style={{ color: 'var(--color-paper-deep)' }}>: </span>
          <span style={{ color: '#9FD99F' }}>"Sugerencias del chef section · page 2"</span>
          {'\n    }'}
          {'\n  ]'}
          {'\n'}
          <span style={{ color: 'var(--color-paper-deep)' }}>{`}`}</span>
        </pre>

        <div
          className="mt-5 pt-4 flex flex-wrap items-center gap-x-4 gap-y-1"
          style={{
            borderTop: '1px solid rgba(251, 248, 242, 0.15)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-paper-deep)',
          }}
        >
          <span>Indexable by Postgres · Elastic · Algolia · vector DBs</span>
          <span aria-hidden>·</span>
          <span style={{ color: 'var(--color-gold-leaf)' }}>No LLM in the hot path</span>
        </div>
      </motion.div>
    </>
  );
}
