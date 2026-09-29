// 判子 — a vermilion seal stamp, the site's mark. Fill comes from
// currentColor so the same component reads as ink-on-paper in the header
// and as a faint watermark elsewhere. Slightly tilted, the way a real
// stamp never lands perfectly square.
export default function HankoSeal({ char = '学', size = 28, className = '', tilt = -4 }) {
  return (
    <svg
      className={`hanko ${className}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <rect x="3" y="3" width="42" height="42" rx="4" fill="currentColor" />
      <rect x="7.5" y="7.5" width="33" height="33" rx="2" fill="none" stroke="var(--seal-paper, #f4efe4)" strokeWidth="1.5" opacity="0.7" />
      <text
        x="24"
        y="35"
        textAnchor="middle"
        fontFamily="'Shippori Mincho', 'Noto Serif JP', serif"
        fontSize="27"
        fontWeight="700"
        fill="var(--seal-paper, #f4efe4)"
      >
        {char}
      </text>
    </svg>
  );
}
