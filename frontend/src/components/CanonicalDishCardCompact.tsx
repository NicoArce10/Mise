import type { CanonicalDish, Modifier, SourceDocument } from '../domain/types';
import { Chip } from './Chip';
import { Confidence } from './Confidence';
import { ActionBar } from './ActionBar';

/**
 * Dense one-row card for long lists (>10 canonicals).
 *
 * Keeps name, alias-count, source-count, confidence, and the Approve/Edit/
 * Reject action bar visible without blowing vertical space. Click the row
 * to select it in the DetailRail and see the full decision summary there.
 */
interface Props {
  dish: CanonicalDish;
  sources: SourceDocument[];
  modifiers: Modifier[];
  onModerate: (status: 'approved' | 'edited' | 'rejected') => void;
  selected?: boolean;
}

export function CanonicalDishCardCompact({ dish, sources, modifiers, onModerate, selected }: Props) {
  const typoAlias = dish.aliases.find(a => a !== dish.canonical_name);
  const attachedModCount = modifiers.filter(m => m.parent_dish_id === dish.id).length;
  const variant: 'merged' | 'not-merged' =
    dish.decision.lead_word === 'Not merged' ? 'not-merged' : 'merged';

  return (
    <article
      className="grid items-center transition-colors duration-[180ms]"
      style={{
        gridTemplateColumns: 'minmax(0,1fr) auto auto auto auto',
        gap: 16,
        background: selected ? 'var(--color-paper-tint)' : 'transparent',
        border: '1px solid var(--color-hairline)',
        borderLeft: selected ? '3px solid var(--color-ink)' : '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-input)',
        padding: '12px 16px',
      }}
    >
      <div className="flex min-w-0 flex-col">
        <div className="flex items-baseline gap-2">
          <span
            className="font-display truncate"
            style={{ fontWeight: 500, fontSize: 18, lineHeight: '24px', color: 'var(--color-ink)' }}
          >
            {dish.canonical_name}
          </span>
          {typoAlias && (
            <span
              style={{ fontSize: 13, color: 'var(--color-ink-subtle)' }}
              title={`also seen as: ${typoAlias}`}
            >
              <span className="caption" style={{ marginRight: 4 }}>also:</span>
              <span className="font-accent" style={{ fontStyle: 'italic' }}>{typoAlias}</span>
            </span>
          )}
        </div>
        {dish.ingredients.length > 0 && (
          <span
            className="truncate"
            style={{ fontSize: 13, color: 'var(--color-ink-subtle)', marginTop: 2 }}
          >
            {dish.ingredients.join(' · ')}
          </span>
        )}
      </div>

      <span
        className="font-mono"
        style={{ fontSize: 12, color: 'var(--color-ink-subtle)' }}
        title={`${dish.source_ids.length} source(s)`}
      >
        {dish.source_ids.length} src
      </span>

      {attachedModCount > 0 && (
        <span
          className="font-mono"
          style={{ fontSize: 12, color: 'var(--color-ink-subtle)' }}
        >
          +{attachedModCount} mod
        </span>
      )}

      <Chip variant={variant}>
        {dish.decision.lead_word === 'Not merged'
          ? 'Separate'
          : dish.decision.lead_word === 'Routed'
            ? 'Modifier'
            : dish.decision.lead_word === 'Held'
              ? 'Review'
              : 'Extracted'}
      </Chip>

      <div className="flex items-center gap-3">
        <Confidence value={dish.decision.confidence} />
        <ActionBar moderation={dish.moderation} onModerate={onModerate} />
      </div>
      {/* sources unused in compact mode but kept in props to keep API parity with CanonicalDishCard */}
      <span hidden>{sources.length}</span>
    </article>
  );
}
