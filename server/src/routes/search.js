import { Router } from 'express';
import { db } from '../db.js';
import { translate } from '../locale.js';

const router = Router();

// GET /api/search?q=&locale= -> { words, kanji, grammar }, each up to 20 hits
// across every level (unlike /words, /kanji, /grammar which require picking
// one level first) — this is the only cross-level, cross-content-type
// lookup the app has, so it's its own small route rather than bolted onto
// one of those three.
router.get('/', (req, res) => {
  const { q, locale } = req.query;
  const query = (q || '').trim();
  if (!query) return res.json({ words: [], kanji: [], grammar: [] });
  const like = `%${query}%`;

  const words = db
    .prepare(
      `SELECT id, level, kanji, kana, meaning FROM words
       WHERE kanji LIKE ? OR kana LIKE ? OR meaning LIKE ?
       ORDER BY level LIMIT 20`
    )
    .all(like, like, like);

  const kanjiRows = db
    .prepare(
      `SELECT id, level, character, onyomi, kunyomi, meaning FROM kanji
       WHERE character LIKE ? OR onyomi LIKE ? OR kunyomi LIKE ? OR meaning LIKE ?
       ORDER BY level LIMIT 20`
    )
    .all(like, like, like, like);

  const grammar = db
    .prepare(
      `SELECT id, level, pattern, meaning FROM grammar_points
       WHERE pattern LIKE ? OR meaning LIKE ? OR explanation LIKE ?
       ORDER BY level LIMIT 20`
    )
    .all(like, like, like);

  res.json({
    words: words.map((w) => ({ ...w, meaning: translate(w.meaning, locale) })),
    kanji: kanjiRows.map((k) => ({ ...k, meaning: translate(k.meaning, locale) })),
    grammar: grammar.map((g) => ({ ...g, meaning: translate(g.meaning, locale) })),
  });
});

export default router;
