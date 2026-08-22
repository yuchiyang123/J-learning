import { Router } from 'express';
import { db } from '../db.js';
import { touchUser } from '../users.js';
import { requireAuth } from '../auth.js';

const router = Router();

// POST /api/games/score { game, mode, level, score, detail }
router.post('/score', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { game, mode = null, level = null, score, detail = null } = req.body;
  if (!game || typeof score !== 'number') {
    return res.status(400).json({ error: 'game and numeric score required' });
  }
  touchUser(userId);
  db.prepare(
    'INSERT INTO game_scores (user_id, game, mode, level, score, detail) VALUES (?,?,?,?,?,?)'
  ).run(userId, game, mode, level, score, detail ? JSON.stringify(detail) : null);
  res.json({ ok: true });
});

// GET /api/games/best?game=&mode=&level=  -> the logged-in user's top score for the combo
router.get('/best', requireAuth, (req, res) => {
  const { game, mode, level } = req.query;
  if (!game) return res.status(400).json({ error: 'game required' });
  let sql = 'SELECT * FROM game_scores WHERE user_id = ? AND game = ?';
  const params = [req.user.id, game];
  if (mode) { sql += ' AND mode = ?'; params.push(mode); }
  if (level) { sql += ' AND level = ?'; params.push(level); }
  sql += ' ORDER BY score DESC LIMIT 1';
  const row = db.prepare(sql).get(...params);
  if (!row) return res.json(null);
  res.json({ ...row, detail: row.detail ? JSON.parse(row.detail) : null });
});

// GET /api/games/history?game=  -> the logged-in user's recent plays
router.get('/history', requireAuth, (req, res) => {
  const { game } = req.query;
  let sql = 'SELECT * FROM game_scores WHERE user_id = ?';
  const params = [req.user.id];
  if (game) { sql += ' AND game = ?'; params.push(game); }
  sql += ' ORDER BY played_at DESC LIMIT 50';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((r) => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null })));
});

// GET /api/games/leaderboard?game=&mode=&level=&limit=10 -> top scores across all users (public)
router.get('/leaderboard', (req, res) => {
  const { game, mode, level, limit } = req.query;
  if (!game) return res.status(400).json({ error: 'game required' });
  let sql = `
    SELECT g.user_id, COALESCE(u.display_name, '匿名玩家') AS display_name, g.score, g.mode, g.level, g.played_at
    FROM game_scores g LEFT JOIN users u ON u.id = g.user_id
    WHERE g.game = ?
  `;
  const params = [game];
  if (mode) { sql += ' AND g.mode = ?'; params.push(mode); }
  if (level) { sql += ' AND g.level = ?'; params.push(level); }
  sql += ' ORDER BY g.score DESC LIMIT ?';
  params.push(limit ? Number(limit) : 10);
  res.json(db.prepare(sql).all(...params));
});

export default router;
