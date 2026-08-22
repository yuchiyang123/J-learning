import { Router } from 'express';
import { db } from '../db.js';
import { touchUser } from '../users.js';

const router = Router();

// POST /api/speaking { userId, targetText, recognizedText, score }
router.post('/', (req, res) => {
  const { userId = 'guest', targetText, recognizedText, score } = req.body;
  if (!targetText) return res.status(400).json({ error: 'targetText required' });
  touchUser(userId);
  db.prepare(
    'INSERT INTO speaking_attempts (user_id, target_text, recognized_text, score) VALUES (?,?,?,?)'
  ).run(userId, targetText, recognizedText || null, score ?? null);
  res.json({ ok: true });
});

// GET /api/speaking?userId=guest
router.get('/', (req, res) => {
  const { userId = 'guest' } = req.query;
  const rows = db
    .prepare('SELECT * FROM speaking_attempts WHERE user_id = ? ORDER BY attempted_at DESC LIMIT 50')
    .all(userId);
  res.json(rows);
});

export default router;
