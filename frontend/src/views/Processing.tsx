import { useEffect, useState } from 'react';
import type { ProcessingState } from '../domain/types';

interface Props {
  adaptiveThinkingPairs: number;
  onReady: () => void;
}

const stages: { state: ProcessingState; label: string; detail: string }[] = [
  { state: 'extracting', label: 'Extracting', detail: 'Reading evidence with Opus 4.7 vision' },
  { state: 'reconciling', label: 'Reconciling', detail: 'Adaptive thinking on ambiguous pairs' },
  { state: 'routing', label: 'Routing', detail: 'Classifying modifiers and ephemerals' },
  { state: 'ready', label: 'Ready', detail: 'Review pack prepared' },
];

export function Processing({ adaptiveThinkingPairs, onReady }: Props) {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    if (stageIdx >= stages.length - 1) {
      const t = setTimeout(() => onReady(), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStageIdx(i => i + 1), 1100);
    return () => clearTimeout(t);
  }, [stageIdx, onReady]);

  const current = stages[stageIdx];

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
          Processing
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col justify-center gap-12 px-10 py-16">
        <div className="flex flex-col gap-3">
          <span
            className="caption"
            style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
          >
            Stage {stageIdx + 1} of {stages.length}
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
          {current.state === 'reconciling' && adaptiveThinkingPairs > 0 && (
            <p
              className="font-mono"
              style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}
            >
              Adaptive thinking engaged on {adaptiveThinkingPairs} pair
              {adaptiveThinkingPairs === 1 ? '' : 's'}
            </p>
          )}
        </div>

        <ol className="flex flex-col gap-3">
          {stages.map((s, i) => (
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
