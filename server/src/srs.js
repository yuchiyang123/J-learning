import { db } from './db.js';

// Simple SRS shared by the flashcard 記得/不熟 buttons (/api/progress/review)
// and the vocabulary practice modes (/api/quiz/vocab-practice/submit):
// correct -> level + 1 and the next review pushed further out; wrong ->
// back to level 0.
const INTERVALS = [0, 1, 3, 7, 14, 30, 90]; // days by srs level

export function applyReview(userId, itemType, itemId, correct) {
  const existing = db
    .prepare('SELECT * FROM user_progress WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .get(userId, itemType, itemId);

  if (!existing) {
    const srsLevel = correct ? 1 : 0;
    db.prepare(
      `INSERT INTO user_progress (user_id, item_type, item_id, srs_level, correct_count, wrong_count, last_reviewed, next_review)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+' || ? || ' days'))`
    ).run(userId, itemType, itemId, srsLevel, correct ? 1 : 0, correct ? 0 : 1, INTERVALS[srsLevel] ?? 90);
    return srsLevel;
  }
  const srsLevel = correct ? Math.min(existing.srs_level + 1, INTERVALS.length - 1) : 0;
  db.prepare(
    `UPDATE user_progress SET srs_level = ?, correct_count = correct_count + ?, wrong_count = wrong_count + ?,
     last_reviewed = datetime('now'), next_review = datetime('now', '+' || ? || ' days')
     WHERE id = ?`
  ).run(srsLevel, correct ? 1 : 0, correct ? 0 : 1, INTERVALS[srsLevel] ?? 90, existing.id);
  return srsLevel;
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
export function getDueItems(userId, { itemType = 'vocab', level } = {}) {
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
      AND p.next_review <= datetime('now')`;
  if (level) {
    sql += ' AND COALESCE(w.level, uw.level, k.level) = ?';
    params.push(level);
  }
  sql += ' ORDER BY p.next_review ASC, p.id ASC';
  return db.prepare(sql).all(...params);
}
