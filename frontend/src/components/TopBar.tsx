import { Download, FileText, Search } from 'lucide-react';

interface Props {
  dishCount: number;
  onExport: () => void;
  canExport: boolean;
  onRestart: () => void;
  onOpenTryIt?: () => void;
  onViewMenu?: () => void;
}

export function TopBar({
  dishCount,
  onExport,
  canExport,
  onRestart,
  onOpenTryIt,
  onViewMenu,
}: Props) {
  const handleRestart = () => {
    const ok = window.confirm(
      'Start over? The current catalog will be cleared from this tab.',
    );
    if (ok) onRestart();
  };

  return (
    <header
      className="flex items-center justify-between px-10 py-5"
      style={{ borderBottom: '1px solid var(--color-hairline)' }}
    >
      <div className="flex items-baseline gap-6">
        <span
          className="font-display"
          style={{ fontWeight: 500, fontSize: 28, lineHeight: '32px' }}
        >
          Mise
        </span>
        <span
          className="caption"
          style={{
            color: 'var(--color-ink-subtle)',
            letterSpacing: '0.04em',
          }}
        >
          Catalog · {dishCount} dish{dishCount === 1 ? '' : 'es'} Mise extracted
        </span>
      </div>
      <div className="flex items-center gap-4">
        {onViewMenu && (
          <button
            type="button"
            onClick={onViewMenu}
            className="caption cursor-pointer inline-flex items-center gap-2"
            style={{
              background: 'transparent',
              color: 'var(--color-ink-muted)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-chip)',
              padding: '8px 14px',
              letterSpacing: '0.04em',
            }}
            title="See the menu this demo loaded"
          >
            <FileText size={13} strokeWidth={1.6} />
            View menu
          </button>
        )}
        {onOpenTryIt && (
          <button
            type="button"
            onClick={onOpenTryIt}
            className="caption cursor-pointer inline-flex items-center gap-2"
            style={{
              background: 'var(--color-paper-tint)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-chip)',
              padding: '8px 14px',
              letterSpacing: '0.04em',
            }}
          >
            <Search size={13} strokeWidth={1.6} />
            Ask this menu
          </button>
        )}
        <button
          type="button"
          onClick={handleRestart}
          className="caption cursor-pointer"
          style={{
            background: 'transparent',
            color: 'var(--color-ink-muted)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-chip)',
            padding: '8px 14px',
            letterSpacing: '0.04em',
          }}
        >
          New menu
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          className="caption cursor-pointer inline-flex items-center gap-2"
          style={{
            background: 'var(--color-ink)',
            color: 'var(--color-paper)',
            border: '1px solid var(--color-ink)',
            borderRadius: 'var(--radius-chip)',
            padding: '8px 14px',
            letterSpacing: '0.04em',
            opacity: canExport ? 1 : 0.5,
          }}
          title="Download the dish graph as JSON — plug it into any downstream system"
        >
          <Download size={13} strokeWidth={1.6} />
          Export JSON
        </button>
      </div>
    </header>
  );
}
