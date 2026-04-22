import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
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
  batchId?: string;
}

function useCollapse(storageKey: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(storageKey) === '1';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (collapsed) window.localStorage.setItem(storageKey, '1');
    else window.localStorage.removeItem(storageKey);
  }, [storageKey, collapsed]);
  return [collapsed, () => setCollapsed(v => !v)];
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
  batchId,
}: Props) {
  const storageKey = `mise:collapsed:${batchId ?? 'default'}:${label}`;
  const [collapsed, toggle] = useCollapse(storageKey);

  if (dishes.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={toggle}
        className="flex items-baseline gap-3 text-left cursor-pointer select-none"
        style={{
          borderBottom: '1px solid var(--color-hairline)',
          paddingBottom: 8,
          background: 'transparent',
          width: '100%',
        }}
        aria-expanded={!collapsed}
      >
        <motion.span
          animate={{ rotate: collapsed ? 0 : 90 }}
          transition={{ duration: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
          style={{
            display: 'inline-flex',
            color: 'var(--color-ink-muted)',
            transformOrigin: 'center',
          }}
        >
          <ChevronRight size={14} strokeWidth={1.5} />
        </motion.span>
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
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-3">
          {dishes.map((dish, i) =>
            density === 'compact' ? (
              <motion.div
                key={dish.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.32,
                  delay: Math.min(i * 0.03, 0.45),
                  ease: [0.22, 0.61, 0.36, 1],
                }}
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
              </motion.div>
            ) : (
              <motion.div
                key={dish.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.32,
                  delay: Math.min(i * 0.03, 0.45),
                  ease: [0.22, 0.61, 0.36, 1],
                }}
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
              </motion.div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
