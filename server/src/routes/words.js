import { Router } from 'express';
import { db } from '../db.js';
import { translate } from '../locale.js';

const router = Router();

function localize(row, locale) {
  return {
    ...row,
    meaning: translate(row.meaning, locale),
    example_zh: translate(row.example_zh, locale),
  };
}

router.get('/', (req, res) => {
  const { level, locale } = req.query;
  const rows = level
    ? db.prepare('SELECT * FROM words WHERE level = ? ORDER BY id').all(level)
    : db.prepare('SELECT * FROM words ORDER BY id').all();
  res.json(rows.map((r) => localize(r, locale)));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(localize(row, req.query.locale));
});

export default router;
