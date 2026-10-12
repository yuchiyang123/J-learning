import { useMemo, useState } from 'react';
import { useLocale } from '../i18n/LocaleContext.jsx';

// Daily average response time (correct answers only) over the last N days:
// one series, so no legend — the heading names it. Line 2px in the skin's
// accent with a 10% wash under it, 8px markers with a surface ring,
// hairline solid gridlines, clean second ticks, only the latest value
// labelled directly; hovering a day shows a crosshair + tooltip, and the
// same numbers are available as a table. Days without data break the line
// rather than being drawn as zero.
const W = 640;
const H = 220;
const PAD = { top: 22, right: 56, bottom: 30, left: 44 };

function niceStep(max) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
const sec = (ms) => (ms / 1000).toFixed(ms < 10000 ? 1 : 0);

export default function ResponseTimeChart({ data }) {
  const { t } = useLocale();
  const [hover, setHover] = useState(null);

  const geo = useMemo(() => {
    const values = data.map((d) => d.avgMs).filter((v) => v != null);
    const maxV = Math.max(1000, ...values);
    const step = niceStep(maxV);
    const top = Math.ceil(maxV / step) * step;
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
    const y = (v) => PAD.top + ih - (v / top) * ih;
    const ticks = [];
    for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
    // Contiguous runs of days with data -> separate line segments.
    const runs = [];
    let run = [];
    data.forEach((d, i) => {
      if (d.avgMs == null) { if (run.length) runs.push(run); run = []; } else run.push(i);
    });
    if (run.length) runs.push(run);
    let lastIdx = -1;
    data.forEach((d, i) => { if (d.avgMs != null) lastIdx = i; });
    return { x, y, ticks, runs, lastIdx, baseY: PAD.top + ih, step };
  }, [data]);

  const hasData = geo.lastIdx !== -1;
  const label = (d) => d.date.slice(5).replace('-', '/');

  return (
    <figure className="rt-chart">
      {!hasData && <p className="muted rt-empty">{t('progress_rt_empty')}</p>}
      {hasData && (
        <div className="rt-plot">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('progress_rt_title')} onMouseLeave={() => setHover(null)}>
            {geo.ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(v)} y2={geo.y(v)} className="rt-grid" />
                <text x={PAD.left - 8} y={geo.y(v)} className="rt-tick" textAnchor="end" dominantBaseline="middle">
                  {geo.step >= 1000 ? v / 1000 : sec(v)}{v === geo.ticks[geo.ticks.length - 1] ? ` ${t('progress_rt_unit')}` : ''}
                </text>
              </g>
            ))}
            {data.map((d, i) => (i % 2 === (data.length - 1) % 2 ? (
              <text key={d.date} x={geo.x(i)} y={H - 8} className="rt-tick" textAnchor="middle">{label(d)}</text>
            ) : null))}

            {geo.runs.map((r) => (
              <g key={r[0]}>
                {r.length > 1 && (
                  <path
                    className="rt-area"
                    d={`M${geo.x(r[0])},${geo.baseY} ${r.map((i) => `L${geo.x(i)},${geo.y(data[i].avgMs)}`).join(' ')} L${geo.x(r[r.length - 1])},${geo.baseY}Z`}
                  />
                )}
                {r.length > 1 && <polyline className="rt-line" points={r.map((i) => `${geo.x(i)},${geo.y(data[i].avgMs)}`).join(' ')} />}
              </g>
            ))}

            {hover != null && <line className="rt-cross" x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={geo.baseY} />}

            {data.map((d, i) => (d.avgMs == null ? null : (
              <circle key={d.date} className={`rt-dot${hover === i ? ' is-hover' : ''}`} cx={geo.x(i)} cy={geo.y(d.avgMs)} r={hover === i ? 5.5 : 4} />
            )))}

            <text x={geo.x(geo.lastIdx) + 10} y={geo.y(data[geo.lastIdx].avgMs)} className="rt-endlabel" dominantBaseline="middle">
              {sec(data[geo.lastIdx].avgMs)} {t('progress_rt_unit')}
            </text>

            {/* Hit areas: a full-height band per day, much bigger than the dot. */}
            {data.map((d, i) => {
              const half = (W - PAD.left - PAD.right) / Math.max(data.length - 1, 1) / 2;
              return (
                <rect
                  key={d.date}
                  x={geo.x(i) - half}
                  y={PAD.top}
                  width={half * 2}
                  height={geo.baseY - PAD.top}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                />
              );
            })}
          </svg>
          {hover != null && (
            <div
              className="rt-tooltip"
              style={{ left: `${(geo.x(hover) / W) * 100}%`, top: `${((data[hover].avgMs != null ? geo.y(data[hover].avgMs) : geo.baseY) / H) * 100}%` }}
            >
              <strong>{data[hover].date}</strong>
              <span>
                {data[hover].avgMs != null
                  ? t('progress_rt_tooltip', { sec: sec(data[hover].avgMs), count: data[hover].count })
                  : t('progress_rt_no_answers')}
              </span>
            </div>
          )}
        </div>
      )}
      {hasData && (
        <details className="rt-table">
          <summary>{t('progress_rt_table')}</summary>
          <table>
            <thead>
              <tr><th>{t('progress_rt_col_date')}</th><th>{t('progress_rt_col_avg')}</th><th>{t('progress_rt_col_count')}</th></tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.avgMs != null ? `${sec(d.avgMs)} ${t('progress_rt_unit')}` : '—'}</td>
                  <td>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
