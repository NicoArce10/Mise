import { Download, FileText, Search, Upload } from 'lucide-react';

interface Props {
  dishCount: number;
  onExport: () => void;
  canExport: boolean;
  /**
   * Fires when the user clicks the "Mise" word-mark. Conventionally goes
   * home / landing. Kept optional so surfaces that don't want a home
   * link can leave it out; in that case the word-mark is non-interactive.
   */
  onGoHome?: () => void;
  /**
   * Fires when the user clicks the "New menu" / "Upload your menu"
   * button. This MUST go to the upload surface, not the landing page.
   * Previously we routed this through `onRestart` (the home link) and
   * the two roles silently collided — clicking "New menu" sent the
   * reviewer back to the marketing landing instead of the uploader,
   * which felt like a dead end mid-session. Splitting the callbacks
   * is how we fix that without having the consumer remember the trap.
   */
  onUploadNew: () => void;
  onOpenTryIt?: () => void;
  onViewMenu?: () => void;
  /** True when viewing the pre-computed demo menu. When true the
   * "New menu" button swaps copy + icon to nudge the user toward
   * uploading their own, because "New menu" in demo context was
   * confusing ("why would I load another demo?"). */
  sampleMode?: boolean;
}

export function TopBar({
  dishCount,
  onExport,
  canExport,
  onGoHome,
  onUploadNew,
  onOpenTryIt,
  onViewMenu,
  sampleMode = false,
}: Props) {
  const handleUploadNew = () => {
    // Only confirm when the user has real work to lose. In sampleMode
    // they didn't upload anything, so blocking them with a dialog when
    // we're literally telling them "upload yours" is friction theatre.
    if (sampleMode) {
      onUploadNew();
      return;
    }
    const ok = window.confirm(
      'Start over? The current catalog will be cleared from this tab.',
    );
    if (ok) onUploadNew();
  };

  return (
    <header
      className="flex items-center justify-between px-10 py-5"
      style={{ borderBottom: '1px solid var(--color-hairline)' }}
    >
      <div className="flex items-baseline gap-6">
        <button
          type="button"
          onClick={onGoHome}
          disabled={!onGoHome}
          aria-label="Mise — back to home"
          title={onGoHome ? 'Back to home' : 'Mise'}
          className="font-display cursor-pointer"
          style={{
            fontWeight: 500,
            fontSize: 28,
            lineHeight: '32px',
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'var(--color-ink)',
            letterSpacing: '-0.01em',
            cursor: onGoHome ? 'pointer' : 'default',
          }}
        >
          Mise
        </button>
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
          onClick={handleUploadNew}
          className="caption cursor-pointer inline-flex items-center gap-2"
          style={{
            background: sampleMode ? 'var(--color-paper-tint)' : 'transparent',
            color: sampleMode ? 'var(--color-ink)' : 'var(--color-ink-muted)',
            border: `1px solid ${
              sampleMode ? 'var(--color-ink)' : 'var(--color-hairline)'
            }`,
            borderRadius: 'var(--radius-chip)',
            padding: '8px 14px',
            letterSpacing: '0.04em',
            fontWeight: sampleMode ? 500 : 400,
          }}
          title={
            sampleMode
              ? 'You are looking at the sample menu. Upload your own PDF or photo to run it against Opus 4.7.'
              : 'Start over with a fresh menu'
          }
        >
          <Upload size={13} strokeWidth={1.6} />
          {sampleMode ? 'Upload your menu' : 'New menu'}
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
