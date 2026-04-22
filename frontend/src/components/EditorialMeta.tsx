import type { CockpitState } from '../domain/types';

interface Props {
  state: CockpitState;
}

/**
 * One-line editorial meta: Instrument Serif italic, shows run stats.
 *
 *   Reviewing 40 dishes across 4 sources · 23 Opus 4.7 calls · 46% cache hit · USD 0.96
 *
 * Hidden when there is no metrics_preview (first mock render). No ornament.
 */
export function EditorialMeta({ state }: Props) {
  const metrics = state.metrics_preview;
  if (!metrics) return null;

  const dishCount = state.canonical_dishes.length;
  const sourceCount = state.sources.length;

  const parts: string[] = [
    `Reviewing ${dishCount} dish${dishCount === 1 ? '' : 'es'} across ${sourceCount} source${sourceCount === 1 ? '' : 's'}`,
  ];
  if (metrics.time_to_review_pack_seconds != null) {
    parts.push(`review pack in ${metrics.time_to_review_pack_seconds.toFixed(1)}s`);
  }
  if (state.processing.adaptive_thinking_pairs > 0) {
    parts.push(
      `adaptive thinking on ${state.processing.adaptive_thinking_pairs} pair${state.processing.adaptive_thinking_pairs === 1 ? '' : 's'}`,
    );
  }

  return (
    <p
      className="font-accent"
      style={{
        fontStyle: 'italic',
        fontSize: 18,
        lineHeight: '26px',
        color: 'var(--color-ink-muted)',
      }}
    >
      {parts.join(' · ')}
    </p>
  );
}
