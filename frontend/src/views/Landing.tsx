import { ArrowRight, FileText, Search } from 'lucide-react';
import { motion } from 'motion/react';

import { Eyebrow } from '../components/Eyebrow';
import { JsonPreviewBlock } from './landing/JsonPreviewBlock';

interface Props {
  onUpload: () => void;
  onSample: () => void;
}

// ─────────────────────────────────────────────────────────────
//  Shared tokens
// ─────────────────────────────────────────────────────────────

const CONTAINER_MAX = 1200;
const SECTION_PX = 'px-6 md:px-10';
const EASE = [0.22, 0.61, 0.36, 1] as const;
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE, delay },
});

// ─────────────────────────────────────────────────────────────
//  Eyebrow
// ─────────────────────────────────────────────────────────────

// `Eyebrow` lives in its own module so `views/landing/JsonPreviewBlock.tsx`
// can reuse it without importing this (very large) file.
// — see `components/Eyebrow.tsx`.

// ─────────────────────────────────────────────────────────────
//  CTAs
// ─────────────────────────────────────────────────────────────

function PrimaryCta({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer group"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--color-ink)',
        color: 'var(--color-paper)',
        border: '1px solid var(--color-ink)',
        borderRadius: 'var(--radius-input)',
        padding: '18px 28px',
        fontFamily: 'var(--font-sans)',
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        minHeight: 52,
        transition: 'background-color 180ms ease, border-color 180ms ease',
      }}
    >
      {children}
      <ArrowRight
        size={18}
        strokeWidth={1.75}
        style={{ transition: 'transform 180ms ease' }}
        className="group-hover:translate-x-[2px]"
      />
    </button>
  );
}

function SecondaryCta({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        background: 'transparent',
        color: 'var(--color-ink)',
        border: 'none',
        padding: '14px 4px 12px 4px',
        fontFamily: 'var(--font-sans)',
        fontSize: 16,
        fontWeight: 500,
        borderBottom: '1px solid var(--color-ink)',
        minHeight: 52,
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
//  Evidence tiles
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  Menu preview tile — one file representing the restaurant's
//  actual menu. Not "three sources with the same dish" (that
//  was the old reconciliation narrative). Just: this is what
//  you upload, here's how Opus 4.7 sees the whole menu at once.
// ─────────────────────────────────────────────────────────────

function MenuPreviewTile() {
  return (
    <div
      style={{
        background: 'var(--color-paper-deep)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-input)',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-hairline)',
          background: 'var(--color-paper)',
        }}
      >
        <div
          className="flex shrink-0 items-center justify-center"
          style={{
            width: 36,
            height: 36,
            background: 'var(--color-paper-deep)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-chip)',
            color: 'var(--color-ink-muted)',
          }}
        >
          <FileText size={16} strokeWidth={1.5} />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              color: 'var(--color-ink-subtle)',
              textTransform: 'uppercase',
            }}
          >
            PDF · 2 pages
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 12,
              color: 'var(--color-ink)',
            }}
          >
            bistro_carta_otoño.pdf
          </span>
        </div>
      </div>

      <div
        className="font-accent"
        style={{
          padding: '24px 28px 28px',
          fontStyle: 'italic',
          color: 'var(--color-ink)',
          fontSize: 14,
          lineHeight: '22px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontStyle: 'normal',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-subtle)',
            marginBottom: 10,
          }}
        >
          — Principales —
        </div>

        <div className="flex items-baseline justify-between gap-4" style={{ marginBottom: 8 }}>
          <span>Milanesa Napolitana XL</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontStyle: 'normal',
              fontSize: 12,
              color: 'var(--color-ink-muted)',
            }}
          >
            $18.500
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4" style={{ marginBottom: 8 }}>
          <span>Lomito completo</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontStyle: 'normal',
              fontSize: 12,
              color: 'var(--color-ink-muted)',
            }}
          >
            $16.200
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4" style={{ marginBottom: 8 }}>
          <span>Ñoquis del 29 con tuco</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontStyle: 'normal',
              fontSize: 12,
              color: 'var(--color-ink-muted)',
            }}
          >
            $9.800
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4" style={{ marginBottom: 14 }}>
          <span>Provoleta a la parrilla</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontStyle: 'normal',
              fontSize: 12,
              color: 'var(--color-ink-muted)',
            }}
          >
            $7.400
          </span>
        </div>

        <div
          className="flex items-center justify-between gap-3"
          style={{
            fontFamily: 'var(--font-mono)',
            fontStyle: 'normal',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-subtle)',
            marginBottom: 10,
            marginTop: 6,
          }}
        >
          <span>— Sugerencias del chef —</span>
          <span
            style={{
              background: 'var(--color-gold-leaf)',
              color: 'var(--color-paper)',
              borderRadius: 'var(--radius-chip)',
              padding: '2px 8px',
              fontSize: 9,
              letterSpacing: '0.14em',
              fontWeight: 600,
            }}
          >
            LTO · auto
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-4" style={{ marginBottom: 6 }}>
          <span>Berenjenas a la napoletana (veggie)</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontStyle: 'normal',
              fontSize: 12,
              color: 'var(--color-ink-muted)',
            }}
          >
            $11.900
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontStyle: 'normal',
            fontSize: 11,
            color: 'var(--color-ink-subtle)',
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px dashed var(--color-hairline)',
            lineHeight: '16px',
          }}
        >
          <span style={{ color: 'var(--color-ink-muted)' }}>
            Mise splits this lane into <code style={{ color: 'var(--color-ink)' }}>ephemerals[]</code>
          </span>
          <br />
          <span>… 23 more canonical dishes on the menu</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Search frame — replaces the old "canonical record" card.
//  This is the product's actual star: a human query resolves
//  into an evidence-grounded dish match with aliases &
//  matched_on reasons.
// ─────────────────────────────────────────────────────────────

