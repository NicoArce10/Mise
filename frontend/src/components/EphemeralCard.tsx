import type { EphemeralItem, SourceDocument } from '../domain/types';
import { Chip } from './Chip';
import { ConfidenceBar } from './ConfidenceBar';
import { DecisionSummaryBlock } from './DecisionSummary';
import { SourceArrow } from './SourceArrow';
import { ActionBar } from './ActionBar';

interface Props {
  item: EphemeralItem;
  sources: SourceDocument[];
  onModerate: (status: 'approved' | 'edited' | 'rejected') => void;
}

export function EphemeralCard({ item, sources, onModerate }: Props) {
  const bySource = new Map(sources.map(s => [s.id, s]));
  const provenance = item.source_ids
    .map(id => bySource.get(id))
    .filter((s): s is SourceDocument => Boolean(s));

  return (
    <article
      className="flex flex-col gap-4"
      style={{
        background: 'var(--color-paper-tint)',
        border: '1px dashed var(--color-ochre)',
        borderRadius: 'var(--radius-card)',
        padding: 24,
      }}
    >
      <header className="flex items-start justify-between gap-4">
        <h3
          className="font-display"
          style={{ fontWeight: 500, fontSize: 28, lineHeight: '32px' }}
        >
          {item.text}
        </h3>
        <Chip variant="ephemeral">Ephemeral</Chip>
      </header>

      <div className="flex flex-wrap gap-3">
        {provenance.map(src => (
          <SourceArrow key={src.id} source={src} />
        ))}
      </div>

      <DecisionSummaryBlock decision={item.decision} />

      <div
        className="flex flex-col gap-3 pt-3"
        style={{ borderTop: '1px solid var(--color-hairline)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="caption"
            style={{ color: 'var(--color-ink-subtle)', minWidth: 88 }}
          >
            Confidence
          </span>
          <ConfidenceBar value={item.decision.confidence} />
        </div>
        <div className="flex items-center justify-end">
          <ActionBar moderation={item.moderation} onModerate={onModerate} />
        </div>
      </div>
    </article>
  );
}
