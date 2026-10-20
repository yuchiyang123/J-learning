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

// GET /api/grammar/practice?level=N5 -> every grammar question of the level,
// with answers, tied to its grammar point, for the practice on the grammar
// page (graded on the client like the Blitz game; the run is then logged
// through POST /api/quiz/submit). Questions are linked by their explanation,
// which always starts with "<pattern>＝".
//   [{ id, grammarId, kind: 'meaning' | 'fill', prompt, options: [a..d], answer, explanation }]
router.get('/practice', (req, res) => {
  const { level, locale } = req.query;
  if (!/^N[1-5]$/.test(level || '')) return res.status(400).json({ error: 'level required' });
  const points = db.prepare('SELECT id, pattern FROM grammar_points WHERE level = ?').all(level);
  const byPrefix = new Map(points.map((g) => [`${g.pattern}＝`, g.id]));
  const questions = db.prepare("SELECT * FROM quiz_questions WHERE type = 'grammar' AND level = ? ORDER BY id").all(level);
  const out = [];
  for (const q of questions) {
    const cut = (q.explanation || '').indexOf('＝');
    const grammarId = cut > 0 ? byPrefix.get(q.explanation.slice(0, cut + 1)) : undefined;
    if (!grammarId) continue;
    const kind = q.prompt.startsWith('「') && q.prompt.endsWith('」の意味は？') ? 'meaning' : 'fill';
    out.push({
      id: q.id,
      grammarId,
      kind,
      prompt: q.prompt,
      options: [q.option_a, q.option_b, q.option_c, q.option_d].map((o) => (kind === 'meaning' ? translate(o, locale) : o)),
      answer: q.answer,
      explanation: translate(q.explanation, locale),
    });
  }
  res.json(out);
});

export default router;
