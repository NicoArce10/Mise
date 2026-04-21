interface Props {
  value: number;
}

export function Confidence({ value }: Props) {
  const color =
    value >= 0.9
      ? 'var(--color-gold-leaf)'
      : value < 0.7
        ? 'var(--color-sienna)'
        : 'var(--color-ink)';
  return (
    <span
      className="font-mono text-[13px] leading-5 tabular-nums"
      style={{ color, fontVariantNumeric: 'tabular-nums' }}
    >
      {value.toFixed(2)}
    </span>
  );
}
