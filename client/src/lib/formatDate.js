// SQLite's datetime('now') (used for every *_at/*_reviewed timestamp column)
// stores "YYYY-MM-DD HH:MM:SS" in UTC with no timezone marker. Rendering that
// string as-is shows raw UTC, which reads as "wrong by however many hours"
// to anyone not in UTC+0 (e.g. 8 hours off in UTC+8). Mark it UTC explicitly
// before handing it to Date, then format in the viewer's own local timezone.
// year/month/day + 12-hour time, no seconds — toLocaleString()'s default
// (which also includes seconds) is more precision than a quiz-history
// timestamp needs, and was the single biggest reason that column ran wide
// on narrow screens.
export function formatServerTimestamp(raw) {
  if (!raw) return '';
  const iso = `${raw.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
