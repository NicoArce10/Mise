import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, ImageIcon } from 'lucide-react';
import type { ExtractionProgress, SourceDocument } from '../domain/types';
import { sourceContentUrl, sourcePageUrl } from '../api/client';

interface Props {
  sources: SourceDocument[];
  recentDishes: string[];
  /**
   * Real per-page progress from the backend. When present (real
   * pipeline, PDFs with multiple pages) the overlay ignores its
   * wall-clock and dish-count heuristics and syncs the thumbnail
   * directly to the `source_id` + `pages_done` the pipeline just
   * reported. When absent (mock pipeline, imagen suelta) the overlay
   * falls back to the progress-driven heuristic.
   */
  extractionProgress?: ExtractionProgress | null;
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
 * Page-flip honesty (two paths):
 *   - REAL: when `extractionProgress` is present, the thumbnail is
 *     slaved directly to the backend's per-page telemetry. Each PDF
 *     page is a SEPARATE vision call on the backend (the pipeline
 *     splits PDFs via `pypdf` and fans out to a thread pool), so we
 *     know exactly when Opus finishes a page. `pages_done + 1` is the
 *     page it's currently reading; we clamp to `pages_total` so the
 *     last page is sticky. No timers, no heuristics.
 *   - FALLBACK: when the backend signal is absent (mock pipeline, or
 *     a run of images where pages don't exist), the thumbnail advances
 *     when `recentDishes` grows by roughly one page's worth. Bounded
 *     by MIN/MAX dwell so it never sprints or freezes.
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
// The active preview is capped to these dimensions so the scanner
// never dominates the Processing screen. The aspect ratio inside is
// driven by the active source (a tall photo stays tall, a landscape
// PDF stays landscape) up to this envelope. These numbers tested as
// the sweet spot between "clearly readable" and "doesn't shove the
// progress bar off-screen on a 900px-tall laptop browser".
const PREVIEW_MAX_W = 440;
const PREVIEW_MAX_H = 260;

// Fallback aspect ratios when we don't yet know the real one (before
// an image has loaded, or for PDFs where we don't fetch dimensions).
// PDFs default to US-Letter portrait; images default to a neutral 4:3.
const FALLBACK_ASPECT_PDF = 8.5 / 11;
const FALLBACK_ASPECT_IMAGE = 4 / 3;

// How many newly-extracted dishes we assume correspond to "one page
// worth" of reading. The thumbnail's page number advances only after
// Opus has emitted this many new dishes since the last advance —
// which means the animation is literally tied to real extraction
// throughput, not a wall-clock timer.
//
// 3 was chosen as a reasonable floor: dense catalog pages have 8-12
// dishes (so we'd actually advance too slowly at 3 — see the minimum
// dwell cap below), but chalkboards and plates-of-the-day pages can
// have just 3-5. Picking a small number means we never get stuck on
// page 1 for a sparse source; the maximum-dwell cap handles the
// other end.
const DISHES_PER_PAGE_HEURISTIC = 3;

// Safety rails on top of the progress-driven paging. Without these,
// the animation either freezes for 20 s when Opus hits a slow page
// ("did it crash?") or sprints through 12 pages in a blink when a
// dense catalog returns 30+ dishes on one `recent_dishes` poll.
//   - MIN: never flip faster than this, even if 20 dishes landed at
//     once. Keeps the animation legible.
//   - MAX: if no new dishes in this window, advance one page anyway
//     so the thumbnail doesn't look frozen on runs that are genuinely
//     slow (first extraction call is always slower than subsequent).
const MIN_PAGE_DWELL_MS = 1400;
const MAX_PAGE_DWELL_MS = 5000;

// Minimum/maximum time any one source is the hero. A photo or single-
// page PDF parks at MIN so the rotation doesn't feel sluggish; a long
// PDF caps at MAX so one giant catalog doesn't hog the whole overlay.
// Between the two, we size each source's slot to however long it takes
// to cycle its pages once (pages × MAX), capped by the max.
const SOURCE_DWELL_MIN_MS = 5000;
const SOURCE_DWELL_MAX_MS = 18000;

function sourceDwellMs(src: SourceDocument | null): number {
  if (!src) return SOURCE_DWELL_MIN_MS;
  const pages = src.kind === 'pdf' ? (src.page_count ?? 1) : 1;
  if (pages <= 1) return SOURCE_DWELL_MIN_MS;
  // Budget ≈ pages × max dwell. Gives the progress-driven loop
  // enough room to cycle the whole PDF once if Opus is producing
  // dishes, without holding the source open indefinitely if it
  // isn't. +800 ms so the last page gets a beat before rotating.
  const raw = pages * MAX_PAGE_DWELL_MS + 800;
  return Math.max(SOURCE_DWELL_MIN_MS, Math.min(SOURCE_DWELL_MAX_MS, raw));
}

export function ScannerOverlay({ sources, recentDishes, extractionProgress }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  // When the backend publishes structured per-page progress, that's the
  // source of truth — it knows exactly which source Opus is reading and
  // which page just finished. We only fall back to the timer+heuristic
  // combo below when this is null (mock pipeline, images with no page
  // stream, or a PDF with 1 page where there's nothing to sync).
  const hasRealProgress = extractionProgress != null;

  // Per-source *target* page — the page the paging loop has asked the
  // <img> to load next. Keyed by source id so flipping between sources
  // resumes each PDF where we left it (the reviewer's attention isn't
  // yanked back to page 1 on every rotation).
  const [pdfPage, setPdfPage] = useState<Record<string, number>>({});

  // Per-source *displayed* page — the page whose PNG has actually
  // finished decoding and is on-screen right now. `onLoad` in
  // SourcePreview bumps this. We use this — not the target — for the
  // ribbon, so the text "page 3 of 12" never gets ahead of the image.
  // Previously we fed `pdfPage` straight to the ribbon and got 200-
  // 400ms of desync on every page flip, which the reviewer read as
  // "it's not aligned".
  const [displayedPage, setDisplayedPage] = useState<Record<string, number>>({});

  // Defensive: clamp in case `sources` shrinks between renders.
  const active = sources[Math.min(activeIdx, sources.length - 1)] ?? null;

  // Stable primitive handles off `active`. The Processing screen polls
  // every ~1.2s and rebuilds `sources`, so the `active` object's
  // reference churns. Depending on the object would re-run every effect
  // below on every poll and cancel any in-flight interval before it
  // fired — the exact bug that kept the thumbnail frozen on page 1
  // earlier. Keying effects on these primitives lets the timers live.
  const activeId = active?.id ?? null;
  const activeKind = active?.kind ?? null;
  const activePageCount = active?.page_count ?? null;

  // ----- REAL-SIGNAL PATH — sync to the backend's extraction_progress.
  //
  // When the pipeline publishes which source+page Opus just finished,
  // the overlay tracks it exactly. No rotation timer, no dish-count
  // heuristic, no wall-clock dwell. This is the "asi de simple" path
  // the reviewer asked for.
  useEffect(() => {
    if (!extractionProgress) return;
    const idx = sources.findIndex(s => s.id === extractionProgress.source_id);
    if (idx >= 0 && idx !== activeIdx) {
      setActiveIdx(idx);
    }
    // For multi-page PDFs: `pages_done` counts pages whose Opus call
    // has completed. The page Opus is *currently* working on is
    // therefore `pages_done + 1`, clamped to the total. On completion
    // (pages_done == pages_total) we hold on the last page so the
    // thumbnail doesn't rewind to 1 between stages.
    const src = idx >= 0 ? sources[idx] : null;
    if (src && src.kind === 'pdf' && extractionProgress.pages_total > 1) {
      const target = Math.min(
        Math.max(1, extractionProgress.pages_done + 1),
        extractionProgress.pages_total,
      );
      setPdfPage(prev =>
        prev[src.id] === target ? prev : { ...prev, [src.id]: target },
      );
    }
  }, [
    extractionProgress,
    sources,
    activeIdx,
  ]);

  // ----- HEURISTIC PATH — source rotation on a timer.
  //
  // Only runs when the backend isn't streaming per-page progress
  // (mock pipeline, or a run that only has image sources where there's
  // nothing to page through). The dwell is computed from the source's
  // page count so a 12-page PDF gets a longer slot than a single photo.
  const activeDwell = sourceDwellMs(active);
  useEffect(() => {
    if (hasRealProgress) return;
    if (sources.length <= 1) return;
    const handle = window.setTimeout(() => {
      setActiveIdx(i => (i + 1) % sources.length);
    }, activeDwell);
    return () => window.clearTimeout(handle);
  }, [activeIdx, sources.length, activeDwell, hasRealProgress]);

  // ----- Page paging for the active multi-page PDF -----
  //
  // The thumbnail's page number is NOT a wall-clock animation. It
  // advances when Opus has actually produced enough new dishes that,
  // at a typical menu density, it plausibly finished reading another
  // page. That gives the reviewer a faithful signal: if the thumbnail
  // is holding on a page, it's because Opus is still working on it.
  //
  // Two safety rails on top:
  //   - MIN_PAGE_DWELL_MS: never flip two pages back-to-back inside
  //     this window, even if 20 dishes landed in one poll. A too-fast
  //     flip feels like a bug.
  //   - MAX_PAGE_DWELL_MS: if no progress within this window, advance
  //     anyway. Otherwise the thumbnail looks frozen on runs where
  //     Opus's first call happens to be genuinely slow.
  //
  // Baselines are tracked in refs, not state, so they can be read +
  // written during the progress effect without triggering extra
  // re-renders or stale-closure bugs.

  /** Last `recentDishes.length` sampled when we advanced a page for each source. */
  const lastAdvanceDishCountRef = useRef<Record<string, number>>({});
  /** Last wall-clock timestamp we advanced a page for each source. */
  const lastAdvanceAtRef = useRef<Record<string, number>>({});

  // Reset the PDF to page 1 whenever it newly becomes hero AND we're
  // on the heuristic path. On the real-progress path the reset is
  // counterproductive — the backend may announce us on page 5 of the
  // previous source's continuation, and we want to trust it.
  useEffect(() => {
    if (hasRealProgress) return;
    if (!activeId) return;
    if (activeKind !== 'pdf') return;
    const pages = activePageCount ?? 0;
    if (pages <= 1) return;
    setPdfPage(prev => ({ ...prev, [activeId]: 1 }));
    setDisplayedPage(prev => ({ ...prev, [activeId]: 1 }));
    lastAdvanceDishCountRef.current[activeId] = recentDishes.length;
    lastAdvanceAtRef.current[activeId] = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeKind, activePageCount, hasRealProgress]);

  // Progress-driven page advance: whenever `recentDishes` grows past
  // the baseline by enough, or enough wall time has elapsed, bump the
  // page one step in the 1 → N → 1 loop. Heuristic path only.
  useEffect(() => {
    if (hasRealProgress) return;
    if (!activeId || activeKind !== 'pdf') return;
    const pages = activePageCount ?? 0;
    if (pages <= 1) return;

    const now = Date.now();
    const baselineDishes = lastAdvanceDishCountRef.current[activeId] ?? recentDishes.length;
    const baselineTime = lastAdvanceAtRef.current[activeId] ?? now;
    const progressed = recentDishes.length - baselineDishes;
    const elapsed = now - baselineTime;

    if (elapsed < MIN_PAGE_DWELL_MS) return;

    const enoughProgress = progressed >= DISHES_PER_PAGE_HEURISTIC;
    const timedOut = elapsed >= MAX_PAGE_DWELL_MS;
    if (!enoughProgress && !timedOut) return;

    setPdfPage(prev => {
      const curr = prev[activeId] ?? 1;
      const next = curr >= pages ? 1 : curr + 1;
      return { ...prev, [activeId]: next };
    });
    lastAdvanceDishCountRef.current[activeId] = recentDishes.length;
    lastAdvanceAtRef.current[activeId] = now;
  }, [recentDishes.length, activeId, activeKind, activePageCount, hasRealProgress]);

  // Heartbeat to unfreeze the timeout branch when the run is truly
  // idle. Heuristic path only — on the real-progress path we only
  // move when the backend tells us to, so there's nothing to unfreeze.
  const [, setHeartbeat] = useState(0);
  useEffect(() => {
    if (hasRealProgress) return;
    if (!activeId || activeKind !== 'pdf') return;
    const pages = activePageCount ?? 0;
    if (pages <= 1) return;
    const handle = window.setInterval(() => setHeartbeat(t => t + 1), 1000);
    return () => window.clearInterval(handle);
  }, [activeId, activeKind, activePageCount, hasRealProgress]);

  // Target page for the active source (what the <img> is fetching).
  const activeTargetPage =
    active && active.kind === 'pdf'
      ? (pdfPage[active.id] ?? 1)
      : 1;
  // Displayed page for the active source — the one whose PNG is
  // actually on-screen. Until the very first PNG has loaded,
  // `displayedPage[id]` is missing; we fall back to target so the
  // ribbon doesn't flicker "page ? of 12" on the first render.
  const activeDisplayedPage =
    active && active.kind === 'pdf'
      ? (displayedPage[active.id] ?? activeTargetPage)
      : 1;

  // When `sources` hasn't arrived yet (first 1–2 polls, or a backend
  // that hasn't been restarted to pick up the `sources` enrichment on
  // the ProcessingRun payload) we STILL render the overlay so the user
  // sees the scanner animation immediately. The preview area shows a
  // neutral "reading your upload" placeholder instead of the real
  // document; the dish chip column and scanner line are unchanged.
  const inPlaceholderMode = sources.length === 0;

  // Aspect ratio of the active source, keyed by source id so an image
  // that loads later updates *its* card without re-rendering others.
  // The backend sends width_px/height_px when it knows them (none of
  // our real paths populate this today — it's a fixture-era field);
  // otherwise the <img> onLoad handler below fills this in.
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const handleImgLoad = (id: string, w: number, h: number) => {
    if (!w || !h) return;
    setMeasured(prev => (prev[id] === w / h ? prev : { ...prev, [id]: w / h }));
  };

  // Compute the aspect ratio for the ACTIVE preview. Priority:
  //   1. measured value (image has loaded and we have real dimensions);
  //   2. backend-provided width_px/height_px;
  //   3. kind-based fallback so we at least don't flash 16:10 letterboxing.
  let activeAspect = active?.kind === 'pdf'
    ? FALLBACK_ASPECT_PDF
    : FALLBACK_ASPECT_IMAGE;
  if (active) {
    if (measured[active.id]) {
      activeAspect = measured[active.id];
    } else if (active.width_px && active.height_px) {
      activeAspect = active.width_px / active.height_px;
    }
  }
  // Compute the rendered width/height so the container sizes itself to
  // fit the source without cropping, honoring both the width and height
  // caps. CSS `aspect-ratio` alone would honor width but let height
  // explode; this pair of clamps is what makes a portrait iPhone photo
  // stay compact while a landscape chalkboard still fills the row.
  const heightFromWidth = PREVIEW_MAX_W / activeAspect;
  const previewW = heightFromWidth <= PREVIEW_MAX_H
    ? PREVIEW_MAX_W
    : PREVIEW_MAX_H * activeAspect;
  const previewH = Math.min(heightFromWidth, PREVIEW_MAX_H);

  return (
    <div
      className="flex flex-col gap-4"
      style={{
        borderTop: '1px solid var(--color-hairline)',
        paddingTop: 20,
      }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
            }}
          >
            Opus 4.7 · vision-native pass
          </span>
          {/* When a batch has multiple sources, surface which one we're
              on so a reviewer watching the overlay rotate knows it's
              not a glitch — "source 2 of 5" is the visual counterpart
              of the "page X of N" ribbon inside the preview. Hidden
              for single-source uploads where it would be noise. */}
          {sources.length > 1 && active && (
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--color-paper-tint)',
                border: '1px solid var(--color-hairline)',
                color: 'var(--color-ink-muted)',
              }}
              title={sources.map((s, i) => `${i + 1}. ${s.filename}`).join('\n')}
            >
              Source {activeIdx + 1} of {sources.length}
            </span>
          )}
        </div>
        <span
          className="font-accent"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-ink-subtle)',
          }}
        >
          Reading the document itself — no text recognition step.
        </span>
      </div>

      <div
        className="flex items-start gap-6"
        style={{
          // Use flex (not grid) so the preview can shrink to its real
          // aspect ratio instead of being forced into a fixed column
          // width. The chip column takes the remaining space up to a
          // cap so it never blows out on a wide screen.
          flexWrap: 'nowrap',
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
            // Driven by the active source's real aspect ratio so photos
            // and PDFs show in full — no more cropping. Smoothly
            // re-sizes when the user cycles sources or an image's
            // naturalWidth becomes available.
            width: previewW,
            height: previewH,
            flexShrink: 0,
            transition: 'width 260ms ease, height 260ms ease',
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
                <SourcePreview
                  source={active}
                  pdfPage={activeTargetPage}
                  onImgLoad={(w, h) => handleImgLoad(active.id, w, h)}
                  onPdfPageRendered={pageNum => {
                    // Only accept the acknowledgement if it still
                    // matches the page we asked for; otherwise the
                    // <img> reported a stale load that raced the
                    // timer and would make the ribbon jump backward.
                    if (pageNum === activeTargetPage) {
                      setDisplayedPage(prev =>
                        prev[active.id] === pageNum
                          ? prev
                          : { ...prev, [active.id]: pageNum },
                      );
                    }
                  }}
                />
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
              and a fake one would be misleading. For PDFs with a known
              page count > 1, we append "page 1 of N" since the iframe
              renders page 1 by default via #view=FitH. Streaming the
              actual page Opus is currently reading is a backend infra
              follow-up — what we show here is accurate, just static. */}
          {active && !inPlaceholderMode && (
            <div
              style={{
                position: 'absolute',
                left: 10,
                bottom: 10,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(18,18,20,0.78)',
                color: 'var(--color-paper)',
                fontSize: 11,
                lineHeight: '14px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.02em',
                maxWidth: 'calc(100% - 20px)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Reading · {active.filename}
              {active.kind === 'pdf'
                && active.page_count
                && active.page_count > 1
                ? ` · page ${activeDisplayedPage} of ${active.page_count}`
                : ''}
            </div>
          )}
        </div>

        {/* ---------- Live dish chip column ---------- */}
        {/* We cap the chip list to a count that we KNOW fits the
            preview's height so chips never get cropped mid-border.
            Each chip occupies ~32px (14 px font + 6+6 padding + border
            + 6 px gap). Header + label eats ~26 px. At the default
            previewH of 260 we can show 6 chips cleanly. We derive the
            cap from previewH so portrait photos (taller preview) get
            a taller chip column automatically. */}
        {(() => {
          const CHIP_UNIT_PX = 32;
          const HEADER_PX = 26;
          const maxChips = Math.max(
            3,
            Math.min(8, Math.floor((previewH - HEADER_PX) / CHIP_UNIT_PX)),
          );
          const visible = recentDishes.slice(-maxChips).reverse();
          return (
        <div
          className="flex flex-col gap-2"
          style={{
            minWidth: 0,
            flex: '1 1 0',
            maxWidth: 260,
            // Match the preview's rendered height so the scanner card
            // and the chip column stay vertically aligned.
            height: previewH,
          }}
        >
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
              gap: 6,
              flex: '1 1 auto',
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              // Soft fade only on the very bottom edge so the last
              // chip still reads clearly. The previous 82→100 fade
              // was erasing half of chip #4 on short previews.
              maskImage:
                'linear-gradient(to bottom, black 0%, black 92%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black 0%, black 92%, transparent 100%)',
            }}
          >
            <AnimatePresence initial={false}>
              {visible.map(name => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
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
                      flex: '0 0 auto',
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
          );
        })()}
      </div>

      {/* ---------- Source-strip: one pill per uploaded file ----------
          Shows the full batch as an ordered list of pills so the
          reviewer can see at a glance how many files the rotation is
          cycling through, which one is active NOW (pulsing dot, ink-
          on-paper colouring), and which are still queued up. Clicking
          a non-active pill jumps the rotation there immediately — it
          resets the timer so the user can force focus on a specific
          file without waiting out the dwell.

          Hidden when there's only one source since a one-element list
          would just be noise next to the already-visible filename on
          the ribbon inside the preview. */}
      {sources.length > 1 && (
        <div
          className="flex flex-wrap gap-2"
          aria-label="Uploaded sources, in processing order"
        >
          {sources.map((src, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={src.id}
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={`Focus ${src.filename}${isActive ? ' (current)' : ''}`}
                aria-current={isActive ? 'true' : undefined}
                className="cursor-pointer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 11px',
                  border: `1px solid ${isActive ? 'var(--color-ink)' : 'var(--color-hairline)'}`,
                  borderRadius: 'var(--radius-chip)',
                  background: isActive
                    ? 'var(--color-ink)'
                    : 'var(--color-paper)',
                  fontSize: 12,
                  color: isActive
                    ? 'var(--color-paper)'
                    : 'var(--color-ink-muted)',
                  fontFamily: 'var(--font-mono)',
                  maxWidth: 240,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  transition: 'background 220ms ease, color 220ms ease, border-color 220ms ease',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 10,
                    opacity: 0.6,
                    letterSpacing: '0.06em',
                  }}
                >
                  {i + 1}
                </span>
                {src.kind === 'pdf' ? (
                  <FileText size={12} strokeWidth={1.6} />
                ) : (
                  // `photo` | `post` | `board` are all image-ish from
                  // the user's perspective; one icon covers all three.
                  <ImageIcon size={12} strokeWidth={1.6} />
                )}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 180,
                  }}
                >
                  {src.filename}
                </span>
                {isActive && (
                  <motion.span
                    aria-hidden
                    animate={{ opacity: [1, 0.35, 1] }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: 'var(--color-sienna, #c9623f)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Inline preview of one uploaded source. Image sources render with
 * `object-fit: contain` so the full document is visible (no cropping);
 * the container around us is already sized to the image's real aspect
 * ratio, so `contain` doesn't introduce visible letterboxing in the
 * common case. PDFs render in an iframe pointing at the stream endpoint
 * with `#view=FitH&toolbar=0` to hide native chrome. Unknown MIME types
 * degrade to a neutral card — we never want the preview to blow up
 * during a live demo.
 */
function SourcePreview({
  source,
  pdfPage,
  onImgLoad,
  onPdfPageRendered,
}: {
  source: SourceDocument;
  /**
   * 1-indexed page currently on-screen for PDFs. Ignored for non-PDF
   * sources. Defaults to 1 upstream so we always have a valid value.
   */
  pdfPage: number;
  onImgLoad?: (naturalWidth: number, naturalHeight: number) => void;
  /**
   * Fires when the PDF page PNG has finished decoding and is on-screen.
   * The parent uses this to advance its "displayed page" state so the
   * ribbon caption stays in lockstep with the visible frame — without
   * it, the ribbon raced ahead of slow page loads and looked desynced.
   */
  onPdfPageRendered?: (page: number) => void;
}) {
  // Track per-source render failure so a malformed PDF doesn't loop
  // endlessly on a broken <img>. Hoisted above any early returns to
  // keep hook order stable across re-renders (React's rules-of-hooks).
  const [failed, setFailed] = useState(false);
  // Reset the failure flag whenever we switch sources so a previous
  // source's error doesn't persist to the new one.
  useEffect(() => {
    setFailed(false);
  }, [source.id]);

  // Everything that isn't a PDF is an image-ish: `photo` (snapped menu
  // page), `post` (social screenshot), `board` (chalkboard photo). They
  // all load via `<img>` pointing at the raw-bytes endpoint with the
  // right Content-Type. `onLoad` reports the natural dimensions up so
  // the parent can size its container to match — that's the fix for
  // the "portrait photo gets cropped in half" bug.
  if (source.kind !== 'pdf') {
    return (
      <img
        src={sourceContentUrl(source.id)}
        alt={source.filename}
        onLoad={e => {
          const img = e.currentTarget;
          onImgLoad?.(img.naturalWidth, img.naturalHeight);
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          imageRendering: 'auto',
        }}
      />
    );
  }

  // PDFs: render the current page as a PNG via the backend's pdfium
  // renderer. We used to embed an <object type="application/pdf">,
  // but that had three problems:
  //   1. The browser's native PDF plugin always opens at page 1 and
  //      ignores DOM attempts to page through it, so the ribbon's
  //      "page 3 of 17" was lying about what the reviewer actually
  //      saw.
  //   2. Native PDF chrome (outlines, toolbars) leaks in on some
  //      browsers even with #toolbar=0, breaking the scanner aesthetic.
  //   3. Strict sandboxes (corporate Chrome, mobile webviews) fall
  //      back to "install PDF viewer" cards which look broken.
  // Rendering each page as a PNG with pypdfium2 on the server sidesteps
  // all three — we always show the exact page we claim to, the preview
  // looks like a clean menu photograph, and the PNG renders everywhere.
  // The <img> onLoad plumbs natural dimensions back so the container
  // resizes to the PDF's real aspect ratio. If the request fails we
  // fall back to the typographic placeholder.
  const pages = source.page_count ?? 0;
  const pageToRender = pages > 0 ? Math.min(Math.max(1, pdfPage), pages) : 1;

  if (failed) {
    return <PdfPlaceholder source={source} />;
  }

  return (
    <img
      src={sourcePageUrl(source.id, pageToRender)}
      alt={`${source.filename} — page ${pageToRender}`}
      onLoad={e => {
        const img = e.currentTarget;
        onImgLoad?.(img.naturalWidth, img.naturalHeight);
        onPdfPageRendered?.(pageToRender);
      }}
      onError={() => setFailed(true)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        background: 'var(--color-paper)',
        // Smooth crossfade when the page rotates. Works because the
        // src change is instant but decode isn't — the browser keeps
        // the old frame on-screen until the next one is ready, and
        // the filter mimics a printed-page feel.
        transition: 'filter 160ms ease',
      }}
    />
  );
}

/**
 * Typographic PDF card. Used in two places:
 *
 * 1. As the `<object>` fallback above when the browser can't render
 *    PDFs natively (e.g. strict corporate Chrome, some mobile views).
 * 2. Could be used as the primary renderer if we ever decide we'd
 *    rather never embed a PDF viewer at all — the vision-native
 *    message actually reads cleaner with a clean card than with a
 *    zoomed, resampled PDF page.
 *
 * The card is deliberately information-forward (filename + page
 * count) so the reviewer can verify they uploaded the right file
 * without needing the preview to succeed. Page count is sourced
 * from `page_count`, which the backend populates at upload time —
 * null means "we couldn't read the count", and we just omit that
 * chip rather than show "page 1 of null".
 */
function PdfPlaceholder({ source }: { source: SourceDocument }) {
  const pages = source.page_count && source.page_count > 0 ? source.page_count : null;
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      style={{
        width: '100%',
        height: '100%',
        background:
          'repeating-linear-gradient(135deg, var(--color-paper-tint) 0 14px, var(--color-paper) 14px 28px)',
        color: 'var(--color-ink-muted)',
        fontFamily: 'var(--font-mono)',
        padding: 18,
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-subtle)',
        }}
      >
        PDF document
      </span>
      <span
        style={{
          fontSize: 14,
          lineHeight: '18px',
          color: 'var(--color-ink)',
          maxWidth: '92%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={source.filename}
      >
        {source.filename}
      </span>
      {pages !== null && (
        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--color-ink-subtle)',
          }}
        >
          {pages} page{pages === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
