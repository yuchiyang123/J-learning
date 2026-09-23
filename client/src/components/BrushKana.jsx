import kanaStrokes from '../data/kanaStrokes.json';

// Writes a kana the way a hand does: each real stroke (from the same
// stroke-order data the handwriting practice uses) is drawn in sequence
// with a dash-offset sweep. pathLength="1" normalizes every stroke so the
// CSS animation needs no measuring. Two copies per stroke — a wide, faint
// one under a narrow dark one — read as a loaded brush rather than a line.
const VIEWBOX = 109;

export function hasStrokes(char) {
  return Boolean(kanaStrokes[char]);
}

export default function BrushKana({ char, size = 120, delay = 0, stepMs = 380, animate = true, className = '' }) {
  const data = kanaStrokes[char];
  if (!data) {
    return (
      <span className={`brush-fallback ${className}`} style={{ fontSize: size * 0.82, width: size, height: size }} lang="ja">
        {char}
      </span>
    );
  }
  return (
    <svg
      className={`brush-kana${animate ? '' : ' is-static'} ${className}`}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      {data.paths.map((d, i) => {
        const style = { animationDelay: `${delay + i * stepMs}ms` };
        return (
          <g key={i}>
            <path d={d} pathLength="1" className="brush-stroke brush-stroke-soft" style={style} />
            <path d={d} pathLength="1" className="brush-stroke" style={style} />
          </g>
        );
      })}
    </svg>
  );
}

// Total time the writing takes, so callers can sequence what follows.
export function brushDuration(char, stepMs = 380) {
  const n = kanaStrokes[char]?.paths.length ?? 1;
  return n * stepMs + 420;
}
