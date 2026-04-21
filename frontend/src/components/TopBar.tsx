interface Props {
  adaptivePairs: number;
  onPresent: () => void;
  onRestart: () => void;
}

export function TopBar({ adaptivePairs, onPresent, onRestart }: Props) {
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
          Trust layer · dish-level menu data
        </span>
      </div>
      <div className="flex items-center gap-6">
        <span
          className="font-mono"
          style={{ fontSize: 13, lineHeight: '20px', color: 'var(--color-ink-muted)' }}
        >
          Adaptive thinking on {adaptivePairs} pair{adaptivePairs === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onRestart}
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
          New batch
        </button>
        <button
          type="button"
          onClick={onPresent}
          className="caption cursor-pointer"
          style={{
            background: 'var(--color-ink)',
            color: 'var(--color-paper)',
            border: '1px solid var(--color-ink)',
            borderRadius: 'var(--radius-chip)',
            padding: '8px 14px',
            letterSpacing: '0.04em',
          }}
        >
          Present
        </button>
      </div>
    </header>
  );
}
