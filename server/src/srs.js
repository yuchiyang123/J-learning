import { db } from './db.js';

// Simple SRS shared by the flashcard 記得/不熟 buttons (/api/progress/review)
// and the vocabulary practice modes (/api/quiz/vocab-practice/submit):
// correct -> level + 1 and the next review pushed further out; wrong ->
// back to level 0.
const INTERVALS = [0, 1, 3, 7, 14, 30, 90]; // days by srs level

// Weight of the newest answer in avg_response_ms (exponential moving average).
export const RESPONSE_EMA_WEIGHT = 0.3;
const MAX_RESPONSE_MS = 10 * 60 * 1000;

// A usable response time, or null: a positive finite number of ms up to
// ten minutes (anything longer means the tab was left open, not thinking).
export function normalizeResponseMs(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > MAX_RESPONSE_MS) return null;
  return Math.round(n);
}

export function nextAverage(previousAvg, responseMs) {
  if (responseMs == null) return previousAvg ?? null;
  if (previousAvg == null) return responseMs;
  return Math.round(previousAvg * (1 - RESPONSE_EMA_WEIGHT) + responseMs * RESPONSE_EMA_WEIGHT);
}

// responseMs (optional): time from the item appearing to the answer. When
// null the timing columns are left as they are.
export function applyReview(userId, itemType, itemId, correct, responseMs = null) {
  const ms = normalizeResponseMs(responseMs);
  const existing = db
    .prepare('SELECT * FROM user_progress WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .get(userId, itemType, itemId);

  if (!existing) {
    const srsLevel = correct ? 1 : 0;
    db.prepare(
      `INSERT INTO user_progress (user_id, item_type, item_id, srs_level, correct_count, wrong_count, last_reviewed, next_review,
                                  last_response_ms, avg_response_ms)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+' || ? || ' days'), ?, ?)`
    ).run(userId, itemType, itemId, srsLevel, correct ? 1 : 0, correct ? 0 : 1, INTERVALS[srsLevel] ?? 90, ms, ms);
    return srsLevel;
  }
  const srsLevel = correct ? Math.min(existing.srs_level + 1, INTERVALS.length - 1) : 0;
  db.prepare(
    `UPDATE user_progress SET srs_level = ?, correct_count = correct_count + ?, wrong_count = wrong_count + ?,
     last_reviewed = datetime('now'), next_review = datetime('now', '+' || ? || ' days'),
     last_response_ms = COALESCE(?, last_response_ms), avg_response_ms = ?
     WHERE id = ?`
  ).run(srsLevel, correct ? 1 : 0, correct ? 0 : 1, INTERVALS[srsLevel] ?? 90, ms,
    nextAverage(existing.avg_response_ms, ms), existing.id);
  return srsLevel;
}

// Keeps the individual timed answer for the per-day chart (no-op without a time).
export function logResponse(userId, itemType, itemId, source, correct, responseMs) {
  const ms = normalizeResponseMs(responseMs);
  if (ms == null) return;
  db.prepare(
    'INSERT INTO review_log (user_id, item_type, item_id, source, is_correct, response_ms) VALUES (?,?,?,?,?,?)'
  ).run(userId, itemType, itemId, source, correct ? 1 : 0, ms);
}

// Daily average response time over the last `days` days, correct answers
// only, as [{ date: 'YYYY-MM-DD', avgMs, count }] for every day in the
// window (avgMs null on days with no timed correct answers). Days are the
// user's local days: tzOffsetMinutes is their offset from UTC.
export function dailyResponseTimes(userId, { days = 14, tzOffsetMinutes = 0 } = {}) {
  const shift = `${tzOffsetMinutes >= 0 ? '+' : ''}${tzOffsetMinutes} minutes`;
  const rows = db.prepare(
    `SELECT date(created_at, ?) AS day, AVG(response_ms) AS avgMs, COUNT(*) AS count
     FROM review_log
     WHERE user_id = ? AND is_correct = 1
       AND date(created_at, ?) > date('now', ?, ?)
     GROUP BY day`
  ).all(shift, userId, shift, shift, `-${days} days`);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = db.prepare('SELECT date(\'now\', ?, ?) AS d').get(shift, `-${i} days`).d;
    const r = byDay.get(day);
    out.push({ date: day, avgMs: r ? Math.round(r.avgMs) : null, count: r ? r.count : 0 });
  }
  return out;
}

