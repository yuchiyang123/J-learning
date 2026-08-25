// Six fixed 0–100% ratios (one per practice category), so each row is
// styled as a meter — an accent fill on a lighter track of the same ramp —
// rather than a generic categorical bar chart, since there's no series
// identity to encode, just one measure (accuracy) per category. Every value
// is a direct label (not hidden behind hover), which also doubles as the
// "table view" for RadarChart's data alongside it.
export default function CategoryBarChart({ axes, noDataLabel }) {
  return (
    <ul className="category-bars">
      {axes.map((a) => (
        <li key={a.type} className="category-bar-row">
          <span className="category-bar-label">{a.label}</span>
          <div className="category-bar-track">
            <div className="category-bar-fill" style={{ width: `${Math.max(0, Math.min(100, a.value ?? 0))}%` }} />
          </div>
          <span className="category-bar-value">{a.value != null ? `${a.value}%` : noDataLabel}</span>
        </li>
      ))}
    </ul>
  );
}
