import type { SourceDocument, SourceKind } from '../domain/types';

const label: Record<SourceKind, string> = {
  pdf: 'PDF',
  photo: 'PHOTO',
  post: 'POST',
  board: 'BOARD',
};

interface Props {
  source: SourceDocument;
}

export function SourceArrow({ source }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono"
      style={{
        fontSize: 13,
        lineHeight: '20px',
        color: 'var(--color-ink-muted)',
      }}
    >
      <span
        className="caption"
        style={{
          background: 'var(--color-paper-deep)',
          color: 'var(--color-ink)',
          padding: '2px 6px',
          borderRadius: 'var(--radius-chip)',
          letterSpacing: '0.04em',
          fontSize: 10,
        }}
      >
        {label[source.kind]}
      </span>
      <span aria-hidden style={{ color: 'var(--color-ink-subtle)' }}>
        →
      </span>
      <span className="truncate max-w-[180px]">{source.filename}</span>
    </span>
  );
}
