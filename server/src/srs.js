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
