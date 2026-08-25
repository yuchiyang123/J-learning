import { Router } from 'express';
import { db } from '../db.js';
import { touchUser } from '../users.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/progress
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').all(req.user.id);
  res.json(rows);
});

// POST /api/progress/review { itemType, itemId, correct }
// simple SRS: correct -> srsLevel+1, next review pushed out; wrong -> reset to 0
router.post('/review', (req, res) => {
  const userId = req.user.id;
  const { itemType, itemId, correct } = req.body;
  if (!itemType || !itemId) return res.status(400).json({ error: 'itemType and itemId required' });
  touchUser(userId);

  const existing = db
    .prepare('SELECT * FROM user_progress WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .get(userId, itemType, itemId);

  const intervals = [0, 1, 3, 7, 14, 30, 90]; // days by srs level

  if (!existing) {
    const srsLevel = correct ? 1 : 0;
    const days = intervals[srsLevel] ?? 90;
    db.prepare(
      `INSERT INTO user_progress (user_id, item_type, item_id, srs_level, correct_count, wrong_count, last_reviewed, next_review)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+' || ? || ' days'))`
    ).run(userId, itemType, itemId, srsLevel, correct ? 1 : 0, correct ? 0 : 1, days);
  } else {
    const srsLevel = correct ? Math.min(existing.srs_level + 1, intervals.length - 1) : 0;
    const days = intervals[srsLevel] ?? 90;
    db.prepare(
      `UPDATE user_progress SET srs_level = ?, correct_count = correct_count + ?, wrong_count = wrong_count + ?,
       last_reviewed = datetime('now'), next_review = datetime('now', '+' || ? || ' days')
       WHERE id = ?`
    ).run(srsLevel, correct ? 1 : 0, correct ? 0 : 1, days, existing.id);
  }

  res.json({ ok: true });
});

// DELETE /api/progress/:itemType/:itemId
// Clears a mark entirely (used when re-clicking the already-active
// 不熟/記得 button to deselect it) rather than forcing a switch to the
// other state.
router.delete('/:itemType/:itemId', (req, res) => {
  const { itemType, itemId } = req.params;
  db.prepare('DELETE FROM user_progress WHERE user_id = ? AND item_type = ? AND item_id = ?').run(
    req.user.id,
    itemType,
    itemId
  );
  res.json({ ok: true });
});

// GET /api/progress/stats
router.get('/stats', (req, res) => {
  const userId = req.user.id;
  const progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').all(userId);
  const results = db.prepare('SELECT * FROM quiz_results WHERE user_id = ?').all(userId);
  const speaking = db.prepare('SELECT * FROM speaking_attempts WHERE user_id = ?').all(userId);

  const totalReviewed = progress.length;
  const mastered = progress.filter((p) => p.srs_level >= 4).length;
  const quizTotal = results.reduce((s, r) => s + r.total, 0);
  const quizCorrect = results.reduce((s, r) => s + r.correct, 0);
  const avgSpeaking = speaking.length
    ? speaking.reduce((s, a) => s + (a.score || 0), 0) / speaking.length
    : null;

  // Per-category accuracy for the Progress page's radar/bar charts. 'kana'
  // (MC quiz) and 'kana_write' (handwriting quiz) are two different
  // quiz_results.type values but the same practice area from the learner's
  // point of view, so they're summed into one 五十音 bucket here.
  const byType = new Map();
  for (const r of results) {
    const bucket = byType.get(r.type) || { total: 0, correct: 0 };
    bucket.total += r.total;
    bucket.correct += r.correct;
    byType.set(r.type, bucket);
  }
  const kana = byType.get('kana') || { total: 0, correct: 0 };
  const kanaWrite = byType.get('kana_write') || { total: 0, correct: 0 };
  const accuracyOf = (bucket) => (bucket.total ? Math.round((bucket.correct / bucket.total) * 100) : null);
  const categoryBreakdown = [
    { type: 'kana', total: kana.total + kanaWrite.total, accuracy: accuracyOf({ total: kana.total + kanaWrite.total, correct: kana.correct + kanaWrite.correct }) },
    { type: 'vocab', total: (byType.get('vocab') || { total: 0 }).total, accuracy: accuracyOf(byType.get('vocab') || { total: 0, correct: 0 }) },
    { type: 'kanji', total: (byType.get('kanji') || { total: 0 }).total, accuracy: accuracyOf(byType.get('kanji') || { total: 0, correct: 0 }) },
    { type: 'grammar', total: (byType.get('grammar') || { total: 0 }).total, accuracy: accuracyOf(byType.get('grammar') || { total: 0, correct: 0 }) },
    { type: 'listening', total: (byType.get('listening') || { total: 0 }).total, accuracy: accuracyOf(byType.get('listening') || { total: 0, correct: 0 }) },
    { type: 'speaking', total: speaking.length, accuracy: avgSpeaking !== null ? Math.round(avgSpeaking) : null },
  ];

  res.json({
    totalReviewed,
    mastered,
    quizTotal,
    quizCorrect,
    quizAccuracy: quizTotal ? Math.round((quizCorrect / quizTotal) * 100) : null,
    speakingAttempts: speaking.length,
    avgSpeakingScore: avgSpeaking !== null ? Math.round(avgSpeaking) : null,
    recentResults: results.slice(-10).reverse(),
    categoryBreakdown,
  });
});

export default router;
