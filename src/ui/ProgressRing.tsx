/** Anneau de progression (ex. séances faites cette semaine). */
export function ProgressRing({ value, max, size = 64 }: { value: number; max: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - ratio)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="ring-value"
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="ring-text">
        {value}/{max}
      </text>
    </svg>
  );
}
