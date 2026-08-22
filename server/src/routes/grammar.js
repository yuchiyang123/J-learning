import { Router } from 'express';
import { db } from '../db.js';
import { translate } from '../locale.js';

const router = Router();

router.get('/', (req, res) => {
  const { level, locale } = req.query;
  const rows = level
    ? db.prepare('SELECT * FROM grammar_points WHERE level = ? ORDER BY id').all(level)
    : db.prepare('SELECT * FROM grammar_points ORDER BY id').all();
  res.json(
    rows.map((r) => ({
      ...r,
      meaning: translate(r.meaning, locale),
      explanation: translate(r.explanation, locale),
      example_zh: translate(r.example_zh, locale),
    }))
  );
});

export default router;
