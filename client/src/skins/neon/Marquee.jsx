// Station-display ticker. The item list is rendered twice back to back so a
// -50% translate loops seamlessly. Every other phrase is "lit" in a cycling
// neon color; pauses on hover; static under prefers-reduced-motion.
const COLORS = ['var(--pink)', 'var(--cyan)', 'var(--yellow)', 'var(--green)', 'var(--purple)', 'var(--orange)'];

export default function Marquee({ items }) {
  const row = (keyPrefix) =>
    items.map((text, i) => (
      <span className="marquee-item" key={`${keyPrefix}-${i}`} style={{ '--c': COLORS[i % COLORS.length] }} lang="ja">
        <span className={i % 2 === 0 ? 'lit' : ''}>{text}</span>
        <span className="dot" aria-hidden="true">◆</span>
      </span>
    ));
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {row('a')}
        {row('b')}
      </div>
    </div>
  );
}
