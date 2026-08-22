import { Router } from 'express';
import { db } from '../db.js';
import { translate } from '../locale.js';

const router = Router();

router.get('/', (req, res) => {
  const { level, locale } = req.query;
  const rows = level
    ? db.prepare('SELECT * FROM kanji WHERE level = ? ORDER BY id').all(level)
    : db.prepare('SELECT * FROM kanji ORDER BY id').all();
  res.json(rows.map((r) => ({ ...r, meaning: translate(r.meaning, locale) })));
});

export default router;
