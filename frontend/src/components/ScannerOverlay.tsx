import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, ImageIcon } from 'lucide-react';
import type { SourceDocument } from '../domain/types';
import { sourceContentUrl } from '../api/client';

interface Props {
  sources: SourceDocument[];
  recentDishes: string[];
}

const EASE = [0.22, 0.61, 0.36, 1] as const;

/**
 * Visual context for the "Reading your menu" stage.
 *
 * What's REAL here:
 *   - the source documents shown are the actual PDFs/photos the user
 *     uploaded (loaded from `/api/sources/{id}/content`);
 *   - the dish chips on the right are the live, server-streamed output
 *     of Opus 4.7's vision-native extraction — they pop into view as
 *     `recent_dishes` grows on each 1.2s poll, in extraction order.
 *
 * What's DECORATIVE here:
 *   - the horizontal scanner line that sweeps down each source. It is
 *     *not* a tracker for where Opus is currently looking (no such
 *     signal exists from the API). It's a visual cue that communicates
 *     "vision-native processing is happening now" — the same role as a
 *     subtle progress shimmer, just restyled for our vocabulary. We
 *     cross-fade it out the moment extraction finishes so it never
 *     overstays its welcome.
 *
 * Rendering strategy:
 *   - Exactly one source is shown "active" (with the scanner). The rest
 *     appear as small cards in a row below. This keeps the visual
 *     hierarchy from collapsing when a user drops 5 photos. Active
 *     source cycles every few seconds while the stage runs so a multi-
 *     source batch feels alive.
 *   - PDF previews use a native `<iframe>` with `#view=FitH` so the
 *     first page fills the frame without controls. Image previews use
 *     `<img>`.
 *   - Non-inlineable content (PDFs in strict sandboxes, odd MIME types)
 *     fall back to a neutral placeholder card with the filename.
 */
