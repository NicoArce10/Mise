import { Filter } from 'lucide-react';

import type { ExcludedItem } from '../domain/types';

interface Props {
  items: ExcludedItem[] | null | undefined;
  // Surface the original instruction so reviewers reading just this
  // section have the full context (the FilterAppliedBanner above shows
  // it too, but we want each block to stand on its own at a glance).
  instructions?: string | null;
}

/**
 * Receipt of every dish Opus 4.7 dropped because it matched the
 * reviewer's natural-language filter. Renders nothing when no filter
 * fired or when the filter excluded zero items — the empty state would
 * be indistinguishable from "filter not honored", which is exactly the
 * confusion this section exists to prevent.
 *
 * Items can come from either filter pass:
 * - First pass (in-prompt HARD FILTER during extraction): name only.
 * - Second pass (post-extraction keep/drop classifier): name + reason.
 *
 * When `reason` is missing we show a generic caption tied to the
 * instruction so the user still has *some* anchor for why a dish that
 * is printed on the menu is not in the catalog.
 */
export function ExcludedByUserFilter({ items, instructions }: Props) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return null;

  const trimmedInstruction = (instructions ?? '').trim();
  const fallbackReason = trimmedInstruction
    ? `Matched filter: "${trimmedInstruction}"`
    : 'Matched user filter';

  return (
    <section
      aria-label="Dishes excluded by the user filter"
      className="flex flex-col"
      style={{
        background: 'var(--color-paper-tint)',
        border: '1px solid var(--color-hairline)',
        borderLeft: '3px solid var(--color-sienna, var(--color-ink))',
        borderRadius: 'var(--radius-card)',
        padding: 18,
        gap: 14,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="font-mono inline-flex items-center gap-1.5"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-subtle)',
          }}
        >
          <Filter size={11} strokeWidth={1.8} />
          Excluded by user filter
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--color-ink-subtle)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {list.length} dish{list.length === 1 ? '' : 'es'} dropped
        </span>
      </div>

      <ul
        className="flex flex-col"
        style={{ margin: 0, padding: 0, listStyle: 'none', gap: 8 }}
      >
        {list.map((item, idx) => {
          const reason = (item.reason ?? '').trim();
          return (
            <li
              key={`${item.name}-${idx}`}
              className="flex items-baseline justify-between gap-4"
              style={{
                paddingTop: idx === 0 ? 0 : 8,
                borderTop:
                  idx === 0 ? 'none' : '1px solid var(--color-hairline)',
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  lineHeight: '20px',
                  color: 'var(--color-ink)',
                  fontWeight: 500,
                  textDecoration: 'line-through',
                  textDecorationColor: 'var(--color-ink-subtle)',
                }}
              >
                {item.name}
              </span>
              <span
                style={{
                  fontSize: 12,
                  lineHeight: '18px',
                  color: 'var(--color-ink-subtle)',
                  textAlign: 'right',
                  fontStyle: reason ? 'normal' : 'italic',
                  maxWidth: '60%',
                }}
              >
                {reason || fallbackReason}
              </span>
            </li>
          );
        })}
      </ul>

      <p
        style={{
          fontSize: 12,
          lineHeight: '16px',
          color: 'var(--color-ink-subtle)',
          margin: 0,
        }}
      >
        These dishes appear printed on the menu but were withheld from the
        catalog and the exported JSON. They also live under
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            color: 'var(--color-ink-muted)',
            margin: '0 4px',
          }}
        >
          excluded_by_user_filter
        </span>
        in the export so a downstream auditor can verify the receipt.
      </p>
    </section>
  );
}
