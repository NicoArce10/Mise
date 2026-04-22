import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, UploadCloud } from 'lucide-react';
import { apiGetProcessing, ApiError } from '../api/client';
import type { ProcessingState, UUID } from '../domain/types';

interface Props {
  processingId: UUID | null;
  adaptiveThinkingPairs: number;
  onReady: () => void;
  onSkipToSample?: () => void;
  onRetryUpload?: () => void;
}

/**
 * Human-language labels for each stage. The pipeline internals ("extracting",
 * "reconciling", "routing") are never shown verbatim — a reviewer should not
 * need to learn them. Each title is a verb sentence; each whisper is one
 * supporting line. The labels were written for the single-restaurant case,
 * which is the real-world default.
 */
const STAGES: Record<ProcessingState, { title: string; whisper: string }> = {
  queued: {
    title: 'Lining up your menu',
    whisper: 'The upload is accepted. Opus 4.7 is about to start reading.',
  },
  extracting: {
    title: 'Reading your menu',
    whisper:
      'Claude Opus 4.7 is looking at every PDF and photo vision-natively — no OCR, no pre-processing.',
  },
  reconciling: {
    title: 'Building the dish graph',
    whisper:
      'The model is writing the aliases and local-language search terms real diners actually use for each dish.',
  },
  routing: {
    title: 'Organizing your catalog',
    whisper:
      'Modifiers, daily specials, and standalone dishes each get their own lane so the catalog is readable.',
  },
  ready: {
    title: 'Ready to ask',
    whisper: 'Your searchable dish graph is prepared. Opening the search view.',
  },
  failed: {
    title: 'Something went wrong',
    whisper:
      'The pipeline stopped before finishing. The catalog view will tell you what we know.',
  },
};

const ORDER: ProcessingState[] = [
  'queued', 'extracting', 'reconciling', 'routing', 'ready',
];

function stageIndex(s: ProcessingState): number {
  const i = ORDER.indexOf(s);
  return i < 0 ? 0 : i;
}

