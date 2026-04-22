import { Confidence } from './Confidence';

interface Props {
  value: number;
  width?: number | string;
}

/**
 * Thin horizontal bar + numeric readout.
 *
 * Mapped to the Editorial/Cartographic tokens already defined in
 * styles/index.css — olive (≥0.85), ochre (0.60-0.84), sienna (<0.60).
 * No new colors; stays within the locked palette.
 */
export function ConfidenceBar({ value, width = '100%' }: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  const color =
    clamped >= 0.85
      ? 'var(--color-olive)'
      : clamped >= 0.6
        ? 'var(--color-ochre)'
        : 'var(--color-sienna)';
  const trackColor = 'var(--color-hairline)';
  return (
    <div className="flex items-center gap-2" style={{ width }}>
      <div
        className="relative"
        style={{
          flex: 1,
          height: 3,
          background: trackColor,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clamped * 100}%`,
            height: '100%',
            background: color,
            transition: 'width 320ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
        />
      </div>
      <Confidence value={clamped} />
    </div>
  );
}
