// The brand as a lit sign: Japanese name in the display face with a pink
// tube glow, and a small cyan "TOKYO NIGHT" tag under it.
export default function NeonLogo({ name, tag = 'Tokyo Night' }) {
  return (
    <span className="neon-logo-wrap">
      <span className="neon-logo" lang="ja">{name}</span>
      <span className="neon-logo-tag">{tag}</span>
    </span>
  );
}
