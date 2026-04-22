import { forwardRef } from 'react';
import { Search, Download, LayoutList, LayoutGrid, Keyboard } from 'lucide-react';

export type ViewDensity = 'card' | 'compact';

interface Props {
  query: string;
  onQueryChange: (v: string) => void;
  density: ViewDensity;
  onDensityChange: (d: ViewDensity) => void;
  dishCount: number;
  filteredCount: number;
  onExport: () => void;
  onShowHelp?: () => void;
}

export const CockpitToolbar = forwardRef<HTMLInputElement, Props>(function CockpitToolbar({
  query,
  onQueryChange,
  density,
  onDensityChange,
  dishCount,
  filteredCount,
  onExport,
  onShowHelp,
}, searchRef) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 py-3"
      style={{ borderBottom: '1px solid var(--color-hairline)' }}
    >
      <div
        className="flex items-center gap-2"
        style={{
          background: 'var(--color-paper-tint)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-chip)',
          padding: '6px 12px',
          minWidth: 280,
          flex: '1 1 280px',
          maxWidth: 420,
        }}
      >
        <Search size={14} strokeWidth={1.5} color="var(--color-ink-muted)" />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Filter dishes, modifiers, ephemerals…"
          className="w-full bg-transparent outline-none"
          style={{
            fontSize: 14,
            lineHeight: '20px',
            color: 'var(--color-ink)',
          }}
        />
        <span
          className="font-mono"
          style={{ fontSize: 12, color: 'var(--color-ink-subtle)', whiteSpace: 'nowrap' }}
        >
          {filteredCount}/{dishCount}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center"
          style={{
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-chip)',
            overflow: 'hidden',
          }}
        >
          <DensityButton
            active={density === 'card'}
            onClick={() => onDensityChange('card')}
            label="Card"
          >
            <LayoutGrid size={14} strokeWidth={1.5} />
          </DensityButton>
          <DensityButton
            active={density === 'compact'}
            onClick={() => onDensityChange('compact')}
            label="Compact"
          >
            <LayoutList size={14} strokeWidth={1.5} />
          </DensityButton>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="caption cursor-pointer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-chip)',
            padding: '6px 12px',
            letterSpacing: '0.04em',
          }}
        >
          <Download size={14} strokeWidth={1.5} />
          Export JSON
        </button>
        {onShowHelp && (
          <button
            type="button"
            onClick={onShowHelp}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            className="cursor-pointer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'transparent',
              color: 'var(--color-ink-muted)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-chip)',
              padding: 7,
            }}
          >
            <Keyboard size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
});

function DensityButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className="cursor-pointer"
      style={{
        padding: '6px 10px',
        background: active ? 'var(--color-paper-deep)' : 'transparent',
        color: active ? 'var(--color-ink)' : 'var(--color-ink-muted)',
        border: 'none',
      }}
    >
      {children}
    </button>
  );
}
