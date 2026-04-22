import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { apiGetProcessing } from '../api/client';
import type { ProcessingState, UUID } from '../domain/types';

interface Props {
  processingId: UUID | null;
  adaptiveThinkingPairs: number;
  onReady: () => void;
}

/**
 * Human-language labels for each state. "Extracting", "Reconciling", and
 * "Routing" are pipeline internals — a reviewer should not need to learn
 * them. Each title is a verb sentence; each whisper is one line of colour.
 */
const STAGES: Record<ProcessingState, { title: string; whisper: string }> = {
  queued: {
    title: 'Lining up your menus',
    whisper: 'The batch is accepted. We are about to start reading.',
  },
  extracting: {
    title: 'Reading your menus',
    whisper:
      'Claude Opus 4.7 is looking at every PDF, photo, and board the way a careful librarian would.',
  },
  reconciling: {
    title: 'Comparing dishes across sources',
    whisper:
      'The same plate can appear three ways — a typo on one PDF, a different word order on another. We decide which ones are actually the same.',
  },
  routing: {
    title: 'Organizing your catalog',
    whisper:
      'Modifiers, daily specials, and standalone dishes each get their own lane so the review is readable.',
  },
  ready: {
    title: 'Ready to review',
    whisper: 'Your canonical dish pack is prepared. Opening the review surface.',
  },
  failed: {
    title: 'Something went wrong',
    whisper:
      'The pipeline stopped before finishing. The review surface will tell you what we know.',
  },
};

const ORDER: ProcessingState[] = [
  'queued', 'extracting', 'reconciling', 'routing', 'ready',
];

function stageIndex(s: ProcessingState): number {
  const i = ORDER.indexOf(s);
  return i < 0 ? 0 : i;
}

export function Processing({ processingId, adaptiveThinkingPairs, onReady }: Props) {
  const [state, setState] = useState<ProcessingState>('queued');
  const [detail, setDetail] = useState<string | null>(null);
  const [liveAdaptivePairs, setLiveAdaptivePairs] = useState(adaptiveThinkingPairs);
  const [startedAt] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const cancelled = useRef(false);

  // Wall-clock ticker so the user sees the run isn't frozen even when a
  // backend stage takes its time (real-mode reconciliation can run ~30-60s).
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
          if (run.state === 'ready') {
            setTimeout(() => !cancelled.current && onReady(), 600);
            return;
          }
          if (run.state === 'failed') {
            setTimeout(() => !cancelled.current && onReady(), 600);
            return;
          }
          setTimeout(tick, 500);
        } catch (err) {
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
              {detail && state !== 'ready' && state !== 'failed' && (
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: '22px',
                    color: 'var(--color-ink-muted)',
                    marginTop: 4,
                  }}
                >
                  <span
                    className="font-mono"
                    style={{ color: 'var(--color-ink-subtle)', marginRight: 8 }}
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
                    {/* Short labels on the tracker, the big title above is the human copy. */}
                    {s === 'queued'
                      ? 'Queued'
                      : s === 'extracting'
                        ? 'Reading'
                        : s === 'reconciling'
                          ? 'Comparing'
                          : s === 'routing'
                            ? 'Organizing'
                            : 'Ready'}
                  </span>
                  {/* Hidden visually — used by screen readers and snapshot tests. */}
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
              Two plates looked close enough to deserve deeper thinking — we are
              letting the model reason about {liveAdaptivePairs} of them now.
            </motion.p>
          )}
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
        <span>
          Large menus can take a minute or two. The preview on the next screen
          is what you will approve.
        </span>
        <span className="font-mono" style={{ fontSize: 12 }}>
          claude-opus-4-7
        </span>
      </footer>
    </div>
  );
}
