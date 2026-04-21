import type { DecisionSummary as DS } from '../domain/types';

interface Props {
  decision: DS;
  aliasItalic?: string;
}

/**
 * Renders the decision summary with the lead word in Instrument Serif italic.
 * Optionally italicizes a dish alias (e.g. *Marghertia*) inside the text.
 */
export function DecisionSummaryBlock({ decision, aliasItalic }: Props) {
  const text = decision.text;
  const lead = decision.lead_word;
  // Strip the lead word if it starts the text — we render it separately.
  const rest = text.startsWith(lead)
    ? text.slice(lead.length).replace(/^\s+/, ' ')
    : text;

  const withAliasItalic = (body: string) => {
    if (!aliasItalic) return body;
    const idx = body.indexOf(aliasItalic);
    if (idx === -1) return body;
    return (
      <>
        {body.slice(0, idx)}
        <em className="font-accent not-italic" style={{ fontStyle: 'italic' }}>
          {aliasItalic}
        </em>
        {body.slice(idx + aliasItalic.length)}
      </>
    );
  };

  return (
    <p
      className="text-[16px] leading-[24px]"
      style={{ maxWidth: '56ch', color: 'var(--color-ink)' }}
    >
      <span className="font-accent italic" style={{ color: 'var(--color-ink)' }}>
        {lead}
      </span>
      <span>{withAliasItalic(rest)}</span>
    </p>
  );
}
