import type { CanonicalDish, Modifier, SourceDocument } from '../domain/types';
import { CanonicalDishCard } from './CanonicalDishCard';
import { CanonicalDishCardCompact } from './CanonicalDishCardCompact';
import type { ViewDensity } from './CockpitToolbar';

interface Props {
  label: string;
  count: number;
  density: ViewDensity;
  dishes: CanonicalDish[];
  sources: SourceDocument[];
  modifiers: Modifier[];
  selectedId: string;
  onSelect: (id: string) => void;
  onModerate: (id: string, status: 'approved' | 'edited' | 'rejected') => void;
}

export function DishCategoryGroup({
  label,
  count,
  density,
  dishes,
  sources,
  modifiers,
  selectedId,
  onSelect,
  onModerate,
}: Props) {
  if (dishes.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div
        className="flex items-baseline gap-3"
        style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: 8 }}
      >
        <h2
          className="font-display"
          style={{ fontWeight: 500, fontSize: 22, lineHeight: '28px', color: 'var(--color-ink)' }}
        >
          {label}
        </h2>
        <span
          className="font-mono"
          style={{ fontSize: 12, color: 'var(--color-ink-subtle)' }}
        >
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {dishes.map(dish =>
          density === 'compact' ? (
            <div
              key={dish.id}
              onClick={() => onSelect(dish.id)}
              style={{ cursor: 'pointer' }}
              data-testid={`dish-${dish.canonical_name}`}
            >
              <CanonicalDishCardCompact
                dish={dish}
                sources={sources}
                modifiers={modifiers}
                onModerate={status => onModerate(dish.id, status)}
                selected={dish.id === selectedId}
              />
            </div>
          ) : (
            <div
              key={dish.id}
              onClick={() => onSelect(dish.id)}
              style={{ cursor: 'pointer' }}
              data-testid={`dish-${dish.canonical_name}`}
            >
              <CanonicalDishCard
                dish={dish}
                sources={sources}
                modifiers={modifiers}
                onModerate={status => onModerate(dish.id, status)}
              />
            </div>
          ),
        )}
      </div>
    </section>
  );
}
