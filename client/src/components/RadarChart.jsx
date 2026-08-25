import { useState } from 'react';

const SIZE = 280;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE / 2 - 46; // leaves room for axis labels outside the grid
const RINGS = [0.25, 0.5, 0.75, 1];

function pointAt(index, count, fraction) {
  const angle = (-90 + (360 / count) * index) * (Math.PI / 180);
  return {
    x: CENTER + Math.cos(angle) * MAX_RADIUS * fraction,
    y: CENTER + Math.sin(angle) * MAX_RADIUS * fraction,
  };
}

// A single-series radar/hexagon chart: one polygon (the learner's accuracy
// per practice category), so per dataviz convention it needs no legend box —
// the chart title already says what's plotted. Every value is also shown as
// a bar in CategoryBarChart alongside it, so nothing here is gated behind
// hover — the tooltip is a convenience, not the only way to read a number.
export default function RadarChart({ axes }) {
  const [hovered, setHovered] = useState(null);
  const count = axes.length;

  const gridRings = RINGS.map((fraction) => {
    const pts = axes.map((_, i) => pointAt(i, count, fraction));
    return pts.map((p) => `${p.x},${p.y}`).join(' ');
  });

  const dataPoints = axes.map((a, i) => pointAt(i, count, Math.max(0, Math.min(100, a.value ?? 0)) / 100));
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="radar-chart-wrap">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="radar-chart" role="img" aria-label={axes.map((a) => `${a.label} ${a.value ?? 0}%`).join(', ')}>
        {gridRings.map((points, i) => (
          <polygon key={i} points={points} className="radar-grid-ring" />
        ))}
        {axes.map((_, i) => {
          const outer = pointAt(i, count, 1);
          return <line key={i} x1={CENTER} y1={CENTER} x2={outer.x} y2={outer.y} className="radar-grid-spoke" />;
        })}

        <polygon points={dataPath} className="radar-data-fill" />
        <polygon points={dataPath} className="radar-data-stroke" />

        {axes.map((a, i) => {
          const p = dataPoints[i];
          return (
            <g key={a.type}>
              <circle
                cx={p.x} cy={p.y} r={12}
                className="radar-hit-area"
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
              />
              <circle cx={p.x} cy={p.y} r={4} className="radar-data-dot" />
            </g>
          );
        })}

        {axes.map((a, i) => {
          const labelPoint = pointAt(i, count, 1.22);
          const anchor = Math.abs(labelPoint.x - CENTER) < 4 ? 'middle' : labelPoint.x > CENTER ? 'start' : 'end';
          return (
            <text key={a.type} x={labelPoint.x} y={labelPoint.y} textAnchor={anchor} dominantBaseline="middle" className="radar-axis-label">
              {a.label}
            </text>
          );
        })}
      </svg>

      {hovered !== null && (
        <div
          className="radar-tooltip"
          style={{ left: `${(dataPoints[hovered].x / SIZE) * 100}%`, top: `${(dataPoints[hovered].y / SIZE) * 100}%` }}
        >
          <strong>{axes[hovered].value ?? '—'}{axes[hovered].value != null ? '%' : ''}</strong>
          <span>{axes[hovered].label}</span>
        </div>
      )}
    </div>
  );
}
