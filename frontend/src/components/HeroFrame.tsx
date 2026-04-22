import { useEffect, useMemo } from 'react';
import type { CockpitState, SourceDocument } from '../domain/types';
import { CanonicalDishCard } from './CanonicalDishCard';
import { X } from 'lucide-react';

interface Props {
  state: CockpitState;
  onClose: () => void;
}

const kindCaption: Record<SourceDocument['kind'], string> = {
  pdf: 'Menu PDF',
  photo: 'Branch photo',
  post: 'Social post',
  board: 'Chalkboard',
};

function sourcesWord(n: number): string {
  if (n <= 1) return 'One messy source';
  if (n === 2) return 'Two messy sources';
  if (n === 3) return 'Three messy sources';
  if (n === 4) return 'Four messy sources';
  return `${n} messy sources`;
}

function EvidenceTile({ source }: { source: SourceDocument }) {
  return (
    <div
      className="relative flex flex-col gap-3"
      style={{
        background: 'var(--color-paper-deep)',
        borderRadius: 'var(--radius-input)',
        padding: 20,
        minHeight: 200,
      }}
    >
      <span
        className="caption self-start"
        style={{
          background: 'var(--color-paper)',
          color: 'var(--color-ink)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-chip)',
          letterSpacing: '0.04em',
        }}
      >
        {source.kind.toUpperCase()}
      </span>
      <div
        className="font-display"
        style={{
          fontWeight: 500,
          fontSize: 20,
          lineHeight: '28px',
          color: 'var(--color-ink)',
        }}
      >
        {kindCaption[source.kind]}
      </div>
      <div
        className="font-mono"
        style={{ fontSize: 13, lineHeight: '20px', color: 'var(--color-ink-muted)' }}
      >
        {source.filename}
      </div>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'var(--color-paper)',
          opacity: 0.1,
          borderRadius: 'var(--radius-input)',
        }}
      />
    </div>
  );
}

export function HeroFrame({ state, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Pick the best hero dish: prefer one with aliases (merged across sources),
  // else the one merged across the most sources, else the first one.
  const hero = useMemo(() => {
    const dishes = state.canonical_dishes;
    if (dishes.length === 0) return null;
    const withAliases = dishes.filter(d => d.aliases.length > 0);
    if (withAliases.length > 0) {
      return [...withAliases].sort(
        (a, b) => b.source_ids.length - a.source_ids.length,
      )[0];
    }
    return [...dishes].sort(
      (a, b) => b.source_ids.length - a.source_ids.length,
    )[0];
  }, [state.canonical_dishes]);

  // Evidence tiles: up to 4; cap so the 2x2 grid always looks intentional.
  const tiles = state.sources.slice(0, 4);
  const gridCols = tiles.length <= 1 ? 1 : 2;
  const phrase = sourcesWord(state.sources.length);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--color-paper)' }}
    >
      <header
        className="flex items-center justify-between px-10 py-6"
        style={{ borderBottom: '1px solid var(--color-hairline)' }}
      >
        <p
          className="font-display"
          style={{
            fontWeight: 500,
            fontSize: 40,
            lineHeight: '44px',
            color: 'var(--color-ink)',
          }}
        >
          {phrase} in. One{' '}
          <span className="font-accent" style={{ fontStyle: 'italic' }}>
            trustworthy
          </span>{' '}
          dish record out.
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close hero frame"
          className="cursor-pointer"
          style={{
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-chip)',
            padding: 8,
            background: 'transparent',
            color: 'var(--color-ink-muted)',
          }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>

      {hero ? (
        <section
          className="grid flex-1 gap-10 px-10 py-10"
          style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'center' }}
        >
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {tiles.map(src => (
              <EvidenceTile key={src.id} source={src} />
            ))}
          </div>
          <div className="flex justify-center">
            <CanonicalDishCard
              dish={hero}
              sources={state.sources}
              modifiers={state.modifiers}
              onModerate={() => {}}
              hero
            />
          </div>
        </section>
      ) : (
        <section className="flex flex-1 items-center justify-center px-10 py-10">
          <div
            className="flex flex-col items-center gap-3"
            style={{ maxWidth: 520, textAlign: 'center' }}
          >
            <p
              className="font-display"
              style={{ fontWeight: 500, fontSize: 28, lineHeight: '32px' }}
            >
              No canonical dish to feature yet
            </p>
            <p
              className="font-accent"
              style={{
                fontStyle: 'italic',
                fontSize: 18,
                lineHeight: '26px',
                color: 'var(--color-ink-muted)',
              }}
            >
              Upload evidence and Mise will surface a hero dish here.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
