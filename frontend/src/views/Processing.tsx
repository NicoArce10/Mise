import { useEffect, useRef, useState } from 'react';
import { apiGetProcessing } from '../api/client';
import type { ProcessingState, UUID } from '../domain/types';

interface Props {
  processingId: UUID | null;
  adaptiveThinkingPairs: number;
  onReady: () => void;
}

const stageOrder: { state: ProcessingState; label: string; detail: string }[] = [
  { state: 'queued', label: 'Queued', detail: 'Evidence batch accepted' },
  { state: 'extracting', label: 'Extracting', detail: 'Reading evidence with Opus 4.7 vision' },
  { state: 'reconciling', label: 'Reconciling', detail: 'Adaptive thinking on ambiguous pairs' },
  { state: 'routing', label: 'Routing', detail: 'Classifying modifiers and ephemerals' },
  { state: 'ready', label: 'Ready', detail: 'Review pack prepared' },
];

export function Processing({ processingId, adaptiveThinkingPairs, onReady }: Props) {
  const [stageIdx, setStageIdx] = useState(0);
  const [liveAdaptivePairs, setLiveAdaptivePairs] = useState(adaptiveThinkingPairs);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    // API mode — poll the backend.
    if (processingId !== null) {
      const tick = async () => {
        if (cancelled.current) return;
        try {
          const run = await apiGetProcessing(processingId);
          const idx = stageOrder.findIndex(s => s.state === run.state);
          if (idx >= 0) setStageIdx(idx);
          if (run.adaptive_thinking_pairs > 0) {
            setLiveAdaptivePairs(run.adaptive_thinking_pairs);
          }
          if (run.state === 'ready') {
            // Small delay so the "ready" tick renders briefly before navigating.
            setTimeout(() => !cancelled.current && onReady(), 400);
            return;
          }
          if (run.state === 'failed') {
            console.warn('[mise] pipeline failed, falling back to cockpit anyway');
            setTimeout(() => !cancelled.current && onReady(), 400);
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

    // Mock mode — step through stages on a timer.
    const cleanup = runMockTimeline();
    return () => {
      cancelled.current = true;
      cleanup?.();
    };

    function runMockTimeline(): (() => void) | void {
      const timers: number[] = [];
      stageOrder.forEach((_, i) => {
        const t = window.setTimeout(() => {
          if (cancelled.current) return;
          setStageIdx(i);
          if (i === stageOrder.length - 1) {
            const t2 = window.setTimeout(() => !cancelled.current && onReady(), 500);
            timers.push(t2);
          }
        }, i * 850);
        timers.push(t);
      });
      return () => timers.forEach(t => clearTimeout(t));
    }
  }, [processingId, onReady]);

  const current = stageOrder[stageIdx];

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="flex items-baseline gap-6 px-10 py-5"
        style={{ borderBottom: '1px solid var(--color-hairline)' }}
      >
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
          Processing {processingId ? '· live' : '· mock'}
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col justify-center gap-12 px-10 py-16">
        <div className="flex flex-col gap-3">
          <span
            className="caption"
            style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
          >
            Stage {Math.max(stageIdx, 0) + 1} of {stageOrder.length}
          </span>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 56, lineHeight: '60px' }}
          >
            {current.label}
          </h1>
          <p
            className="font-accent"
            style={{
              fontStyle: 'italic',
              fontSize: 22,
              lineHeight: '28px',
              color: 'var(--color-ink-muted)',
            }}
          >
            {current.detail}
          </p>
          {current.state === 'reconciling' && liveAdaptivePairs > 0 && (
            <p
              className="font-mono"
              style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}
            >
              Adaptive thinking engaged on {liveAdaptivePairs} pair
              {liveAdaptivePairs === 1 ? '' : 's'}
            </p>
          )}
        </div>

        <ol className="flex flex-col gap-3">
          {stageOrder.map((s, i) => (
            <li
              key={s.state}
              className="flex items-center gap-4"
              style={{
                color:
                  i < stageIdx
                    ? 'var(--color-ink-muted)'
                    : i === stageIdx
                      ? 'var(--color-ink)'
                      : 'var(--color-ink-subtle)',
              }}
            >
              <span
                className="font-mono"
                style={{ fontSize: 13, width: 24, textAlign: 'right' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background:
                    i < stageIdx
                      ? 'var(--color-olive)'
                      : i === stageIdx
                        ? 'var(--color-ink)'
                        : 'var(--color-hairline)',
                }}
              />
              <span style={{ fontSize: 18 }}>{s.label}</span>
              <span
                className="font-accent"
                style={{
                  fontStyle: 'italic',
                  color: 'var(--color-ink-subtle)',
                  marginLeft: 8,
                }}
              >
                {s.detail}
              </span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
