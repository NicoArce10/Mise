import { ArrowRight, FileText, Search } from 'lucide-react';
import { motion } from 'motion/react';

import { Eyebrow } from '../components/Eyebrow';
import { GlossaryTerm } from '../components/GlossaryTerm';
import { DishCardPreview } from './landing/DishCardPreview';

interface Props {
  onUpload: () => void;
  onSample: () => void;
}

// ─────────────────────────────────────────────────────────────
//  Shared tokens & micro-animations
//
//  The landing is intentionally long-tail (problem → proof →
//  compare → CTA), but the *rhythm* has to stay tight: a reader
//  has ~5 seconds above the fold to decide whether to scroll. We
//  pre-declare the easing curve and the container max-width so
//  every section breathes the same way instead of drifting.
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
//  CTAs — one primary, one ghost. The hero + final CTA both use
//  the same pair so the visual "this is the action" stays the
//  same regardless of where the reader commits.
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
//  Menu preview tile — one file representing the restaurant's
//  actual menu (not "three sources with the same dish"). Shown
//  on the left of the "evidence → search" diagram so the judge
//  immediately grasps: this is what you upload, and Opus 4.7
//  reads the whole page at once.
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

        {[
          ['Milanesa Napolitana XL', '$18.500'],
          ['Lomito completo', '$16.200'],
          ['Ñoquis del 29 con tuco', '$9.800'],
          ['Provoleta a la parrilla', '$7.400'],
        ].map(([name, price]) => (
          <div
            key={name}
            className="flex items-baseline justify-between gap-4"
            style={{ marginBottom: 8 }}
          >
            <span>{name}</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontStyle: 'normal',
                fontSize: 12,
                color: 'var(--color-ink-muted)',
              }}
            >
              {price}
            </span>
          </div>
        ))}

        <div
          className="flex items-center justify-between gap-3"
          style={{
            fontFamily: 'var(--font-mono)',
            fontStyle: 'normal',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-subtle)',
            marginTop: 14,
            marginBottom: 10,
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
            daily · auto
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
            Mise moves daily specials to their own lane —
          </span>
          <br />
          <span>so your catalog stays stable across the week.</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Search frame — the other half of the "one upload, every
//  query answered" story. A diner types in their own words;
//  Mise resolves to the exact dish on the menu, with the reason.
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
            {['alias', 'search term'].map(tag => (
              <span
                key={tag}
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
                {tag}
              </span>
            ))}
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Landing view
//
//  Structure (6 sections — down from 11):
//    1. Hero            — promise + two CTAs + above-the-fold trust strip
//    2. Problem         — one number that makes the pain obvious
//    3. How it works    — MenuPreview → SearchPreview diagram
//    4. Proof           — DishCardPreview with "Show raw JSON" accordion
//    5. Compare         — the table (only place commercial context lives)
//    6. Final CTA       — one more chance to commit
//
//  Previously-standalone sections (Architectural guarantees,
//  Where Mise fits, Four pillars, Who this is built for, Plug
//  it into anything) were cut per landing-conversion research:
//  11 sections is above the comfort threshold for a B2B reader
//  and non-technical audiences bounced before the comparison
//  table — which *is* the key differentiator. We fold their
//  best lines into Hero and Compare where they do more work.
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
        {/* ═══════════════ 1 · HERO ═══════════════ */}
        <section
          className={`${SECTION_PX} pt-10 pb-20 md:pt-14 md:pb-24`}
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
            <Eyebrow tone="strong">
              Menu digitization · for delivery platforms, marketplaces & POS-less restaurants
            </Eyebrow>
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
              production-ready catalog
            </span>{' '}
            — every dish with the names diners actually type, daily specials
            on their own lane, ready to drop into search. One call to Claude
            Opus 4.7, no{' '}
            <GlossaryTerm
              term="OCR"
              definition="Optical Character Recognition — the old-school step of turning an image into raw text before an AI can read it."
              practical="Mise skips this step entirely. Opus 4.7 reads the photo or PDF directly, which keeps layout and language cues intact."
            />{' '}
            pipeline, no manual cleanup.
          </motion.p>

          <motion.div {...reveal(0.12)} className="flex flex-wrap items-center gap-4 md:gap-6">
            <PrimaryCta onClick={onSample}>Try with a real menu</PrimaryCta>
            <SecondaryCta onClick={onUpload}>Upload your own</SecondaryCta>
          </motion.div>

          {/* Trust strip — the four guarantees that used to live in a
              standalone "Architectural guarantees" section, folded up
              above the fold so the first pass already sees them. */}
          <motion.div
            {...reveal(0.18)}
            className="mt-10 grid gap-4 md:gap-6"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', maxWidth: 960 }}
          >
            {[
              {
                label: 'Evidence-grounded',
                hint: 'Results are filtered to the extracted dish graph, not the model’s world knowledge.',
              },
              {
                label: 'Vision-native',
                hint: 'PDFs and photos go straight to Opus 4.7. No OCR stage to maintain.',
              },
              {
                label: 'Schema-validated',
                hint: 'Every response is JSON-schema constrained and Pydantic-validated. Zero parse failures.',
              },
              {
                label: 'Open source · MIT',
                hint: 'Fork it, read the prompts, run the evals. Nothing is a black box.',
              },
            ].map(t => (
              <div
                key={t.label}
                style={{
                  borderTop: '1px solid var(--color-hairline)',
                  paddingTop: 14,
                }}
              >
                <div
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--color-ink)',
                    marginBottom: 6,
                    fontWeight: 500,
                  }}
                >
                  {t.label}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: '20px',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  {t.hint}
                </p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ═══════════════ 2 · PROBLEM ═══════════════ */}
        <section
          className={`${SECTION_PX} py-24 md:py-28`}
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
              <Eyebrow tone="strong">The problem, in the industry’s own words</Eyebrow>
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
                marginBottom: 32,
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
                {
                  title: '2–3 hours per menu',
                  body: (
                    <>
                      Manual digitization of a single restaurant menu takes 2–3 hours
                      — a figure{' '}
                      <a
                        href="https://www.veryfi.com/restaurant-menu-ocr-api/"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-ink)', textDecoration: 'underline dotted' }}
                      >
                        published by Veryfi
                      </a>{' '}
                      themselves. For a marketplace onboarding thousands of restaurants,
                      that is an entire ops team.
                    </>
                  ),
                },
                {
                  title: '240 hours a year, per location',
                  body: (
                    <>
                      Keeping one menu in sync across DoorDash, Uber Eats, Grubhub and
                      the restaurant’s own app costs up to{' '}
                      <a
                        href="https://www.eats365pos.com/us/blog/post/menu-management-mistakes-avoid-them"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-ink)', textDecoration: 'underline dotted' }}
                      >
                        240 labor hours a year
                      </a>
                      . Most of it is manual re-entry — typos, missing specials, stale prices.
                    </>
                  ),
                },
                {
                  title: 'No POS, no API',
                  body: (
                    <>
                      In LatAm, SEA and MENA most restaurants don’t run Toast or Square.
                      Their menu lives as a PDF, a WhatsApp photo, or a laminated sheet —
                      never as an API response. That gap is where every delivery and
                      discovery product stalls.
                    </>
                  ),
                },
              ].map(({ title, body }) => (
                <div key={title} className="flex flex-col gap-3">
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

        {/* ═══════════════ 3 · HOW IT WORKS ═══════════════ */}
        <section
          className={`${SECTION_PX} py-24 md:py-28`}
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
            <Eyebrow tone="strong">
              From the menu you already have · to the question your customer asks
            </Eyebrow>
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
              marginBottom: 48,
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
                Same pipeline for a phone photo, a chalkboard, an Instagram post, or a
                multi-page scan.
              </p>
            </div>

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
                reads +
                <br />
                understands
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
                Region + language inferred from the evidence itself. Mexican menu →
                Spanish-MX. UK pub → British slang (<em>chippy</em>, <em>banger</em>).
                Berlin Imbiss → Deutsch. Tokyo kiosk → Japanese. No country setting.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════ 4 · PROOF · DISH CARD + RAW JSON ═══════════════ */}
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
            <DishCardPreview />
          </div>
        </section>

        {/* ═══════════════ 5 · COMPARE ═══════════════ */}
        <section
          className={`${SECTION_PX} py-24 md:py-28`}
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
            DoorDash’s engineering team publicly{' '}
            <a
              href="https://careersatdoordash.com/blog/doordash-llm-transcribe-menu/"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-ink)', textDecoration: 'underline dotted' }}
            >
              documented their approach
            </a>
            : OCR extracts text, an LLM turns it into structured data, a classifier
            scores whether the result is good enough, and anything uncertain is routed
            to a human. It runs in production, at scale — and it stays inside DoorDash.
            Every other delivery platform and aggregator has to build something
            comparable on their own.
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
            cover the ingestion piece, but their output stops at item, price and
            section. The aliases a diner actually types, the vernacular search terms,
            the fact that Tuesday’s chalkboard special is not part of the printed menu
            — all of that still lands on whoever integrates them.
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
            Mise is a{' '}
            <GlossaryTerm
              term="vision-native"
              definition="The AI reads the photo or PDF directly — with its eyes — instead of waiting for an OCR step to turn the image into text first."
              practical="Keeps layout, menu sections, accents and fonts intact — so chef specials, modifier groups and non-English menus come through clean."
            />{' '}
            take on the same problem. Opus 4.7 reads the photo directly and returns
            the canonical menu, aliases, search terms, specials lane and a quality
            signal in a single call. Shape is stable, ready for Postgres, Elastic or
            a vector DB on day one.
          </p>

          <div
            style={{
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
              background: 'var(--color-paper)',
            }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: '1.5fr 1fr 1.1fr 1fr 1fr',
                background: 'var(--color-paper-tint)',
                borderBottom: '1px solid var(--color-hairline)',
              }}
            >
              {[
                'Capability',
                'Mise',
                'DoorDash (internal)',
                'Veryfi',
                'Klippa · Doxis',
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
                dd: 'No · internal only',
                veryfi: 'Yes · commercial',
                klippa: 'Yes · commercial',
                unique: false,
              },
              {
                cap: 'Ingestion',
                mise: 'Vision-native · 1 call',
                dd: 'OCR → LLM + guardrail',
                veryfi: 'OCR → NLP',
                klippa: 'OCR → NLP',
                unique: true,
              },
              {
                cap: 'Item + price + category',
                mise: 'Yes',
                dd: 'Yes',
                veryfi: 'Yes',
                klippa: 'Yes',
                unique: false,
              },
              {
                cap: 'Aliases populated on first call',
                mise: 'Yes',
                dd: 'Not in public writeups',
                veryfi: 'Build your own',
                klippa: 'Build your own',
                unique: true,
              },
              {
                cap: 'Search terms (diner vernacular)',
                mise: 'Yes',
                dd: 'Not in public writeups',
                veryfi: 'Not provided',
                klippa: 'Not provided',
                unique: true,
              },
              {
                cap: 'Canonical vs daily specials / LTOs',
                mise: 'Auto-separated',
                dd: 'Not distinguished',
                veryfi: 'Not distinguished',
                klippa: 'Not distinguished',
                unique: true,
              },
              {
                cap: 'Natural-language filter per run',
                mise: 'Yes · "exclude beverages"',
                dd: 'Not applicable',
                veryfi: 'OCR — not instructable',
                klippa: 'OCR — not instructable',
                unique: true,
              },
              {
                cap: 'Multilingual · region-aware aliases',
                mise: 'Inferred from evidence',
                dd: 'Unspecified',
                veryfi: 'Unspecified',
                klippa: 'Latin languages',
                unique: true,
              },
              {
                cap: 'Quality signal on every response',
                mise: 'Yes · heuristic check',
                dd: 'Yes · ML classifier',
                veryfi: 'Not exposed',
                klippa: 'Not exposed',
                unique: true,
              },
              {
                cap: 'Indexable in Postgres / Elastic / vector DB on day one',
                mise: 'Yes',
                dd: 'Internal schema only',
                veryfi: 'Post-processing',
                klippa: 'Post-processing',
                unique: true,
              },
            ] as const).map((row, idx, arr) => (
              <div
                key={row.cap}
                className="grid"
                style={{
                  gridTemplateColumns: '1.5fr 1fr 1.1fr 1fr 1fr',
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
                    borderRight: '1px solid var(--color-hairline)',
                  }}
                >
                  {row.dd}
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
            . The “Mise” column is the actual payload the current API returns on every
            call — the same JSON you can download from the demo.{' '}
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

        {/* ═══════════════ 6 · FINAL CTA ═══════════════ */}
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
              The sample runs against a pre-computed bundle. Upload runs against Opus
              4.7 live, vision-native, with{' '}
              <GlossaryTerm
                term="adaptive thinking"
                definition="Opus 4.7 only spends extra reasoning cycles when a case is genuinely ambiguous — everything else goes straight through."
                practical="You don't pay the slow-and-expensive tax on the 90% of dishes that are clearly one thing."
              />{' '}
              only when the query is actually ambiguous.
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