export function ScannerOverlay({ sources, recentDishes }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  // Cycle which source is the "hero" while the stage runs. 4.5s per
  // source is slow enough to read the filename and feel the scanner,
  // fast enough to cover a 5-source batch in ~22s.
  useEffect(() => {
    if (sources.length <= 1) return;
    const handle = window.setInterval(
      () => setActiveIdx(i => (i + 1) % sources.length),
      4500,
    );
    return () => window.clearInterval(handle);
  }, [sources.length]);

  // Defensive: clamp in case `sources` shrinks between renders.
  const active = sources[Math.min(activeIdx, sources.length - 1)] ?? null;
  const others = useMemo(
    () => sources.filter((_, i) => i !== (active ? sources.indexOf(active) : -1)),
    [sources, active],
  );

  // When `sources` hasn't arrived yet (first 1–2 polls, or a backend
  // that hasn't been restarted to pick up the `sources` enrichment on
  // the ProcessingRun payload) we STILL render the overlay so the user
  // sees the scanner animation immediately. The preview area shows a
  // neutral "reading your upload" placeholder instead of the real
  // document; the dish chip column and scanner line are unchanged.
  const inPlaceholderMode = sources.length === 0;

  return (
    <div
      className="flex flex-col gap-6"
      style={{
        borderTop: '1px solid var(--color-hairline)',
        paddingTop: 24,
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-subtle)',
        }}
      >
        Opus 4.7 · vision-native pass
      </div>

      <div
        className="grid gap-6"
        style={{
          // Source preview | dish chip column. Collapses to single
          // column under 720px (mobile demo on a phone during the pitch
          // still shouldn't be illegible).
          gridTemplateColumns: 'minmax(0, 1fr) 240px',
        }}
      >
        {/* ---------- Active source preview with scanner ---------- */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-paper-tint)',
            aspectRatio: '4 / 3',
          }}
        >
          <AnimatePresence mode="wait">
            {active ? (
              <motion.div
                key={active.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                style={{ position: 'absolute', inset: 0 }}
              >
                <SourcePreview source={active} />
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="flex flex-col items-center justify-center gap-2"
                style={{
                  position: 'absolute',
                  inset: 0,
                  textAlign: 'center',
                  padding: 24,
                }}
              >
                <span
                  className="font-accent"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 15,
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  Opus 4.7 is reading your upload
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    color: 'var(--color-ink-subtle)',
                  }}
                >
                  vision-native · no OCR
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtle gradient to soften the edge when documents are
              bright white — otherwise the hairline border gets lost. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'linear-gradient(to bottom, rgba(18,18,20,0.04), rgba(18,18,20,0) 12%, rgba(18,18,20,0) 88%, rgba(18,18,20,0.06))',
            }}
          />

          {/* The scanner line. Pure decoration — see component docstring. */}
          <motion.div
            aria-hidden
            initial={{ top: '0%' }}
            animate={{ top: ['0%', '100%'] }}
            transition={{
              duration: 2.6,
              ease: 'linear',
              repeat: Infinity,
            }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 2,
              // Warm sienna so it feels like a lens-scan, not a tech bar.
              background:
                'linear-gradient(to right, transparent 0%, var(--color-sienna, #c9623f) 20%, var(--color-sienna, #c9623f) 80%, transparent 100%)',
              boxShadow: '0 0 16px 2px rgba(201, 98, 63, 0.35)',
              pointerEvents: 'none',
            }}
          />

          {/* Filename ribbon along the bottom of the active preview.
              Hidden in placeholder mode — we have no filename to show
              and a fake one would be misleading. */}
          {active && !inPlaceholderMode && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                bottom: 12,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(18,18,20,0.78)',
                color: 'var(--color-paper)',
                fontSize: 11,
                lineHeight: '14px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.02em',
                maxWidth: 'calc(100% - 24px)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Reading · {active.filename}
            </div>
          )}
        </div>

        {/* ---------- Live dish chip column ---------- */}
        <div className="flex flex-col gap-2" style={{ minWidth: 0 }}>
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
            }}
          >
            Found so far · {recentDishes.length}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              // Cap the column so a 60-dish menu doesn't push the layout;
              // the newest chips are visible at the top.
              maxHeight: 260,
              overflow: 'hidden',
              position: 'relative',
              maskImage:
                'linear-gradient(to bottom, black 0%, black 85%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black 0%, black 85%, transparent 100%)',
            }}
          >
            <AnimatePresence initial={false}>
              {recentDishes
                .slice()
                .reverse()
                .slice(0, 14)
                .map(name => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28, ease: EASE }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-chip)',
                      border: '1px solid var(--color-hairline)',
                      background: 'var(--color-paper)',
                      fontSize: 13,
                      lineHeight: '18px',
                      color: 'var(--color-ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name}
                  </motion.div>
                ))}
            </AnimatePresence>
            {recentDishes.length === 0 && (
              <span
                className="font-accent"
                style={{
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: 'var(--color-ink-subtle)',
                }}
              >
                Waiting for the first page to come back…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Thumbnail strip for the OTHER sources ---------- */}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map(src => (
            <button
              key={src.id}
              type="button"
              onClick={() =>
                setActiveIdx(sources.findIndex(s => s.id === src.id))
              }
              aria-label={`Focus ${src.filename}`}
              className="cursor-pointer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-chip)',
                background: 'var(--color-paper)',
                fontSize: 12,
                color: 'var(--color-ink-muted)',
                fontFamily: 'var(--font-mono)',
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {src.kind === 'pdf' ? (
                <FileText size={12} strokeWidth={1.6} />
              ) : (
                // `photo` | `post` | `board` are all image-ish from the
                // user's perspective; one icon covers all three.
                <ImageIcon size={12} strokeWidth={1.6} />
              )}
              {src.filename}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Inline preview of one uploaded source. Image sources render as a
 * cropped `<img>`; PDFs render in an iframe pointing at the stream
 * endpoint with `#view=FitH&toolbar=0` to hide native chrome. Unknown
 * MIME types degrade to a neutral card — we never want the preview to
 * blow up during a live demo.
 */
function SourcePreview({ source }: { source: SourceDocument }) {
  const url = sourceContentUrl(source.id);

  // Everything that isn't a PDF is an image-ish: `photo` (snapped menu
  // page), `post` (social screenshot), `board` (chalkboard photo). They
  // all load via `<img>` since the backend streams the original bytes
  // with the right Content-Type.
  if (source.kind !== 'pdf') {
    return (
      <img
        src={url}
        alt={source.filename}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'auto',
        }}
      />
    );
  }

  if (source.kind === 'pdf') {
    return (
      <iframe
        src={`${url}#view=FitH&toolbar=0&navpanes=0`}
        title={source.filename}
        // Sandbox without allow-scripts: PDFs don't need JS, and this
        // keeps a malformed upload from doing anything cute to the page.
        sandbox=""
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'var(--color-paper)',
        }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: '100%',
        height: '100%',
        color: 'var(--color-ink-subtle)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
      }}
    >
      {source.filename}
    </div>
  );
}
