import type { CanonicalDish, Modifier, SourceDocument } from '../domain/types';
import { Chip } from './Chip';
import { ConfidenceBar } from './ConfidenceBar';
import { DecisionSummaryBlock } from './DecisionSummary';
import { ModifierChip } from './ModifierChip';
import { SourceArrow } from './SourceArrow';
import { ActionBar } from './ActionBar';

interface Props {
  dish: CanonicalDish;
  sources: SourceDocument[];
  modifiers: Modifier[];
  onModerate: (status: 'approved' | 'edited' | 'rejected') => void;
  hero?: boolean;
}

export function CanonicalDishCard({ dish, sources, modifiers, onModerate, hero }: Props) {
  const bySource = new Map(sources.map(s => [s.id, s]));
  const provenance = dish.source_ids
    .map(id => bySource.get(id))
    .filter((s): s is SourceDocument => Boolean(s));
  const attached = modifiers.filter(m => m.parent_dish_id === dish.id);

  // UI never says "Merged". Single-restaurant menus never trigger a pairwise
  // merge narrative for the reviewer — the dish was simply extracted from
  // the menu. The backend still distinguishes cases for eval purposes.
  const variant: 'merged' | 'not-merged' =
    dish.decision.lead_word === 'Not merged' ? 'not-merged' : 'merged';
  const chipLabel =
    dish.decision.lead_word === 'Not merged'
      ? 'Kept separate'
      : dish.decision.lead_word === 'Routed'
        ? 'Modifier'
        : dish.decision.lead_word === 'Held'
          ? 'Needs review'
          : 'Extracted';

  return (
    <article
      className="flex flex-col gap-5 transition-shadow duration-[180ms]"
      style={{
        background: 'var(--color-paper-tint)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
        padding: hero ? 32 : 24,
        width: hero ? 520 : '100%',
        boxShadow: hero ? 'var(--shadow-atmosphere)' : undefined,
      }}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2
            className="font-display"
            style={{
              fontWeight: 500,
              fontSize: hero ? 56 : 40,
              lineHeight: hero ? '60px' : '44px',
              letterSpacing: hero ? '-0.02em' : undefined,
              color: 'var(--color-ink)',
            }}
          >
            {dish.canonical_name}
          </h2>
          {dish.aliases.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] leading-5"
              style={{ color: 'var(--color-ink-muted)' }}
            >
              <span className="caption" style={{ color: 'var(--color-ink-subtle)' }}>
                Also seen as
              </span>
              {dish.aliases.map(alias => {
                const isTypo = alias === 'Marghertia';
                return (
                  <span
                    key={alias}
                    className={isTypo ? 'font-accent' : 'font-sans'}
                    style={{
                      fontStyle: isTypo ? 'italic' : 'normal',
                      color: 'var(--color-ink-muted)',
                    }}
                  >
                    {alias}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <Chip variant={variant}>{chipLabel}</Chip>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {provenance.map(src => (
          <SourceArrow key={src.id} source={src} />
        ))}
      </div>

      <DecisionSummaryBlock
        decision={dish.decision}
        aliasItalic={dish.aliases.includes('Marghertia') ? 'Marghertia' : undefined}
      />

      {attached.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="caption" style={{ color: 'var(--color-ink-subtle)' }}>
            Modifiers
          </span>
          {attached.map(mod => (
            <ModifierChip key={mod.id} modifier={mod} />
          ))}
        </div>
      )}

      <div
        className="flex flex-col gap-3 pt-4"
        style={{ borderTop: '1px solid var(--color-hairline)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="caption"
            style={{ color: 'var(--color-ink-subtle)', minWidth: 88 }}
          >
            Confidence
          </span>
          <ConfidenceBar value={dish.decision.confidence} />
        </div>
        <div className="flex items-center justify-end">
          <ActionBar moderation={dish.moderation} onModerate={onModerate} />
        </div>
      </div>
    </article>
  );
}
