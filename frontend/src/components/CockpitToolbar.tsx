import { forwardRef } from 'react';
import { Search, LayoutList, LayoutGrid, Keyboard, Check, X } from 'lucide-react';

export type ViewDensity = 'card' | 'compact';

interface Props {
  query: string;
  onQueryChange: (v: string) => void;
  density: ViewDensity;
  onDensityChange: (d: ViewDensity) => void;
  dishCount: number;
  filteredCount: number;
  onShowHelp?: () => void;
  /**
   * Bulk moderation. `pendingCount` counts dishes that are CURRENTLY
   * visible (after the text filter) AND still `PENDING`. Buttons are
   * disabled when that count is 0 so reviewers don't accidentally
   * approve dishes that are already approved. Undefined handlers hide
   * the bulk UI entirely — keeps this component reusable for surfaces
   * (TryIt) that don't expose moderation.
   */
  pendingCount?: number;
  onBulkApprove?: () => void;
  onBulkReject?: () => void;
}

export const CockpitToolbar = forwardRef<HTMLInputElement, Props>(function CockpitToolbar({
  query,
  onQueryChange,
  density,
  onDensityChange,
  dishCount,
  filteredCount,
  onShowHelp,
  pendingCount,
  onBulkApprove,
  onBulkReject,
}, searchRef) {
  const bulkAvailable =
    onBulkApprove !== undefined &&
    onBulkReject !== undefined &&
    pendingCount !== undefined;
  const bulkDisabled = !bulkAvailable || pendingCount === 0;
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
          placeholder="Filter this view (text match, no AI)…"
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
        {bulkAvailable && (
          <div
            className="flex items-center gap-1"
            style={{
              borderRight: '1px solid var(--color-hairline)',
              paddingRight: 8,
              marginRight: 4,
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                color: 'var(--color-ink-subtle)',
                textTransform: 'uppercase',
                marginRight: 4,
              }}
              title={`${pendingCount} dish${pendingCount === 1 ? '' : 'es'} visible and not yet moderated`}
            >
              Bulk
            </span>
            <BulkButton
              onClick={onBulkApprove!}
              disabled={bulkDisabled}
              title={`Approve all ${pendingCount} visible pending dishes`}
              aria="Approve all visible"
              tone="approve"
            >
              <Check size={13} strokeWidth={1.75} />
              <span>{pendingCount}</span>
            </BulkButton>
            <BulkButton
              onClick={onBulkReject!}
              disabled={bulkDisabled}
              title={`Reject all ${pendingCount} visible pending dishes`}
              aria="Reject all visible"
              tone="reject"
            >
              <X size={13} strokeWidth={1.75} />
              <span>{pendingCount}</span>
            </BulkButton>
          </div>
        )}
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

function BulkButton({
  onClick,
  disabled,
  title,
  aria,
  tone,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  aria: string;
  tone: 'approve' | 'reject';
  children: React.ReactNode;
}) {
  const color =
    tone === 'approve' ? 'var(--color-moss, #4a7b4d)' : 'var(--color-sienna, #b15a42)';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={aria}
      className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 9px',
        borderRadius: 'var(--radius-chip)',
        border: '1px solid var(--color-hairline)',
        background: 'transparent',
        color: disabled ? 'var(--color-ink-subtle)' : color,
        opacity: disabled ? 0.45 : 1,
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

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
