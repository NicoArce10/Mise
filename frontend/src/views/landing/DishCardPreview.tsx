import { useState } from 'react';
import { Code2, Tag, Search, Sparkles } from 'lucide-react';

import { Eyebrow } from '../../components/Eyebrow';

/**
 * Hero-adjacent "this is what Mise returns" preview.
 *
 * Replaces the raw JSON block that previously lived here. The old
 * block dumped 80 lines of brackets on a non-technical reader and
 * made the landing feel like documentation. This version leads with
 * the *visual* shape of a single dish — the same layout the Cockpit
 * shows the reviewer — and gives curious engineers a tidy "Show raw
 * JSON" toggle to drop into the exact payload shape. The toggle is
 * an accordion, not a modal, so the section height is predictable
 * and jumping to the toggle doesn't lose scroll context.
 *
 * The dish shown is intentionally the same Milanesa Napolitana XL
 * used everywhere else on the landing, so the story threads: the
 * MenuPreviewTile (one item), the SearchPreviewCard (one match),
 * and this block (one structured record) all describe the same
 * canonical dish.
 */
export function DishCardPreview() {
  const [showJson, setShowJson] = useState(false);

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%' }}>
      <div className="mb-8 flex items-center gap-3">
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 28,
            height: 1,
            background: 'var(--color-ink-subtle)',
          }}
        />
        <Eyebrow tone="strong">What one dish looks like, after one call</Eyebrow>
      </div>

      <h2
        className="font-display"
        style={{
          fontWeight: 500,
          fontSize: 'clamp(30px, 4.2vw, 48px)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          color: 'var(--color-ink)',
          maxWidth: 880,
          marginBottom: 16,
        }}
      >
        A dish, not a text blob.
      </h2>

      <p
        style={{
          fontSize: 'clamp(15px, 1.25vw, 17px)',
          lineHeight: 1.55,
          color: 'var(--color-ink-muted)',
          maxWidth: 760,
          marginBottom: 32,
        }}
      >
        Every response is a clean, structured record — canonical name, the
        aliases a diner would type, the vernacular they'd actually ask for,
        the ingredients, the price. Indexable in Postgres, Elastic, or a
        vector DB the moment the call returns.
      </p>

      {/* ── Visual dish card ──────────────────────────────── */}
      <div
        style={{
          background: 'var(--color-paper)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-card)',
          padding: 'clamp(24px, 3.5vw, 36px)',
          boxShadow: 'var(--shadow-atmosphere)',
        }}
      >
        {/* Header: canonical name + price */}
        <div
          className="flex items-start justify-between gap-6"
          style={{ marginBottom: 22 }}
        >
          <div className="flex min-w-0 flex-col gap-2">
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-subtle)',
              }}
            >
              Canonical name
            </span>
            <h3
              className="font-display"
              style={{
                fontWeight: 500,
                fontSize: 'clamp(28px, 3.4vw, 38px)',
                lineHeight: 1.08,
                letterSpacing: '-0.015em',
                color: 'var(--color-ink)',
              }}
            >
              Milanesa Napolitana XL
            </h3>
            <span
              className="font-accent"
              style={{
                fontStyle: 'italic',
                color: 'var(--color-ink-muted)',
                fontSize: 15,
              }}
            >
              Breaded cutlet topped with ham, cheese, and tomato — oversized.
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-subtle)',
              }}
            >
              Price
            </span>
            <span
              className="font-display"
              style={{
                fontWeight: 500,
                fontSize: 'clamp(22px, 2.5vw, 28px)',
                lineHeight: '32px',
                color: 'var(--color-ink)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              $18.500 ARS
            </span>
          </div>
        </div>

        <div
          aria-hidden
          style={{
            height: 1,
            background: 'var(--color-hairline)',
            marginBottom: 22,
          }}
        />

        {/* Three lanes: aliases, search terms, ingredients */}
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          <Lane
            icon={<Tag size={14} strokeWidth={1.5} />}
            label="Aliases"
            helper="Spellings for the SAME dish a human might type."
            chips={[
              'Mila Napo XL',
              'Milanesa a la Napolitana',
              'Napo Grande',
              'Milanga napo',
            ]}
          />
          <Lane
            icon={<Search size={14} strokeWidth={1.5} />}
            label="Search terms"
            helper="Vernacular a diner would ask for, region-aware."
            chips={[
              'mila napo abundante',
              'napo con papas',
              'milanesa grande con queso y jamon',
              'algo abundante con queso',
            ]}
          />
          <Lane
            icon={<Sparkles size={14} strokeWidth={1.5} />}
            label="Ingredients"
            helper="Only what the evidence actually shows."
            chips={['ham', 'mozzarella', 'tomato', 'breaded cutlet']}
          />
        </div>

        {/* Metadata footer */}
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-2"
          style={{
            marginTop: 26,
            paddingTop: 18,
            borderTop: '1px solid var(--color-hairline)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            color: 'var(--color-ink-subtle)',
            textTransform: 'uppercase',
          }}
        >
          <span>Type · milanesa</span>
          <span aria-hidden>·</span>
          <span>Lane · canonical</span>
          <span aria-hidden>·</span>
          <span>Evidence · bistro_carta_otoño.pdf</span>
          <span aria-hidden>·</span>
          <span style={{ color: 'var(--color-olive)' }}>
            Confidence · 94%
          </span>
        </div>
      </div>

      {/* ── Raw JSON toggle ───────────────────────────────── */}
      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className="cursor-pointer"
          aria-expanded={showJson}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: 'transparent',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-input)',
            padding: '10px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-muted)',
          }}
        >
          <Code2 size={14} strokeWidth={1.5} />
          {showJson ? 'Hide raw JSON' : 'Show raw JSON · for engineers'}
        </button>

        {showJson && (
          <pre
            className="font-mono"
            style={{
              marginTop: 14,
              padding: '20px 22px',
              background: 'var(--color-ink)',
              color: 'var(--color-paper)',
              borderRadius: 'var(--radius-card)',
              fontSize: 12.5,
              lineHeight: '20px',
              overflowX: 'auto',
              whiteSpace: 'pre',
              maxWidth: '100%',
            }}
          >
{`{
  "id": "dish_milanesa_napolitana_xl",
  "canonical_name": "Milanesa Napolitana XL",
  "description": "Breaded cutlet topped with ham, cheese, and tomato — oversized.",
  "type": "milanesa",
  "lane": "canonical",
  "price": { "value": 18500, "currency": "ARS" },
  "aliases": [
    "Mila Napo XL",
    "Milanesa a la Napolitana",
    "Napo Grande",
    "Milanga napo"
  ],
  "search_terms": [
    "mila napo abundante",
    "napo con papas",
    "milanesa grande con queso y jamon",
    "algo abundante con queso"
  ],
  "ingredients": ["ham", "mozzarella", "tomato", "breaded cutlet"],
  "evidence": [
    { "source": "bistro_carta_otoño.pdf", "page": 1, "confidence": 0.94 }
  ]
}`}
          </pre>
        )}
      </div>
    </div>
  );
}

function Lane({
  icon,
  label,
  helper,
  chips,
}: {
  icon: React.ReactNode;
  label: string;
  helper: string;
  chips: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-subtle)',
        }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <p
        className="font-accent"
        style={{
          fontStyle: 'italic',
          color: 'var(--color-ink-muted)',
          fontSize: 13,
          lineHeight: '18px',
          margin: 0,
        }}
      >
        {helper}
      </p>
      <div className="flex flex-wrap gap-1.5" style={{ marginTop: 4 }}>
        {chips.map((c) => (
          <span
            key={c}
            className="font-mono"
            style={{
              background: 'var(--color-paper-tint)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-chip)',
              padding: '4px 10px',
              fontSize: 11.5,
              color: 'var(--color-ink)',
              whiteSpace: 'nowrap',
            }}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