function SearchPreviewCard() {
  return (
    <div
      className="flex flex-col gap-4"
      style={{
        background: 'var(--color-paper-tint)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
        padding: 24,
        boxShadow: 'var(--shadow-atmosphere)',
      }}
    >
      {/* Query bar */}
      <div
        className="flex items-center gap-3"
        style={{
          background: 'var(--color-paper)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-input)',
          padding: '12px 16px',
        }}
      >
        <Search size={16} strokeWidth={1.5} style={{ color: 'var(--color-ink-muted)' }} />
        <span
          className="font-accent"
          style={{
            fontStyle: 'italic',
            fontSize: 17,
            lineHeight: '22px',
            color: 'var(--color-ink)',
            letterSpacing: '-0.005em',
          }}
        >
          mila napo abundante
        </span>
      </div>

      {/* Interpretation */}
      <div className="flex flex-col gap-1">
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-subtle)',
          }}
        >
          Interpretation
        </span>
        <p
          className="font-accent"
          style={{
            fontStyle: 'italic',
            fontSize: 15,
            lineHeight: '22px',
            color: 'var(--color-ink-muted)',
          }}
        >
          “Looking for a large milanesa napolitana — breaded cutlet topped with ham, cheese, and tomato.”
        </p>
      </div>

      {/* Match card */}
      <div
        className="flex items-start justify-between gap-4"
        style={{
          background: 'var(--color-paper)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-input)',
          padding: 18,
        }}
      >
        <div className="flex min-w-0 flex-col gap-2">
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
            Milanesa Napolitana XL
          </h3>
          <div
            className="flex flex-wrap items-center gap-2"
            style={{ fontSize: 12 }}
          >
            <span
              className="font-mono"
              style={{
                background: 'var(--color-paper-tint)',
                color: 'var(--color-ink-muted)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-chip)',
                padding: '2px 8px',
                letterSpacing: '0.12em',
                fontSize: 10,
                textTransform: 'uppercase',
              }}
            >
              alias
            </span>
            <span
              className="font-mono"
              style={{
                background: 'var(--color-paper-tint)',
                color: 'var(--color-ink-muted)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-chip)',
                padding: '2px 8px',
                letterSpacing: '0.12em',
                fontSize: 10,
                textTransform: 'uppercase',
              }}
            >
              search term
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-ink-subtle)',
                marginLeft: 4,
              }}
            >
              also known as mila napo · mila a la napo · napo XL
            </span>
          </div>
          <p
            className="font-accent"
            style={{
              fontStyle: 'italic',
              fontSize: 14,
              lineHeight: '20px',
              color: 'var(--color-ink-muted)',
            }}
          >
            <span style={{ color: 'var(--color-olive)', fontStyle: 'italic', fontSize: 15 }}>Why</span>{' '}
            alias “mila napo” matched · XL portion on the menu.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="font-mono"
            style={{
              fontSize: 13,
              color: 'var(--color-olive)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.04em',
            }}
          >
            94%
          </span>
          <span
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: 20,
              lineHeight: '24px',
              color: 'var(--color-ink)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            $18.500
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-2"
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-subtle)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ color: 'var(--color-gold-leaf)' }}>◆</span>
        <span>Adaptive thinking engaged · 1 ambiguous query</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Pillars — reframed around understanding, not extraction
// ─────────────────────────────────────────────────────────────

const PILLARS = [
  {
    n: '01',
    title: 'Vision-native ingestion',
    body:
      'PDFs, photos, chalkboards, and Instagram screenshots stream directly into Opus 4.7 vision. No OCR in the critical path, no chunker, no pre-processing pipeline to maintain.',
  },
  {
    n: '02',
    title: 'Canonical menu vs daily specials, auto-separated',
    body:
      'LTOs, seasonal inserts and chef\'s suggestions are detected from layout + language cues and split into their own lane — so your catalog stays stable and your promotions stay promotional. Competitors return a single flat list.',
  },
  {
    n: '03',
    title: 'Aliases + search terms populated on first call',
    body:
      'Every dish ships with canonical name, aliases (typos, shorthand, regional names) and the vernacular a diner would actually type — so Postgres full-text, Elastic, Algolia or a vector DB can serve queries in milliseconds. No LLM in the hot path.',
  },
  {
    n: '04',
    title: 'Adaptive thinking, only when it is earned',
    body:
      'A deterministic gate classifies every dish pair and every query as obvious or ambiguous. Opus 4.7 adaptive thinking is invoked only on the ambiguous cases — the rest never touch the model.',
  },
];

// ─────────────────────────────────────────────────────────────
//  Principles — defensible architectural claims only.
//  Every line here can be pointed at an exact place in the code
//  or the demo video. No invented benchmarks.
// ─────────────────────────────────────────────────────────────

const PRINCIPLES = [
  {
    value: 'Evidence-grounded',
    label: 'Never invents a dish',
    hint: 'Results are filtered to the extracted dish graph, not the model\'s world knowledge.',
  },
  {
    value: 'Vision-native',
    label: 'No external OCR',
    hint: 'PDFs as document blocks, photos as image blocks, direct to Opus 4.7.',
  },
  {
    value: 'Schema-validated',
    label: 'Zero parse failures',
    hint: 'Every LLM call is JSON-schema constrained and re-validated by Pydantic.',
  },
  {
    value: 'Adaptive thinking',
    label: 'Only when it matters',
    hint: 'A deterministic gate routes obvious cases; the model only thinks on the hard ones.',
  },
];

// ─────────────────────────────────────────────────────────────
//  Who it is for
// ─────────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    target: 'Review & discovery apps',
    example: 'Beli · Resy lists · dish-rating apps',
    need: 'Stable dish IDs across branches, aliases for what diners type, ingredients for filtering.',
    payload: 'canonical_name · aliases · search_terms · ingredients · sources',
  },
  {
    target: 'Delivery platforms',
    example: 'Rappi · PedidosYa · Uber Eats · DoorDash',
    need: 'Item list with prices, grouped modifiers, no ephemeral specials polluting the menu.',
    payload: 'dishes[].price · dishes[].modifiers · ephemerals filtered out',
  },
  {
    target: 'POS / catalog migrations',
    example: 'A chain of 12 locations with a PDF each',
    need: 'Dedup across branch menus, typo normalization, structured modifiers.',
    payload: 'reconciled dishes · typos folded into aliases · modifier relationships',
  },
  {
    target: 'Voice & chat ordering agents',
    example: 'WhatsApp bots, voice-AI waiters',
    need: 'The vernacular real humans use — shorthand, regional names, misspellings.',
    payload: 'search_terms populated by Opus from evidence + diner knowledge',
  },
];

