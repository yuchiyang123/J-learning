import { Router } from 'express';
import { db } from '../db.js';
import { touchUser } from '../users.js';
import { requireAuth } from '../auth.js';
import { applyReview, getDueItems, isDueItemType, logResponse, dailyResponseTimes } from '../srs.js';

const router = Router();

// Which quiz_results.type values make up each practice area on the
// Progress page's radar / bar charts. One area is often practised several
// ways — the 刷題 multiple-choice quiz plus the area's own drills — and
// from the learner's point of view those are the same skill, so they're
// summed into one bucket.
export const CATEGORY_QUIZ_TYPES = {
  kana: ['kana', 'kana_write', 'kana_read'],
  vocab: ['vocab', 'vocab_typing', 'vocab_tiles', 'vocab_handwrite', 'vocab_kanji_write'],
  kanji: ['kanji', 'kanji_write'],
  grammar: ['grammar'],
  listening: ['listening'],
};
router.use(requireAuth);

// GET /api/progress
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').all(req.user.id);
  res.json(rows);
});

// GET /api/progress/due?level=N5&itemType=vocab
//   -> [{ itemType: 'word' | 'custom_word', itemId, nextReview }], oldest due first.
// itemType is needed per entry: word and custom_word ids overlap.
router.get('/due', (req, res) => {
  const { level, itemType = 'vocab' } = req.query;
  if (level && !/^N[1-5]$/.test(level)) return res.status(400).json({ error: 'level must be N1-N5' });
  if (!isDueItemType(itemType)) return res.status(400).json({ error: 'unknown itemType' });
  res.json(getDueItems(req.user.id, { itemType, level }));
});

// GET /api/progress/response-times?days=14&tz=480
//   -> [{ date, avgMs, count }] per local day, correct answers only.
// tz = the user's UTC offset in minutes (e.g. 480 for UTC+8).
router.get('/response-times', (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 90);
  const tz = parseInt(req.query.tz, 10);
  const tzOffsetMinutes = Number.isFinite(tz) && Math.abs(tz) <= 14 * 60 ? tz : 0;
  res.json(dailyResponseTimes(req.user.id, { days, tzOffsetMinutes }));
});

// POST /api/progress/review { itemType, itemId, correct, responseMs? }
// responseMs: time from the card's front appearing to the answer; when
// missing (or unusable) the response-time averages are left untouched.
// simple SRS: correct -> srsLevel+1, next review pushed out; wrong -> reset to 0
router.post('/review', (req, res) => {
  const userId = req.user.id;
  const { itemType, itemId, correct, responseMs } = req.body;
  if (!itemType || !itemId) return res.status(400).json({ error: 'itemType and itemId required' });
  touchUser(userId);

  applyReview(userId, itemType, itemId, !!correct, responseMs);
  logResponse(userId, itemType, itemId, 'flashcard', !!correct, responseMs);

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

  // Daily streak: consecutive UTC calendar days with at least one quiz
  // result or speaking attempt, counting back from today. Today not having
  // any activity yet doesn't break the streak (the user just hasn't done
  // today's practice yet) — it only breaks once a full day is skipped.
  // Calendar day is UTC here (matches how every timestamp in this app is
  // already stored — see lib/formatDate.js on the client, which only
  // converts to local time for *display*), so a user far from UTC could see
  // their streak flip a day earlier/later than their own midnight; a known,
  // accepted simplification rather than tracking each user's timezone.
  const activeDates = new Set([
    ...results.map((r) => r.taken_at.slice(0, 10)),
    ...speaking.map((a) => a.attempted_at.slice(0, 10)),
  ]);
  let streak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  if (!activeDates.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (activeDates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Per-category accuracy for the Progress page's radar/bar charts — each
  // area sums its quiz types (see CATEGORY_QUIZ_TYPES).
  const byType = new Map();
  for (const r of results) {
    const bucket = byType.get(r.type) || { total: 0, correct: 0 };
    bucket.total += r.total;
    bucket.correct += r.correct;
    byType.set(r.type, bucket);
  }
  const accuracyOf = (bucket) => (bucket.total ? Math.round((bucket.correct / bucket.total) * 100) : null);
  const sumOf = (types) => types.reduce(
    (acc, t) => {
      const b = byType.get(t);
      return b ? { total: acc.total + b.total, correct: acc.correct + b.correct } : acc;
    },
    { total: 0, correct: 0 }
  );
  const area = (type, quizTypes) => {
    const b = sumOf(quizTypes);
    return { type, total: b.total, accuracy: accuracyOf(b) };
  };
  const categoryBreakdown = [
    area('kana', CATEGORY_QUIZ_TYPES.kana),
    area('vocab', CATEGORY_QUIZ_TYPES.vocab),
    area('kanji', CATEGORY_QUIZ_TYPES.kanji),
    area('grammar', CATEGORY_QUIZ_TYPES.grammar),
    area('listening', CATEGORY_QUIZ_TYPES.listening),
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
    streak,
  });
});

export default router;
