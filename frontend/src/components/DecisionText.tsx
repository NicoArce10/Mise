import { Fragment } from 'react';

interface Props {
  text: string;
}

type Match = { start: number; end: number; kind: 'merge' | 'no-merge' | 'routed' };

const PATTERNS: { rx: RegExp; kind: Match['kind'] }[] = [
  { rx: /\bextracted\b/gi, kind: 'merge' },
  { rx: /\bnot merged\b/gi, kind: 'no-merge' },
  { rx: /\bkept separate\b/gi, kind: 'no-merge' },
  { rx: /\brouted as modifier\b/gi, kind: 'routed' },
  { rx: /\brouted as ephemeral\b/gi, kind: 'routed' },
  { rx: /\brouted as canonical\b/gi, kind: 'routed' },
  // "merged" pattern kept out on purpose — UI no longer highlights it.
];

const COLORS: Record<Match['kind'], string> = {
  merge: 'var(--color-olive)',
  'no-merge': 'var(--color-sienna)',
  routed: 'var(--color-ochre)',
};

/**
 * Renders a decision summary with load-bearing verbs highlighted.
 *
 * Keeps the original text intact (no edits to the server payload); only
 * wraps the first few well-known verbs in a span with semantic color.
 * Subtle — the goal is "I can scan the decision in 0.3s", not neon.
 */
export function DecisionText({ text }: Props) {
  const matches: Match[] = [];
  for (const { rx, kind } of PATTERNS) {
    for (const m of text.matchAll(rx)) {
      if (m.index === undefined) continue;
      // Skip overlaps so multiple patterns don't double-decorate the same span.
      if (matches.some(x => m.index! < x.end && m.index! + m[0].length > x.start)) continue;
      matches.push({ start: m.index, end: m.index + m[0].length, kind });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  if (matches.length === 0) {
    return <>{text}</>;
  }

  const out: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) out.push(<Fragment key={`t-${i}`}>{text.slice(cursor, m.start)}</Fragment>);
    out.push(
      <span
        key={`m-${i}`}
        style={{
          color: COLORS[m.kind],
          fontWeight: 600,
        }}
      >
        {text.slice(m.start, m.end)}
      </span>,
    );
    cursor = m.end;
  });
  if (cursor < text.length) out.push(<Fragment key="t-end">{text.slice(cursor)}</Fragment>);
  return <>{out}</>;
}