const AUDIENCES = [
  {
    title: 'Delivery marketplaces',
    example: 'Rappi · PedidosYa · iFood · DoorDash · Uber Eats',
    body:
      'Onboarding a new restaurant without a POS takes 2–3 hours of manual menu entry per location. Mise turns that into a 30-second API call — aliases, categories and daily-specials lanes included — so your ops team scales with headcount, not head-count-squared.',
  },
  {
    title: 'Menu aggregators & commerce platforms',
    example: 'Deliverect · Checkmate · Tillster-style vendors',
    body:
      'You already normalize menus across channels. Mise gives you a cleaner starting point: a dish graph with aliases and LTOs already tagged, so your sync engine doesn\'t have to guess which items are promotional.',
  },
  {
    title: 'POS-less restaurants in emerging markets',
    example: 'LatAm · SEA · MENA independent restaurants',
    body:
      'Tens of thousands of small restaurants keep their menu as a laminated PDF or a phone photo. Mise converts that into a digital catalog good enough to plug into any delivery or discovery product — no POS, no engineering, no rewrite.',
  },
];

// ─────────────────────────────────────────────────────────────
//  Landing view
// ─────────────────────────────────────────────────────────────

export function Landing({ onUpload, onSample }: Props) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--color-paper)' }}
    >
      {/* ═══════════════ HEADER ═══════════════ */}
      <header
        className={`flex items-center justify-between py-5 md:py-6 ${SECTION_PX}`}
        style={{
          borderBottom: '1px solid var(--color-hairline)',
          maxWidth: CONTAINER_MAX,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div className="flex items-baseline gap-3">
          <span
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: 26,
              lineHeight: '30px',
              letterSpacing: '-0.01em',
            }}
          >
            Mise
          </span>
          <span
            className="font-mono hidden sm:inline"
            style={{
              fontSize: 11,
              lineHeight: '14px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
            }}
          >
            The dish understanding engine
          </span>
        </div>
        <div className="flex items-center gap-5">
          <span
            className="hidden md:inline font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
            }}
          >
            Built on claude&#8209;opus&#8209;4&#8209;7
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
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ═══════════════ HERO ═══════════════ */}
        <section
          className={`${SECTION_PX} pt-10 pb-16 md:pt-14 md:pb-20`}
          style={{
            maxWidth: CONTAINER_MAX,
            width: '100%',
            margin: '0 auto',
          }}
        >
          <motion.div {...reveal(0)} className="mb-5 flex items-center gap-3">
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 28,
                height: 1,
                background: 'var(--color-ink-subtle)',
              }}
            />
            <Eyebrow tone="strong">Menu digitization · for delivery platforms & aggregators</Eyebrow>
          </motion.div>

          <motion.h1
            {...reveal(0.04)}
            className="font-display"
            style={{
              fontWeight: 500,
              lineHeight: 1.02,
              letterSpacing: '-0.025em',
              color: 'var(--color-ink)',
              fontSize: 'clamp(44px, 6.4vw, 80px)',
              marginBottom: 20,
              maxWidth: 1040,
            }}
          >
            Onboard a restaurant{' '}
            <span
              className="font-accent"
              style={{
                fontStyle: 'italic',
                letterSpacing: '-0.02em',
                color: 'var(--color-ink)',
              }}
            >
              in seconds,
            </span>{' '}
            not hours.
          </motion.h1>

          <motion.p
            {...reveal(0.08)}
            style={{
              fontSize: 'clamp(16px, 1.4vw, 19px)',
              lineHeight: 1.5,
              color: 'var(--color-ink-muted)',
              maxWidth: 720,
              marginBottom: 28,
            }}
          >
            Drop a menu PDF or a photo. Get a{' '}
            <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>
              production-ready JSON catalog
            </span>
            {' '}with aliases, ingredients and daily specials already separated —
            indexable by any search engine. One call to Opus 4.7 vision, no OCR pipeline,
            no manual cleanup.
          </motion.p>

          <motion.div {...reveal(0.12)} className="flex flex-wrap items-center gap-4 md:gap-6">
            <PrimaryCta onClick={onSample}>Try with a real menu</PrimaryCta>
            <SecondaryCta onClick={onUpload}>Upload your own</SecondaryCta>
          </motion.div>

          <motion.div
            {...reveal(0.18)}
            className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2"
            style={{
              fontSize: 11,
              lineHeight: '16px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>Real Claude Opus 4.7</span>
            <span aria-hidden style={{ color: 'var(--color-ink-subtle)' }}>·</span>
            <span>Vision-native · no OCR</span>
            <span aria-hidden style={{ color: 'var(--color-ink-subtle)' }}>·</span>
            <span>Open source · MIT</span>
          </motion.div>
        </section>

        {/* ═══════════════ PROBLEM ═══════════════ */}
        <section
          className={`${SECTION_PX} py-24 md:py-32`}
          style={{
            background: 'var(--color-paper-tint)',
            borderTop: '1px solid var(--color-hairline)',
            borderBottom: '1px solid var(--color-hairline)',
          }}
        >
          <div
            style={{
              maxWidth: CONTAINER_MAX,
              width: '100%',
              margin: '0 auto',
            }}
          >
            <div className="mb-10 flex items-center gap-3">
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 28,
                  height: 1,
                  background: 'var(--color-ink-subtle)',
                }}
              />
              <Eyebrow tone="strong">The problem, in the industry's own words</Eyebrow>
            </div>

            <h2
              className="font-display"
              style={{
                fontWeight: 500,
                fontSize: 'clamp(36px, 5.5vw, 64px)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: 'var(--color-ink)',
                maxWidth: 980,
                marginBottom: 40,
              }}
            >
              Every new restaurant takes{' '}
              <span
                className="font-accent"
                style={{ fontStyle: 'italic', color: 'var(--color-sienna)' }}
              >
                2–3 hours
              </span>{' '}
              to onboard.
              <br />
              Multiply by ten thousand.
            </h2>

            <div
              className="grid gap-10 md:gap-14"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
            >
              {[
                [
                  '2–3 hours per menu',
                  <span>
                    Manual digitization of a single restaurant menu takes 2–3 hours
                    — a figure{' '}
                    <a
                      href="https://www.veryfi.com/restaurant-menu-ocr-api/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--color-ink)', textDecoration: 'underline dotted' }}
                    >
                      published by Veryfi
                    </a>
                    {' '}themselves. For a delivery marketplace onboarding thousands of
                    restaurants, that's a full engineering team's worth of operator hours.
                  </span>,
                ],
                [
                  '240 hours per year, per restaurant',
                  <span>
                    Keeping the same menu in sync across DoorDash, Uber Eats, Grubhub,
                    and the restaurant's own app costs up to{' '}
                    <a
                      href="https://www.eats365pos.com/us/blog/post/menu-management-mistakes-avoid-them"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--color-ink)', textDecoration: 'underline dotted' }}
                    >
                      240 labor hours a year
                    </a>
                    . Most of it is manual re-entry.
                  </span>,
                ],
                [
                  'No POS, no API',
                  <span>
                    In emerging markets (LatAm, SEA, MENA) most restaurants don't run
                    Toast or Square. Their menu lives as a PDF, a WhatsApp photo, or a
                    laminated sheet — never as an API response. That's the gap Mise fills.
                  </span>,
                ],
              ].map(([title, body]) => (
                <div key={String(title)} className="flex flex-col gap-3">
                  <h3
                    className="font-display"
                    style={{
                      fontWeight: 500,
                      fontSize: 22,
                      lineHeight: '28px',
                      color: 'var(--color-ink)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    style={{
                      fontSize: 16,
                      lineHeight: '26px',
                      color: 'var(--color-ink-muted)',
                    }}
                  >
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ COMPETITIVE COMPARE ═══════════════ */}
        <section
          className={`${SECTION_PX} py-24 md:py-32`}
          style={{
            maxWidth: CONTAINER_MAX,
            width: '100%',
            margin: '0 auto',
          }}
        >
          <div className="mb-10 flex items-center gap-3">
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 28,
                height: 1,
                background: 'var(--color-ink-subtle)',
              }}
            />
            <Eyebrow tone="strong">How Mise compares</Eyebrow>
          </div>

          <h2
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: 'clamp(32px, 4.5vw, 52px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              maxWidth: 980,
              marginBottom: 16,
            }}
          >
            DoorDash built this for themselves.{' '}
            <span
              className="font-accent"
              style={{ fontStyle: 'italic', color: 'var(--color-ink-muted)' }}
            >
              Opus 4.7 lets us ship it as an API.
            </span>
          </h2>

          <p
            style={{
              fontSize: 'clamp(15px, 1.3vw, 17px)',
              lineHeight: 1.55,
              color: 'var(--color-ink-muted)',
              maxWidth: 860,
              marginBottom: 16,
            }}
          >
            DoorDash's engineering team publicly{' '}
            <a
              href="https://careersatdoordash.com/blog/doordash-llm-transcribe-menu/"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-ink)', textDecoration: 'underline dotted' }}
            >
              documented their approach
            </a>
            : OCR extracts text, an LLM turns the text into structured data, a
            LightGBM classifier predicts whether the result is good enough, and
            anything uncertain is routed to a human reviewer. It runs in production,
            at scale — and it stays inside DoorDash. Every other delivery platform,
            aggregator, or sync tool has to build something comparable on their own.
          </p>

          <p
            style={{
              fontSize: 'clamp(15px, 1.3vw, 17px)',
              lineHeight: 1.55,
              color: 'var(--color-ink-muted)',
              maxWidth: 860,
              marginBottom: 16,
            }}
          >
            Commercial APIs like{' '}
            <a
              href="https://www.veryfi.com/restaurant-menu-ocr-api/"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-ink)', textDecoration: 'underline dotted' }}
            >
              Veryfi
            </a>{' '}
            and{' '}
            <a
              href="https://klippa.com/en/ocr/data-fields/menu-cards"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-ink)', textDecoration: 'underline dotted' }}
            >
              Klippa
            </a>{' '}
            cover the ingestion piece, but their output stops at item name, price, and
            section. The aliases a diner actually types, the vernacular search terms,
            the fact that Tuesday's chalkboard special is not part of the printed
            menu — that work still falls on whoever integrates them.
          </p>

          <p
            style={{
              fontSize: 'clamp(15px, 1.3vw, 17px)',
              lineHeight: 1.55,
              color: 'var(--color-ink-muted)',
              maxWidth: 860,
              marginBottom: 40,
            }}
          >
            Mise is a vision-native take on the same problem. Opus 4.7 reads the
            photo directly — no separate OCR stage — and returns the canonical menu,
            aliases, search terms, specials lane, and a quality signal in a single
            call. Shape is stable, ready for Postgres, Elastic, or a vector DB on
            day one.
          </p>

          <div
            style={{
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
              background: 'var(--color-paper)',
            }}
          >
            {/* Header row */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.1fr',
                background: 'var(--color-paper-tint)',
                borderBottom: '1px solid var(--color-hairline)',
              }}
            >
              {[
                'Capability',
                'Mise',
                'Veryfi',
                'Klippa',
                'DoorDash (internal)',
              ].map((h, i) => (
                <div
                  key={h}
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: i === 1 ? 'var(--color-ink)' : 'var(--color-ink-subtle)',
                    padding: '16px 18px',
                    fontWeight: i === 1 ? 600 : 400,
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            {([
              {
                cap: 'Available as third-party API',
                mise: 'Yes · open source',
                veryfi: 'Yes · $500/mo min',
                klippa: 'Yes · custom quote',
                dd: 'No · internal only',
                unique: false,
              },
              {
                cap: 'Ingestion',
                mise: 'Vision-native · 1 call',
                veryfi: 'OCR → NLP',
                klippa: 'OCR → NLP',
                dd: 'OCR → LLM + guardrail',
                unique: true,
              },
              {
                cap: 'Item + price + category',
                mise: 'Yes',
                veryfi: 'Yes',
                klippa: 'Yes',
                dd: 'Yes',
                unique: false,
              },
              {
                cap: 'Aliases populated on first call',
                mise: 'Yes',
                veryfi: 'Build your own',
                klippa: 'Build your own',
                dd: 'Not in public writeups',
                unique: true,
              },
              {
                cap: 'Search terms (diner vernacular)',
                mise: 'Yes',
                veryfi: 'Not provided',
                klippa: 'Not provided',
                dd: 'Not in public writeups',
                unique: true,
              },
              {
                cap: 'Canonical vs daily specials / LTOs',
                mise: 'Auto-separated',
                veryfi: 'Not distinguished',
                klippa: 'Not distinguished',
                dd: 'Not distinguished',
                unique: true,
              },
              {
                cap: 'Multilingual',
                mise: 'Automatic · same model',
                veryfi: 'Latin langs, on request',
                klippa: 'Latin langs',
                dd: 'Unspecified',
                unique: false,
              },
              {
                cap: 'Quality signal on every response',
                mise: 'Yes · heuristic guardrail',
                veryfi: 'Not exposed',
                klippa: 'Not exposed',
                dd: 'Yes · LightGBM classifier',
                unique: true,
              },
              {
                cap: 'Indexable in Postgres / Elastic / vector DB on day one',
                mise: 'Yes',
                veryfi: 'Post-processing',
                klippa: 'Post-processing',
                dd: 'Internal schema only',
                unique: true,
              },
            ] as const).map((row, idx, arr) => (
              <div
                key={row.cap}
                className="grid"
                style={{
                  gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.1fr',
                  borderBottom: idx < arr.length - 1 ? '1px solid var(--color-hairline)' : 'none',
                  background: row.unique ? 'rgba(201, 159, 70, 0.06)' : 'transparent',
                }}
              >
                <div
                  style={{
                    padding: '14px 18px',
                    fontSize: 13.5,
                    lineHeight: '21px',
                    color: 'var(--color-ink)',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{row.cap}</span>
                  {row.unique && (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--color-gold-leaf)',
                        border: '1px solid var(--color-gold-leaf)',
                        padding: '1px 6px',
                        borderRadius: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Only Mise
                    </span>
                  )}
                </div>
                <div
                  style={{
                    padding: '14px 18px',
                    fontSize: 13.5,
                    lineHeight: '21px',
                    color: 'var(--color-ink)',
                    background: row.unique
                      ? 'rgba(201, 159, 70, 0.14)'
                      : 'var(--color-paper-tint)',
                    borderLeft: '1px solid var(--color-hairline)',
                    borderRight: '1px solid var(--color-hairline)',
                    fontWeight: row.unique ? 600 : 400,
                  }}
                >
                  {row.mise}
                </div>
                <div
                  style={{
                    padding: '14px 18px',
                    fontSize: 13.5,
                    lineHeight: '21px',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  {row.veryfi}
                </div>
                <div
                  style={{
                    padding: '14px 18px',
                    fontSize: 13.5,
                    lineHeight: '21px',
                    color: 'var(--color-ink-muted)',
                    borderLeft: '1px solid var(--color-hairline)',
                  }}
                >
                  {row.klippa}
                </div>
                <div
                  style={{
                    padding: '14px 18px',
                    fontSize: 13.5,
                    lineHeight: '21px',
                    color: 'var(--color-ink-muted)',
                    borderLeft: '1px solid var(--color-hairline)',
                  }}
                >
                  {row.dd}
                </div>
              </div>
            ))}
          </div>

          <p
            className="font-mono"
            style={{
              fontSize: 11,
              lineHeight: '18px',
              letterSpacing: '0.08em',
              color: 'var(--color-ink-subtle)',
              marginTop: 16,
              maxWidth: 900,
            }}
          >
            Sources — Veryfi & Klippa: public product pages linked above. DoorDash:
            their own{' '}
            <a
              href="https://careersatdoordash.com/blog/doordash-llm-transcribe-menu/"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-ink)', textDecoration: 'underline dotted' }}
            >
              engineering blog
            </a>
            , with additional analysis on{' '}
            <a
              href="https://blog.bytebytego.com/p/how-doordash-uses-ai-models-to-understand"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-ink)', textDecoration: 'underline dotted' }}
            >
              ByteByteGo
            </a>
            . The "Mise" column is the actual payload the current API returns on
            every call — the same JSON you can download from the demo.{' '}
            <a
              href="https://github.com/NicoArce10/Mise/blob/main/docs/competitive_benchmark.md"
              target="_blank"
              rel="noreferrer"
              style={{
                color: 'var(--color-ink)',
                textDecoration: 'underline dotted',
                textUnderlineOffset: 4,
              }}
            >
              Reproducible harness →
            </a>
          </p>
        </section>

        {/* ═══════════════ JSON EVIDENCE ═══════════════ */}
        <section
          className={`${SECTION_PX} py-20 md:py-24`}
          style={{
            maxWidth: CONTAINER_MAX,
            width: '100%',
            margin: '0 auto',
          }}
        >
          <JsonPreviewBlock />
        </section>

        {/* ═══════════════ WHERE MISE FITS ═══════════════ */}
        <section
          className={`${SECTION_PX} py-20 md:py-28`}
          style={{
            background: 'var(--color-paper-tint)',
            borderTop: '1px solid var(--color-hairline)',
            borderBottom: '1px solid var(--color-hairline)',
          }}
        >
          <div
            style={{
              maxWidth: CONTAINER_MAX,
              width: '100%',
              margin: '0 auto',
            }}
          >
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
              <Eyebrow tone="strong">Where Mise fits</Eyebrow>
            </div>

            <h2
              className="font-display"
              style={{
                fontWeight: 500,
                fontSize: 'clamp(28px, 4vw, 44px)',
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
                color: 'var(--color-ink)',
                maxWidth: 900,
                marginBottom: 32,
              }}
            >
              Menu software splits into{' '}
              <span
                className="font-accent"
                style={{ fontStyle: 'italic', color: 'var(--color-ink-muted)' }}
              >
                three layers.
              </span>{' '}
              The ingestion layer is the one nobody owns.
            </h2>

            <div
              className="grid gap-6"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
            >
              {[
                {
                  label: '01 · Ingestion',
                  title: 'Photo / PDF → structured menu JSON',
                  body: 'This is where Mise lives. Veryfi and Klippa are the only commercial APIs here, and they stop at flat OCR output. DoorDash solved it internally with a large ML team.',
                  who: 'Mise, Veryfi, Klippa, DoorDash (internal)',
                  highlight: true,
                },
                {
                  label: '02 · Sync',
                  title: 'Structured menu → POS, delivery apps, kiosks',
                  body: 'Deliverect and Checkmate own this layer. They assume the menu is already digital and push updates across channels. They need an ingestion layer in front for restaurants without a POS.',
                  who: 'Deliverect, Checkmate (EveryWare), Otter',
                  highlight: false,
                },
                {
                  label: '03 · Enrichment',
                  title: 'Existing listings → better photos, copy, reviews',
                  body: 'Uber Eats and DoorDash ship AI tools here — description generators, AI cameras, photo moderation. They work on menus that are already online. Not ingestion.',
                  who: 'Uber Eats AI, DoorDash merchant tools',
                  highlight: false,
                },
              ].map((layer) => (
                <div
                  key={layer.label}
                  style={{
                    background: layer.highlight
                      ? 'var(--color-paper)'
                      : 'transparent',
                    border: layer.highlight
                      ? '1px solid var(--color-ink)'
                      : '1px solid var(--color-hairline)',
                    borderRadius: 'var(--radius-card)',
                    padding: '24px 22px',
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: layer.highlight
                        ? 'var(--color-gold-leaf)'
                        : 'var(--color-ink-subtle)',
                      marginBottom: 12,
                    }}
                  >
                    {layer.label}
                  </div>
                  <div
                    className="font-display"
                    style={{
                      fontSize: 19,
                      lineHeight: 1.22,
                      letterSpacing: '-0.01em',
                      color: 'var(--color-ink)',
                      marginBottom: 12,
                      fontWeight: 500,
                    }}
                  >
                    {layer.title}
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: 'var(--color-ink-muted)',
                      marginBottom: 16,
                    }}
                  >
                    {layer.body}
                  </p>
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      color: 'var(--color-ink-subtle)',
                      paddingTop: 12,
                      borderTop: '1px solid var(--color-hairline)',
                    }}
                  >
                    Who plays here: {layer.who}
                  </div>
                </div>
              ))}
            </div>

            <p
              style={{
                fontSize: 'clamp(14px, 1.15vw, 16px)',
                lineHeight: 1.55,
                color: 'var(--color-ink-muted)',
                maxWidth: 820,
                marginTop: 32,
              }}
            >
              For a delivery marketplace or a sync platform like Deliverect, Mise is a{' '}
              <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>
                drop-in ingestion front-door
              </span>
              . For a POS-less restaurant in LatAm, it replaces the half-day of manual
              re-entry that currently blocks onboarding.
            </p>
          </div>
        </section>

        {/* ═══════════════ EVIDENCE → SEARCH ═══════════════ */}
        <section
          className={`${SECTION_PX} py-24 md:py-32`}
          style={{
            maxWidth: CONTAINER_MAX,
            width: '100%',
            margin: '0 auto',
          }}
        >
          <div className="mb-12 flex items-center gap-3">
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 28,
                height: 1,
                background: 'var(--color-ink-subtle)',
              }}
            />
            <Eyebrow tone="strong">From the menu you already have · to the question your customer asks</Eyebrow>
          </div>

          <h2
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: 'clamp(32px, 4.5vw, 52px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              maxWidth: 900,
              marginBottom: 56,
            }}
          >
            Upload your menu once.{' '}
            <span
              className="font-accent"
              style={{ fontStyle: 'italic', color: 'var(--color-ink)' }}
            >
              Answer every customer
            </span>{' '}
            forever.
          </h2>

          <div
            className="grid items-start gap-10 md:gap-12"
            style={{
              gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
            }}
          >
            {/* LEFT: A single menu — not three "sources" with the same dish.
                One file representing the restaurant's actual menu, with a
                handful of distinct dishes visible so the judge immediately
                grasps "this is a whole menu, not a reconciliation trick". */}
            <div className="flex flex-col gap-4">
              <div
                className="mb-2 flex items-center gap-2"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-subtle)',
                }}
              >
                <span>Your menu · any format</span>
              </div>

              <MenuPreviewTile />

              <p
                className="font-mono"
                style={{
                  fontSize: 11,
                  lineHeight: '16px',
                  letterSpacing: '0.08em',
                  color: 'var(--color-ink-subtle)',
                  marginTop: 4,
                }}
              >
                One PDF shown. The pipeline is identical for a phone photo, a
                chalkboard snapshot, an Instagram screenshot, or a multi-page
                scan.
              </p>
            </div>

            {/* CENTER: Arrow */}
            <div
              className="hidden md:flex flex-col items-center justify-center"
              style={{ minWidth: 80, paddingTop: 80 }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-subtle)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 12,
                  textAlign: 'center',
                }}
              >
                Opus 4.7
                <br />
                vision
                <br />
                + search
              </div>
              <svg width="80" height="20" viewBox="0 0 80 20" fill="none" aria-hidden>
                <line x1="0" y1="10" x2="68" y2="10" stroke="var(--color-ink)" strokeWidth="1" />
                <polyline
                  points="60,4 68,10 60,16"
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-subtle)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                Dish graph
              </div>
            </div>

            {/* Mobile arrow */}
            <div className="flex md:hidden items-center justify-center py-2">
              <svg width="20" height="60" viewBox="0 0 20 60" fill="none" aria-hidden>
                <line x1="10" y1="0" x2="10" y2="48" stroke="var(--color-ink)" strokeWidth="1" />
                <polyline
                  points="4,40 10,48 16,40"
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* RIGHT: Search preview */}
            <div className="flex flex-col gap-4">
              <div
                className="mb-2 flex items-center gap-2"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-subtle)',
                }}
              >
                <span>A customer · in their own words</span>
              </div>
              <SearchPreviewCard />
              <p
                className="font-mono"
                style={{
                  fontSize: 11,
                  lineHeight: '16px',
                  letterSpacing: '0.08em',
                  color: 'var(--color-ink-subtle)',
                  marginTop: 4,
                }}
              >
                Shown in Spanish vernacular. The same pipeline handles English,
                Japanese, Chinese, Portuguese, any cuisine — the model reads
                whatever the menu speaks.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════ METRICS ═══════════════ */}
        <section
          className={`${SECTION_PX} py-20 md:py-24`}
          style={{
            background: 'var(--color-ink)',
            color: 'var(--color-paper)',
          }}
        >
          <div
            style={{
              maxWidth: CONTAINER_MAX,
              width: '100%',
              margin: '0 auto',
            }}
          >
            <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-8">
              <div className="flex flex-col gap-2">
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--color-paper-deep)',
                  }}
                >
                  Architectural guarantees
                </span>
                <h2
                  className="font-display"
                  style={{
                    fontWeight: 500,
                    fontSize: 'clamp(28px, 3.6vw, 44px)',
                    lineHeight: 1.1,
                    letterSpacing: '-0.015em',
                    color: 'var(--color-paper)',
                    maxWidth: 720,
                  }}
                >
                  Every claim below is{' '}
                  <span className="font-accent" style={{ fontStyle: 'italic' }}>
                    enforced by code
                  </span>
                  , not by a benchmark.
                </h2>
              </div>
              <p
                className="font-mono"
                style={{
                  fontSize: 12,
                  lineHeight: '18px',
                  color: 'var(--color-paper-deep)',
                  maxWidth: 260,
                }}
              >
                Numbers are pulled from a reproducible eval suite — every claim below
                traces back to a recorded run you can re-execute from the repo.
              </p>
            </div>

            <div
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                borderTop: '1px solid rgba(251, 248, 242, 0.15)',
              }}
            >
              {PRINCIPLES.map((m, i) => (
                <div
                  key={m.label}
                  className="flex flex-col gap-2"
                  style={{
                    padding: '28px 24px 28px 0',
                    borderRight:
                      i < PRINCIPLES.length - 1
                        ? '1px solid rgba(251, 248, 242, 0.15)'
                        : 'none',
                    paddingLeft: i === 0 ? 0 : 24,
                  }}
                >
                  <span
                    className="font-display"
                    style={{
                      fontWeight: 500,
                      fontSize: 'clamp(22px, 2.4vw, 30px)',
                      lineHeight: '32px',
                      letterSpacing: '-0.01em',
                      color: 'var(--color-paper)',
                    }}
                  >
                    {m.value}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      lineHeight: '20px',
                      color: 'var(--color-paper)',
                      fontWeight: 500,
                    }}
                  >
                    {m.label}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      lineHeight: '20px',
                      color: 'var(--color-paper-deep)',
                    }}
                  >
                    {m.hint}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ FOUR PILLARS ═══════════════ */}
        <section
          className={`${SECTION_PX} py-24 md:py-32`}
          style={{
            maxWidth: CONTAINER_MAX,
            width: '100%',
            margin: '0 auto',
          }}
        >
          <div className="mb-12 flex items-center gap-3">
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 28,
                height: 1,
                background: 'var(--color-ink-subtle)',
              }}
            />
            <Eyebrow tone="strong">How Opus 4.7 is used, concretely</Eyebrow>
          </div>

          <h2
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: 'clamp(32px, 4.5vw, 48px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              maxWidth: 880,
              marginBottom: 56,
            }}
          >
            Four load-bearing pillars.{' '}
            <span
              className="font-accent"
              style={{ fontStyle: 'italic' }}
            >
              Every one visible
            </span>{' '}
            in the product, not just the deck.
          </h2>

          <div
            className="grid gap-x-16 gap-y-14"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
          >
            {PILLARS.map(p => (
              <div
                key={p.n}
                className="flex flex-col gap-4"
                style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 24 }}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.18em',
                      color: 'var(--color-ink-subtle)',
                    }}
                  >
                    {p.n}
                  </span>
                </div>
                <h3
                  className="font-display"
                  style={{
                    fontWeight: 500,
                    fontSize: 26,
                    lineHeight: '32px',
                    letterSpacing: '-0.01em',
                    color: 'var(--color-ink)',
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    fontSize: 17,
                    lineHeight: '28px',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════ WHO IT IS FOR ═══════════════ */}
        <section
          className={`${SECTION_PX} py-24 md:py-32`}
          style={{
            background: 'var(--color-paper-tint)',
            borderTop: '1px solid var(--color-hairline)',
            borderBottom: '1px solid var(--color-hairline)',
          }}
        >
          <div
            style={{
              maxWidth: CONTAINER_MAX,
              width: '100%',
              margin: '0 auto',
            }}
          >
            <div className="mb-12 flex items-center gap-3">
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 28,
                  height: 1,
                  background: 'var(--color-ink-subtle)',
                }}
              />
              <Eyebrow tone="strong">Who this is built for</Eyebrow>
            </div>

            <h2
              className="font-display"
              style={{
                fontWeight: 500,
                fontSize: 'clamp(32px, 4.5vw, 48px)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: 'var(--color-ink)',
                maxWidth: 880,
                marginBottom: 48,
              }}
            >
              Three customers.{' '}
              <span
                className="font-accent"
                style={{ fontStyle: 'italic', color: 'var(--color-ink-muted)' }}
              >
                One shared pain.
              </span>
            </h2>

            <div
              className="grid gap-x-10 gap-y-12"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
            >
              {AUDIENCES.map(a => (
                <div key={a.title} className="flex flex-col gap-3">
                  <h3
                    className="font-display"
                    style={{
                      fontWeight: 500,
                      fontSize: 22,
                      lineHeight: '28px',
                      letterSpacing: '-0.005em',
                      color: 'var(--color-ink)',
                    }}
                  >
                    {a.title}
                  </h3>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--color-ink-subtle)',
                    }}
                  >
                    {a.example}
                  </span>
                  <p
                    style={{
                      fontSize: 15,
                      lineHeight: '24px',
                      color: 'var(--color-ink-muted)',
                    }}
                  >
                    {a.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ PLUG IT INTO ANYTHING ═══════════════ */}
        <section
          className={`${SECTION_PX} py-24 md:py-32`}
          style={{
            maxWidth: CONTAINER_MAX,
            width: '100%',
            margin: '0 auto',
          }}
        >
          <div className="mb-10 flex items-center gap-3">
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 28,
                height: 1,
                background: 'var(--color-ink-subtle)',
              }}
            />
            <Eyebrow tone="strong">Plug it into anything</Eyebrow>
          </div>

          <h2
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: 'clamp(32px, 4.5vw, 48px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              maxWidth: 920,
              marginBottom: 16,
            }}
          >
            One ingest with Opus.{' '}
            <span
              className="font-accent"
              style={{ fontStyle: 'italic', color: 'var(--color-ink-muted)' }}
            >
              Any search engine at integration time.
            </span>
          </h2>

          <p
            style={{
              fontSize: 'clamp(15px, 1.3vw, 17px)',
              lineHeight: 1.55,
              color: 'var(--color-ink-muted)',
              maxWidth: 760,
              marginBottom: 16,
            }}
          >
            Upload a menu, then <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92em', color: 'var(--color-ink)' }}>GET /api/catalog/&lt;run_id&gt;.json</span>.
            The graph ships with aliases, search terms, ingredients and categories already populated, so the
            dishes are indexable by <strong style={{ color: 'var(--color-ink)', fontWeight: 500 }}>Postgres full-text, Elasticsearch, Algolia or a vector DB</strong>{' '}
            in milliseconds. No LLM in the hot path. No ML team.
          </p>

          <div
            style={{
              background: 'var(--color-paper-tint)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-card)',
              padding: '20px 24px',
              marginBottom: 40,
              maxWidth: 760,
              fontSize: 14,
              lineHeight: '22px',
              color: 'var(--color-ink-muted)',
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--color-gold-leaf)',
                marginTop: 7,
                flexShrink: 0,
              }}
            />
            <span>
              <strong style={{ color: 'var(--color-ink)', fontWeight: 500 }}>
                Where Opus runs, explicitly.
              </strong>
              {' '}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Ingest</span>: once per menu, for vision + identity + alias generation.
              {' '}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Playground</span>: to help you judge the graph before integrating.
              {' '}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Your integration</span>: never — your users search a static JSON, indexed however you like.
            </span>
          </div>

          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
          >
            {INTEGRATIONS.map(i => (
              <div
                key={i.target}
                style={{
                  background: 'var(--color-paper)',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-card)',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <h3
                  className="font-display"
                  style={{
                    fontWeight: 500,
                    fontSize: 20,
                    lineHeight: '26px',
                    letterSpacing: '-0.005em',
                    color: 'var(--color-ink)',
                  }}
                >
                  {i.target}
                </h3>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--color-ink-subtle)',
                  }}
                >
                  {i.example}
                </span>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: '22px',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  {i.need}
                </p>
                <div
                  style={{
                    borderTop: '1px solid var(--color-hairline)',
                    paddingTop: 10,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    lineHeight: '18px',
                    color: 'var(--color-ink)',
                    letterSpacing: '0.01em',
                  }}
                >
                  {i.payload}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════ FINAL CTA ═══════════════ */}
        <section
          className={`${SECTION_PX} py-24 md:py-32`}
          style={{
            maxWidth: CONTAINER_MAX,
            width: '100%',
            margin: '0 auto',
            borderTop: '1px solid var(--color-hairline)',
          }}
        >
          <div className="flex flex-col items-start gap-10">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 28,
                  height: 1,
                  background: 'var(--color-ink-subtle)',
                }}
              />
              <Eyebrow tone="strong">Drop a menu. Ask like a customer.</Eyebrow>
            </div>
            <h2
              className="font-display"
              style={{
                fontWeight: 500,
                fontSize: 'clamp(40px, 6vw, 72px)',
                lineHeight: 1.0,
                letterSpacing: '-0.025em',
                color: 'var(--color-ink)',
                maxWidth: 960,
              }}
            >
              See Mise understand{' '}
              <span
                className="font-accent"
                style={{ fontStyle: 'italic' }}
              >
                a real menu
              </span>
              . Then upload your own.
            </h2>
            <p
              style={{
                fontSize: 'clamp(17px, 1.6vw, 20px)',
                lineHeight: 1.5,
                color: 'var(--color-ink-muted)',
                maxWidth: 680,
              }}
            >
              The sample runs against a pre-computed bundle. Upload runs against Opus 4.7 live,
              vision-native, with adaptive thinking only when the query is actually ambiguous.
            </p>
            <div className="flex flex-wrap items-center gap-5 md:gap-8">
              <PrimaryCta onClick={onSample}>Try the sample menu</PrimaryCta>
              <SecondaryCta onClick={onUpload}>Upload your own</SecondaryCta>
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer
        style={{
          borderTop: '1px solid var(--color-hairline)',
          background: 'var(--color-paper)',
        }}
      >
        <div
          className={`flex flex-col items-start justify-between gap-3 py-8 md:flex-row md:items-center ${SECTION_PX}`}
          style={{
            fontSize: 13,
            color: 'var(--color-ink-subtle)',
            maxWidth: CONTAINER_MAX,
            width: '100%',
            margin: '0 auto',
          }}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span
              className="font-display"
              style={{
                fontWeight: 500,
                fontSize: 17,
                lineHeight: '22px',
                color: 'var(--color-ink)',
                letterSpacing: '-0.005em',
              }}
            >
              Mise
            </span>
            <span aria-hidden>·</span>
            <span>Open source · MIT</span>
            <span aria-hidden>·</span>
            <span>Built for the Claude Opus 4.7 hackathon</span>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              claude&#8209;opus&#8209;4&#8209;7
            </span>
            <a
              href="https://github.com/NicoArce10/Mise"
              target="_blank"
              rel="noreferrer"
              style={{
                color: 'var(--color-ink-muted)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--color-hairline)',
                paddingBottom: 1,
              }}
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