// Which vocabulary-practice results count as a recognition review.
// JLPT N5 tests recognition — reading a word from its written form — so
// only practice that does exactly that moves the SRS schedule: typing or
// tiles answered from the kanji prompt. Production modes (meaning -> word,
// dictation) and the self-graded handwriting modes are still saved to
// history, but never touch srs_level / next_review.
// 'choice' (pick the right reading among confusable ones — the JLPT 漢字読み
// question format) is recognition too.
const AUTO_GRADED = new Set(['typing', 'tiles', 'choice']);
export function practiceUpdatesSrs(mode, prompt) {
  return AUTO_GRADED.has(mode) && prompt === 'kanji';
}

// ---------- 待考 (pending test) ----------
const PENDING_ITEM_TYPES = new Set(['word', 'custom_word']);
export const isPendingItemType = (t) => PENDING_ITEM_TYPES.has(t);

export function getPending(userId) {
  return db.prepare(
    'SELECT item_type AS itemType, item_id AS itemId FROM pending_tests WHERE user_id = ? ORDER BY created_at, item_id'
  ).all(userId);
}

export function setPending(userId, itemType, itemId, pending) {
  if (pending) {
    db.prepare('INSERT OR IGNORE INTO pending_tests (user_id, item_type, item_id) VALUES (?, ?, ?)').run(userId, itemType, itemId);
  } else {
    db.prepare('DELETE FROM pending_tests WHERE user_id = ? AND item_type = ? AND item_id = ?').run(userId, itemType, itemId);
  }
}

export function isPending(userId, itemType, itemId) {
  return !!db.prepare('SELECT 1 FROM pending_tests WHERE user_id = ? AND item_type = ? AND item_id = ?').get(userId, itemType, itemId);
}

// A 待考 word is settled by an objectively graded practice answer — typing
// or tiles, with any prompt: right -> 記得, wrong -> 不熟. The handwriting
// modes are self-graded, so they never settle one.
export function practiceSettlesPending(mode) {
  return AUTO_GRADED.has(mode);
}

// What `itemType` means for the due queue. 'vocab' is every vocabulary
// item: dictionary words and the user's own custom words (their SRS rows
// are 'word' / 'custom_word', shared by flashcards and practice).
const DUE_ITEM_TYPES = {
  vocab: ['word', 'custom_word'],
  word: ['word'],
  custom_word: ['custom_word'],
  kanji: ['kanji'],
};

export function isDueItemType(itemType) {
  return Object.hasOwn(DUE_ITEM_TYPES, itemType);
}

// Items whose next review has come (next_review <= now), oldest first —
// the order they should be studied in. `level` filters by the item's own
// JLPT level (dictionary word, custom word or kanji).
// With tzOffsetMinutes (the learner's UTC offset), due is by local day:
// everything scheduled for today counts from the start of the day, instead
// of trickling in at the clock time it was reviewed yesterday (a word
// reviewed at 20:40 would otherwise only come due at 20:40). Without it,
// due is by the exact timestamp.
export function getDueItems(userId, { itemType = 'vocab', level, tzOffsetMinutes } = {}) {
  const types = DUE_ITEM_TYPES[itemType];
  if (!types) throw new Error(`unknown itemType: ${itemType}`);
  const params = [userId, ...types];
  let sql = `
    SELECT p.item_type AS itemType, p.item_id AS itemId, p.next_review AS nextReview
    FROM user_progress p
    LEFT JOIN words w ON p.item_type = 'word' AND w.id = p.item_id
    LEFT JOIN user_words uw ON p.item_type = 'custom_word' AND uw.id = p.item_id AND uw.user_id = p.user_id
    LEFT JOIN kanji k ON p.item_type = 'kanji' AND k.id = p.item_id
    WHERE p.user_id = ?
      AND p.item_type IN (${types.map(() => '?').join(',')})
      AND p.next_review IS NOT NULL
      AND ${Number.isFinite(tzOffsetMinutes) ? "date(p.next_review, ?) <= date('now', ?)" : "p.next_review <= datetime('now')"}`;
  if (Number.isFinite(tzOffsetMinutes)) {
    const shift = `${tzOffsetMinutes >= 0 ? '+' : ''}${tzOffsetMinutes} minutes`;
    params.push(shift, shift);
  }
  if (level) {
    sql += ' AND COALESCE(w.level, uw.level, k.level) = ?';
    params.push(level);
  }
  sql += ' ORDER BY p.next_review ASC, p.id ASC';
  return db.prepare(sql).all(...params);
}
