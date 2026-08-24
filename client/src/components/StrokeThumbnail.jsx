// Renders a small static preview of previously-captured pen strokes (plain
// {x,y} point arrays, as stored in quiz_results.detail[].strokes) — used to
// show "what did I actually write" in the handwriting quiz's own result
// screen and in the Progress page's quiz history detail.
export default function StrokeThumbnail({ strokes, size = 96, viewBox = 420 }) {
  if (!strokes || strokes.length === 0) return null;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${viewBox} ${viewBox}`} className="stroke-thumbnail">
      <rect x="1" y="1" width={viewBox - 2} height={viewBox - 2} className="stroke-thumbnail-bg" />
      {strokes.map((stroke, i) => (
        <polyline
          key={i}
          points={stroke.map((p) => `${p.x},${p.y}`).join(' ')}
          className="stroke-thumbnail-ink"
          strokeWidth={viewBox * 0.024}
        />
      ))}
    </svg>
  );
}