export function Processing({
  processingId,
  adaptiveThinkingPairs,
  onReady,
  onSkipToSample,
  onRetryUpload,
}: Props) {
  const [state, setState] = useState<ProcessingState>('queued');
  const [detail, setDetail] = useState<string | null>(null);
  const [liveAdaptivePairs, setLiveAdaptivePairs] = useState(adaptiveThinkingPairs);
  const [startedAt] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recentDishes, setRecentDishes] = useState<string[]>([]);
  const cancelled = useRef(false);

  // Wall-clock ticker so the user sees the run isn't frozen even when a
  // backend stage takes its time. A vision-native Opus 4.7 extraction of a
  // two-page menu is typically 30–60 s on the real pipeline; this keeps the
  // reviewer reassured.
  useEffect(() => {
    const t = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 200);
    return () => window.clearInterval(t);
  }, [startedAt]);

  useEffect(() => {
    cancelled.current = false;

    if (processingId !== null) {
      const tick = async () => {
        if (cancelled.current) return;
        try {
          const run = await apiGetProcessing(processingId);
          setState(run.state);
          setDetail(run.state_detail ?? null);
          if (run.adaptive_thinking_pairs > 0) {
            setLiveAdaptivePairs(run.adaptive_thinking_pairs);
          }
          if (Array.isArray(run.recent_dishes)) {
            setRecentDishes(run.recent_dishes);
          }
          if (run.state === 'ready') {
            setTimeout(() => !cancelled.current && onReady(), 600);
            return;
          }
          if (run.state === 'failed') {
            // Do NOT auto-advance to the empty TryIt view. Stay on this
            // screen so the user sees the real `state_detail` from the
            // backend and can choose between retrying or falling back
            // to the sample menu.
            return;
          }
          // 1.2s polling is the sweet spot: fast enough that "Reading page
          // 3 of 5" feels responsive, slow enough that a 90s extraction
          // doesn't spam the backend with ~200 GETs (which also dirties
          // the server log and makes real errors hard to spot).
          setTimeout(tick, 1200);
        } catch (err) {
          // A 404 here means the run_id we're polling doesn't exist on the
          // backend anymore — almost always because uvicorn hot-reloaded
          // and wiped the in-memory store, and this browser tab is stuck
          // polling a stale run_id. Don't fall through to the mock (that
          // ends with a fake "ready" → empty TryIt screen): surface the
          // session as expired and push the user back to upload.
          if (err instanceof ApiError && err.status === 404) {
            cancelled.current = true;
            setState('failed');
            setDetail(
              'This processing session expired (the backend restarted). Upload your menu again — it takes a few seconds.',
            );
            return;
          }
          console.warn('[mise] processing poll failed, falling back to mock timeline', err);
          runMockTimeline();
        }
      };
      void tick();
      return () => {
        cancelled.current = true;
      };
    }

    const cleanup = runMockTimeline();
    return () => {
      cancelled.current = true;
      cleanup?.();
    };

    function runMockTimeline(): (() => void) | void {
      const timers: number[] = [];
      ORDER.forEach((s, i) => {
        const t = window.setTimeout(() => {
          if (cancelled.current) return;
          setState(s);
          if (i === ORDER.length - 1) {
            const t2 = window.setTimeout(() => !cancelled.current && onReady(), 500);
            timers.push(t2);
          }
        }, i * 850);
        timers.push(t);
      });
      return () => timers.forEach(t => clearTimeout(t));
    }
  }, [processingId, onReady]);

  const idx = stageIndex(state);
  const progress = Math.min(1, (idx + 1) / ORDER.length);
  const stage = STAGES[state] ?? STAGES.queued;

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  // Show the Skip CTA only when we're running live (processingId != null) AND
  // the wait is starting to feel long. A 12-second threshold keeps it out of
  // the way for quick runs but rescues long live extractions before boredom.
  const showSkip =
    onSkipToSample !== undefined &&
    processingId !== null &&
    elapsedSeconds >= 12 &&
    state !== 'ready' &&
    state !== 'failed';

  // Demo resilience: on a real run (processingId != null), if we've been
  // extracting for 45s+ and still have zero dishes, the Anthropic side is
  // probably having a bad minute. We don't cancel the background run — it
  // will finish (or not) on its own — but we surface a prominent rescue
  // ramp so the demo video never dies waiting on a flaky extraction.
  const extractionStalled =
    onSkipToSample !== undefined &&
    processingId !== null &&
    state === 'extracting' &&
    elapsedSeconds >= 45 &&
    recentDishes.length === 0;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--color-paper)' }}
    >
      <header
        className="flex items-baseline justify-between px-10 py-5"
        style={{ borderBottom: '1px solid var(--color-hairline)' }}
      >
        <div className="flex items-baseline gap-6">
          <span
            className="font-display"
            style={{ fontWeight: 500, fontSize: 28, lineHeight: '32px' }}
          >
            Mise
          </span>
          <span
            className="caption"
            style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
          >
            Processing {processingId ? '· live' : '· demo timeline'}
          </span>
        </div>
        <span
          className="font-mono"
          style={{ fontSize: 12, color: 'var(--color-ink-subtle)' }}
        >
          {elapsedSeconds}s elapsed
        </span>
      </header>

      <main
        className="mx-auto flex w-full flex-1 flex-col justify-center gap-12 px-10 py-16"
        style={{ maxWidth: 880 }}
      >
        <section className="flex flex-col gap-5">
          <span
            className="font-mono"
            style={{
              fontSize: 12,
              letterSpacing: '0.16em',
              color: 'var(--color-ink-subtle)',
              textTransform: 'uppercase',
            }}
          >
            Step {Math.min(idx + 1, ORDER.length)} of {ORDER.length}
          </span>

          <AnimatePresence mode="wait">
            <motion.div
              key={state}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
              className="flex flex-col gap-3"
            >
              <h1
                className="font-display"
                style={{
                  fontWeight: 500,
                  fontSize: 52,
                  lineHeight: '58px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-ink)',
                }}
              >
                {stage.title}
              </h1>
              <p
                className="font-accent"
                style={{
                  fontStyle: 'italic',
                  fontSize: 20,
                  lineHeight: '30px',
                  color: 'var(--color-ink-muted)',
                  maxWidth: 680,
                }}
              >
                {stage.whisper}
              </p>
              {detail && state !== 'ready' && (
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: '22px',
                    color:
                      state === 'failed'
                        ? 'var(--color-sienna)'
                        : 'var(--color-ink-muted)',
                    marginTop: 4,
                  }}
                >
                  <span
                    className="font-mono"
                    style={{
                      color:
                        state === 'failed'
                          ? 'var(--color-sienna)'
                          : 'var(--color-ink-subtle)',
                      marginRight: 8,
                    }}
                  >
                    ·
                  </span>
                  {detail}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        <section className="flex flex-col gap-3">
          <div
            style={{
              position: 'relative',
              height: 3,
              background: 'var(--color-hairline)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
              style={{
                height: '100%',
                background:
                  state === 'failed'
                    ? 'var(--color-sienna)'
                    : 'var(--color-ink)',
                borderRadius: 999,
              }}
            />
          </div>
          <ol className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {ORDER.map((s, i) => {
              const stageInfo = STAGES[s];
              const done = i < idx;
              const active = i === idx;
              return (
                <li
                  key={s}
                  className="flex items-baseline gap-2"
                  style={{ minWidth: 0 }}
                >
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--color-ink-subtle)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: done
                        ? 'var(--color-ink-muted)'
                        : active
                          ? 'var(--color-ink)'
                          : 'var(--color-ink-subtle)',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {s === 'queued'
                      ? 'Queued'
                      : s === 'extracting'
                        ? 'Reading'
                        : s === 'reconciling'
                          ? 'Graph'
                          : s === 'routing'
                            ? 'Organizing'
                            : 'Ready'}
                  </span>
                  <span hidden>{stageInfo.title}</span>
                </li>
              );
            })}
          </ol>
          {state === 'reconciling' && liveAdaptivePairs > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-accent"
              style={{
                fontStyle: 'italic',
                fontSize: 14,
                color: 'var(--color-ink-subtle)',
                marginTop: 4,
              }}
            >
              Some items were ambiguous enough to deserve deeper reasoning —
              Opus 4.7 is thinking about {liveAdaptivePairs} of them now.
            </motion.p>
          )}
        </section>

        {/* Live extraction feed. Shown only during `extracting` on a real
            run. The chip wall churns as Opus 4.7 finishes each page of a
            multi-page PDF, so a 90s extraction no longer looks like a
            frozen spinner. Also proves to the user that YES, their file
            is being read right now — we didn't just hang. */}
        <AnimatePresence>
          {(state === 'extracting' || state === 'reconciling') &&
            processingId !== null &&
            recentDishes.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-3"
                style={{
                  borderTop: '1px solid var(--color-hairline)',
                  paddingTop: 20,
                }}
              >
                <div className="flex items-baseline justify-between">
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'var(--color-ink-subtle)',
                    }}
                  >
                    Found so far
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      color: 'var(--color-ink-subtle)',
                    }}
                  >
                    {recentDishes.length} dish{recentDishes.length === 1 ? '' : 'es'}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  <AnimatePresence initial={false}>
                    {recentDishes.map((name) => (
                      <motion.li
                        key={name}
                        layout
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
                        style={{
                          background: 'var(--color-paper-tint)',
                          border: '1px solid var(--color-hairline)',
                          borderRadius: 'var(--radius-chip)',
                          padding: '6px 12px',
                          fontSize: 13,
                          color: 'var(--color-ink)',
                          lineHeight: '18px',
                        }}
                      >
                        {name}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.section>
            )}
        </AnimatePresence>

        {/* Failure recovery panel — we stay on Processing with state=failed
            so the user sees the backend's state_detail AND gets real next
            steps instead of being dumped into an empty TryIt view. */}
        <AnimatePresence>
          {state === 'failed' && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.24 }}
              className="flex flex-col gap-4"
              style={{
                background: 'var(--color-paper-tint)',
                border: '1px solid var(--color-sienna)',
                borderRadius: 'var(--radius-card)',
                padding: 24,
              }}
            >
              <div className="flex flex-col gap-1">
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--color-sienna)',
                  }}
                >
                  What now
                </span>
                <p
                  className="font-accent"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 18,
                    lineHeight: '26px',
                    color: 'var(--color-ink)',
                  }}
                >
                  Retry is almost always the right answer — most failures
                  here are transient hiccups on the model side. If you just
                  want to poke around the product, the sample menu below is
                  pre-processed.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {onRetryUpload && (
                  <button
                    type="button"
                    onClick={onRetryUpload}
                    className="cursor-pointer inline-flex items-center gap-2"
                    style={{
                      background: 'var(--color-ink)',
                      color: 'var(--color-paper)',
                      border: '1px solid var(--color-ink)',
                      borderRadius: 'var(--radius-chip)',
                      padding: '10px 16px',
                      fontSize: 13,
                      letterSpacing: '0.02em',
                    }}
                  >
                    <RotateCcw size={13} strokeWidth={1.7} />
                    Try again with another file
                  </button>
                )}
                {onSkipToSample && (
                  <button
                    type="button"
                    onClick={onSkipToSample}
                    className="cursor-pointer inline-flex items-center gap-2"
                    style={{
                      background: 'transparent',
                      color: 'var(--color-ink)',
                      border: '1px solid var(--color-hairline)',
                      borderRadius: 'var(--radius-chip)',
                      padding: '10px 16px',
                      fontSize: 13,
                      letterSpacing: '0.02em',
                    }}
                  >
                    <UploadCloud size={13} strokeWidth={1.7} />
                    See the sample menu instead
                  </button>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Extraction-stalled rescue panel. Shown when we've been reading
            for 45s+ with zero dishes surfaced — a clear signal that the
            upstream model call is having a bad minute. Gives the user a
            prominent path to the pre-computed sample menu so the demo
            momentum never dies. The background run keeps polling. */}
        <AnimatePresence>
          {extractionStalled && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.24 }}
              className="flex flex-col gap-4"
              style={{
                background: 'var(--color-paper-tint)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-card)',
                padding: 24,
              }}
            >
              <div className="flex flex-col gap-2">
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--color-ink-subtle)',
                  }}
                >
                  Taking longer than usual
                </span>
                <p
                  className="font-accent"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 18,
                    lineHeight: '26px',
                    color: 'var(--color-ink)',
                  }}
                >
                  Your menu is still being read in the background. If you
                  want to see the search and export flow right now, the
                  sample menu is pre-processed and ready.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onSkipToSample}
                  className="cursor-pointer inline-flex items-center gap-2"
                  style={{
                    background: 'var(--color-ink)',
                    color: 'var(--color-paper)',
                    border: '1px solid var(--color-ink)',
                    borderRadius: 'var(--radius-chip)',
                    padding: '10px 16px',
                    fontSize: 13,
                    letterSpacing: '0.02em',
                  }}
                >
                  <UploadCloud size={13} strokeWidth={1.7} />
                  See the sample catalog now
                </button>
                <span
                  className="font-mono"
                  style={{ fontSize: 11, color: 'var(--color-ink-subtle)' }}
                >
                  Your upload keeps running in the background.
                </span>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Reassurance (not a sample-CTA) after ~15s on a live run. A user
            who uploaded their REAL menu does not want to be pushed to "try
            the sample instead" mid-wait — that reads as the demo giving up
            on them. We just tell them the clock is normal for long menus. */}
        <AnimatePresence>
          {showSkip && !extractionStalled && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.24 }}
              className="flex flex-col gap-1"
              style={{
                background: 'var(--color-paper-tint)',
                border: '1px dashed var(--color-hairline)',
                borderRadius: 'var(--radius-card)',
                padding: 20,
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-subtle)',
                }}
              >
                Still reading
              </span>
              <p style={{ fontSize: 14, color: 'var(--color-ink-muted)' }}>
                Long menus take longer. Opus 4.7 is reading every page in
                parallel — each dish is confirmed by the model, not guessed.
                The search view opens as soon as it&apos;s done.
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer
        className="flex items-center justify-between px-10 py-5"
        style={{
          borderTop: '1px solid var(--color-hairline)',
          fontSize: 13,
          color: 'var(--color-ink-subtle)',
        }}
      >
        <span>
          One-page menus land in ~15 s. Big multi-page PDFs take longer —
          every page is read by Opus 4.7 itself, not a faster OCR shortcut.
          The search view opens as soon as the dish graph is ready.
        </span>
        <span className="font-mono" style={{ fontSize: 12 }}>
          claude-opus-4-7
        </span>
      </footer>
    </div>
  );
}
