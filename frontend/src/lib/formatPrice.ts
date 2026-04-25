/**
 * Centralized price formatting for the entire UI.
 *
 * The same dish graph is used to demo Argentine bistros, Italian
 * pizzerias, US burger joints, Mexican taquerias, French brasseries — so
 * a "$" hardcoded for ARS is wrong half the time and a missing thousands
 * separator on `18500` is wrong everywhere. Two old copies of `formatPrice`
 * lived in TryIt + SourcePreviewModal with different shape and different
 * currency support; they are now both delegated to this single helper so
 * the catalog never disagrees with itself.
 *
 * Behavior:
 *   - Uses `Intl.NumberFormat('en')` for separators (thousands grouping,
 *     decimal). The displayed digit grouping stays consistent across the
 *     app regardless of the user's browser locale, which matters because
 *     the JSON contract is locale-neutral.
 *   - Currency-aware symbol: ISO 4217 codes get either a glyph (USD,
 *     EUR, GBP, JPY) or the code as a prefix (ARS, BRL, MXN, CLP, COP,
 *     PEN, UYU…). USD shows as `US$` to disambiguate from peso symbols.
 *   - Integer prices stay integer (no `.00`); decimals keep two places.
 *   - Robust to NaN, Infinity, negative, and missing inputs — empty
 *     string, never a stack trace.
 */

const SYMBOL_BY_CURRENCY: Readonly<Record<string, string>> = {
  USD: 'US$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  KRW: '₩',
  INR: '₹',
  CHF: 'CHF ',
  CAD: 'CA$',
  AUD: 'A$',
  NZD: 'NZ$',
  // Latin American pesos: keep the ISO prefix to avoid colliding with
  // each other and with USD. `$18.500` would be ambiguous to a US viewer
  // looking at an ARS catalog; `ARS 18,500` is unambiguous everywhere.
  ARS: 'ARS ',
  CLP: 'CLP ',
  COP: 'COP ',
  PEN: 'PEN ',
  UYU: 'UYU ',
  BRL: 'R$',
  MXN: 'MX$',
};

const NF_INTEGER = new Intl.NumberFormat('en', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const NF_DECIMAL = new Intl.NumberFormat('en', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  if (!Number.isFinite(value)) return '';
  const code = (currency ?? '').trim().toUpperCase();
  const formatted = Number.isInteger(value)
    ? NF_INTEGER.format(value)
    : NF_DECIMAL.format(value);
  if (!code) return formatted;
  const symbol = SYMBOL_BY_CURRENCY[code];
  if (symbol) {
    // CHF / ARS / etc. carry a trailing space in the lookup so the
    // glyph-style ones (US$, €, £) stay tight against the number while
    // the code-style ones (ARS, CLP) get readable spacing.
    return `${symbol}${formatted}`;
  }
  // Unknown ISO code: surface it verbatim so a downstream catalog that
  // exports an exotic currency (e.g. ZAR, NGN, KES) still shows a sane
  // string instead of a bare number.
  return `${code} ${formatted}`;
}

/**
 * Same shape as `formatPrice` but for modifier deltas where we want to
 * communicate the sign explicitly ("+US$3.00", "+€1.50"). A zero or
 * missing delta returns the empty string so callers can render nothing.
 */
export function formatPriceDelta(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  if (!Number.isFinite(value) || value === 0) return '';
  const sign = value > 0 ? '+' : '−';
  const abs = Math.abs(value);
  return `${sign}${formatPrice(abs, currency)}`;
}
