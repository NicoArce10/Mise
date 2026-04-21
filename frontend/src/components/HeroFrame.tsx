import { useEffect } from 'react';
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
        className="font-accent"
        style={{
          fontStyle: 'italic',
          color: 'var(--color-ink-subtle)',
          fontSize: 16,
          marginTop: 'auto',
        }}
      >
        {source.kind === 'pdf' && "Pizza Marghertia — tomato, mozzarella, basil — €9"}
        {source.kind === 'photo' && 'Margherita — €9 · Pizza Funghi — €11'}
        {source.kind === 'board' && 'Pizza Margherita · add burrata +3'}
        {source.kind === 'post' && "Tonight: Chef's Special"}
      </div>
      {/* Scrim to read as "cleaned up" */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'var(--color-paper)', opacity: 0.1, borderRadius: 'var(--radius-input)' }}
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

  const margherita = state.canonical_dishes.find(d => d.canonical_name === 'Margherita');
  const tiles = state.sources.slice(0, 4);

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
          Three messy sources in. One{' '}
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
      <section
        className="grid flex-1 gap-10 px-10 py-10"
        style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'center' }}
      >
        <div className="grid grid-cols-2 gap-4">
          {tiles.map(src => (
            <EvidenceTile key={src.id} source={src} />
          ))}
        </div>
        <div className="flex justify-center">
          {margherita && (
            <CanonicalDishCard
              dish={margherita}
              sources={state.sources}
              modifiers={state.modifiers}
              onModerate={() => {}}
              hero
            />
          )}
        </div>
      </section>
    </div>
  );
}
