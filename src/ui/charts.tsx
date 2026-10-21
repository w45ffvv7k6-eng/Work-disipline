import { useState, type ReactNode } from 'react';

// Petits graphiques en SVG (une seule série, à la couleur de l'appli).
// Ils s'affichent toujours, même sans données : axes et grille vides avec un message.

const W = 340;
const H = 170;
const PAD = { top: 12, right: 8, bottom: 24, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Haut de l'axe arrondi (1, 2, 5, 10, 20, 50…) et 3 graduations. */
export function niceScale(max: number, fallback: number): number[] {
  const top = max > 0 ? max : fallback;
  const magnitude = 10 ** Math.floor(Math.log10(top));
  const step = [0.5, 1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s * 3 >= top) ?? magnitude * 10;
  return [0, step, step * 2, step * 3].map((v) => Math.round(v * 1000) / 1000);
}

function Frame({
  ticks,
  base = 0,
  format,
  label,
  empty,
  children,
}: {
  ticks: number[];
  /** Valeur du bas de l'axe (0 par défaut). */
  base?: number;
  format: (v: number) => string;
  label: string;
  empty?: string;
  children: ReactNode;
}) {
  const top = ticks[ticks.length - 1];
  return (
    <div className="chart-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((tick) => {
          const y = PAD.top + PLOT_H - ((tick - base) / (top - base || 1)) * PLOT_H;
          return (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className={tick === base ? 'axis' : 'grid'} />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="tick">
                {format(tick)}
              </text>
            </g>
          );
        })}
        {children}
      </svg>
      {empty && <div className="chart-empty">{empty}</div>}
    </div>
  );
}

export interface Bar {
  label: string;
  value: number;
  /** Texte affiché quand la barre est touchée (« Semaine du 13 oct. : 3 séances »). */
  detail: string;
}

/** Barres verticales (ex. séances par semaine). La dernière barre est sélectionnée au départ. */
export function BarChart({
  bars,
  format,
  fallbackMax,
  title,
  empty,
}: {
  bars: Bar[];
  format: (v: number) => string;
  fallbackMax: number;
  title: string;
  empty: string;
}) {
  const [selected, setSelected] = useState(bars.length - 1);
  const ticks = niceScale(Math.max(...bars.map((b) => b.value)), fallbackMax);
  const top = ticks[ticks.length - 1];
  const band = PLOT_W / bars.length;
  const barW = Math.min(26, band * 0.56);
  const isEmpty = bars.every((b) => b.value === 0);
  const current = bars[selected];

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div className="chart-title">{title}</div>
        <div className="chart-value">{current?.detail}</div>
      </div>
      <Frame
        ticks={ticks}
        format={format}
        label={`${title}. ${current?.detail ?? ''}`}
        empty={isEmpty ? empty : undefined}
      >
        {bars.map((bar, i) => {
          const x = PAD.left + band * i + (band - barW) / 2;
          const h = Math.max(bar.value > 0 ? 3 : 2, (bar.value / top) * PLOT_H);
          const y = PAD.top + PLOT_H - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={i} onClick={() => setSelected(i)} className={`bar${i === selected ? ' selected' : ''}`}>
              {/* Zone touchable plus grande que la barre. */}
              <rect x={PAD.left + band * i} y={PAD.top} width={band} height={PLOT_H + PAD.bottom} fill="transparent" />
              <path
                className={bar.value > 0 ? 'bar-fill' : 'bar-zero'}
                d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
              />
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="tick">
                {bar.label}
              </text>
            </g>
          );
        })}
      </Frame>
    </div>
  );
}

export interface Point {
  date: number;
  value: number;
}

/** Courbe dans le temps (ex. poids de corps, charge max). Le dernier point est sélectionné au départ. */
export function LineChart({
  points,
  format,
  formatDate,
  fallbackMax,
  title,
  empty,
}: {
  points: Point[];
  format: (v: number) => string;
  formatDate: (date: number) => string;
  fallbackMax: number;
  title: string;
  empty: string;
}) {
  const [selected, setSelected] = useState(points.length - 1);
  const values = points.map((p) => p.value);
  // Axe qui part du bas des valeurs (un poids de 75 kg ne commence pas à 0).
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const base = values.length > 0 ? Math.max(0, Math.floor((min - (max - min) * 0.3 - 1) / 5) * 5) : 0;
  const ticks = niceScale(max - base, fallbackMax).map((tick) => tick + base);
  const top = ticks[ticks.length - 1];
  const t0 = points[0]?.date ?? 0;
  const t1 = points[points.length - 1]?.date ?? 1;
  const xOf = (date: number) =>
    points.length < 2 ? PAD.left + PLOT_W / 2 : PAD.left + ((date - t0) / (t1 - t0 || 1)) * PLOT_W;
  const yOf = (value: number) => PAD.top + PLOT_H - ((value - base) / (top - base || 1)) * PLOT_H;
  const current = points[selected];
  const detail = current ? `${formatDate(current.date)} : ${format(current.value)}` : '';

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div className="chart-title">{title}</div>
        <div className="chart-value">{detail}</div>
      </div>
      <Frame
        ticks={ticks}
        base={base}
        format={format}
        label={`${title}. ${detail}`}
        empty={points.length === 0 ? empty : undefined}
      >
        {points.length > 1 && (
          <polyline className="line" points={points.map((p) => `${xOf(p.date)},${yOf(p.value)}`).join(' ')} />
        )}
        {points.map((p, i) => (
          <g key={i} onClick={() => setSelected(i)}>
            <circle cx={xOf(p.date)} cy={yOf(p.value)} r={16} fill="transparent" />
            <circle
              className={`dot${i === selected ? ' selected' : ''}`}
              cx={xOf(p.date)}
              cy={yOf(p.value)}
              r={i === selected ? 5 : 3.5}
            />
          </g>
        ))}
        {points.length > 0 && (
          <>
            <text x={PAD.left} y={H - 8} textAnchor="start" className="tick">
              {formatDate(t0)}
            </text>
            {points.length > 1 && (
              <text x={W - PAD.right} y={H - 8} textAnchor="end" className="tick">
                {formatDate(t1)}
              </text>
            )}
          </>
        )}
      </Frame>
    </div>
  );
}
