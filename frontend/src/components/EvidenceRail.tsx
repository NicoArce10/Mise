import type { SourceDocument, SourceKind } from '../domain/types';
import { FileText, Image as ImageIcon, Instagram, ScrollText } from 'lucide-react';

const icons: Record<SourceKind, typeof FileText> = {
  pdf: FileText,
  photo: ImageIcon,
  board: ScrollText,
  post: Instagram,
};

interface Props {
  sources: SourceDocument[];
}

export function EvidenceRail({ sources }: Props) {
  return (
    <aside
      className="flex flex-col gap-4 px-6 py-10"
      style={{ borderRight: '1px solid var(--color-hairline)' }}
    >
      <div
        className="caption"
        style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
      >
        Evidence
      </div>
      {sources.map(src => {
        const Icon = icons[src.kind];
        return (
          <div
            key={src.id}
            className="flex items-start gap-3"
            style={{
              background: 'var(--color-paper-tint)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-input)',
              padding: 12,
            }}
          >
            <Icon size={18} strokeWidth={1.5} color="var(--color-ink-muted)" />
            <div className="flex flex-col gap-1">
              <span
                className="caption"
                style={{
                  color: 'var(--color-ink-subtle)',
                  letterSpacing: '0.04em',
                }}
              >
                {src.kind.toUpperCase()}
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 13, lineHeight: '18px', color: 'var(--color-ink)' }}
              >
                {src.filename}
              </span>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
