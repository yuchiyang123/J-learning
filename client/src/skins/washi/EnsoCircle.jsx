// 円相 — the single-brush-stroke zen circle. Drawn in on mount via a
// stroke-dashoffset sweep so it "gets painted" rather than just appearing.
// Two overlapping strokes of different weight and opacity fake the way a
// loaded brush thins as it runs out of ink toward the open end.
export default function EnsoCircle({ size = 220, className = '' }) {
  return (
    <svg
      className={`enso ${className}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="enso-stroke enso-stroke-heavy"
        d="M132 34c-38-16-86 8-96 50-9 39 14 78 52 86 40 9 78-19 84-60 3-22-6-42-20-56"
        strokeLinecap="round"
      />
      <path
        className="enso-stroke enso-stroke-light"
        d="M128 40c-34-13-76 8-85 46-8 34 12 68 46 76 36 8 70-17 75-54 2-19-5-36-17-49"
        strokeLinecap="round"
      />
    </svg>
  );
}
