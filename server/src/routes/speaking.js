import { Router } from 'express';
import { db } from '../db.js';
import { touchUser } from '../users.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// POST /api/speaking { targetText, recognizedText, score }
router.post('/', (req, res) => {
  const userId = req.user.id;
  const { targetText, recognizedText, score } = req.body;
  if (!targetText || typeof targetText !== 'string') return res.status(400).json({ error: 'targetText required' });
  if (score != null && typeof score !== 'number') return res.status(400).json({ error: 'score must be a number' });
  touchUser(userId);
  db.prepare(
    'INSERT INTO speaking_attempts (user_id, target_text, recognized_text, score) VALUES (?,?,?,?)'
  ).run(userId, targetText, recognizedText || null, score ?? null);
  res.json({ ok: true });
});

// GET /api/speaking
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM speaking_attempts WHERE user_id = ? ORDER BY attempted_at DESC LIMIT 50')
    .all(req.user.id);
  res.json(rows);
});

export default router;
