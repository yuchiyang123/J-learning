import { Router } from 'express';
import { db } from '../db.js';
import { optionalAuth, requireAuth } from '../auth.js';
import { translate } from '../locale.js';

const router = Router();
const VALID_LEVELS = new Set(['N5', 'N4', 'N3', 'N2', 'N1']);
const MAX_SHORT = 100;
const MAX_LONG = 500;
const MAX_CUSTOM_WORDS_PER_USER = 500;

function localize(row, locale) {
  return {
    ...row,
    meaning: translate(row.meaning, locale),
    example_zh: translate(row.example_zh, locale),
  };
}

// Custom words are typed directly by their owner in whatever locale they're
// using, so there's no translation cache for them — return as-is and just
// tag them so the client can show a badge / allow delete.
function toCustomRow(row) {
  return { ...row, isCustom: true };
}

router.get('/', optionalAuth, (req, res) => {
  const { level, locale } = req.query;
  const rows = level
    ? db.prepare('SELECT * FROM words WHERE level = ? ORDER BY id').all(level)
    : db.prepare('SELECT * FROM words ORDER BY id').all();
  const result = rows.map((r) => localize(r, locale));

  if (req.user) {
    const customRows = level
      ? db.prepare('SELECT * FROM user_words WHERE user_id = ? AND level = ? ORDER BY id').all(req.user.id, level)
      : db.prepare('SELECT * FROM user_words WHERE user_id = ? ORDER BY id').all(req.user.id);
    result.push(...customRows.map(toCustomRow));
  }

  res.json(result);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(localize(row, req.query.locale));
});

// POST /api/words/custom { level, kanji, kana, meaning, part_of_speech, example_jp, example_reading, example_zh }
router.post('/custom', requireAuth, (req, res) => {
  const { level, kanji, kana, meaning, part_of_speech, example_jp, example_reading, example_zh } = req.body;
  if (!VALID_LEVELS.has(level) || !kana || !meaning) {
    return res.status(400).json({ error: 'valid level, kana and meaning required' });
  }
  const fields = { kanji, kana, meaning, part_of_speech, example_jp, example_reading, example_zh };
  const shortFields = ['kanji', 'kana', 'meaning', 'part_of_speech'];
  for (const [key, val] of Object.entries(fields)) {
    const max = shortFields.includes(key) ? MAX_SHORT : MAX_LONG;
    if (typeof val === 'string' && val.length > max) {
      return res.status(400).json({ error: `${key} too long (max ${max})` });
    }
  }
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM user_words WHERE user_id = ?').get(req.user.id);
  if (count >= MAX_CUSTOM_WORDS_PER_USER) {
    return res.status(400).json({ error: 'custom word limit reached' });
  }
  const info = db
    .prepare(
      `INSERT INTO user_words (user_id, level, kanji, kana, meaning, part_of_speech, example_jp, example_reading, example_zh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, level, kanji || null, kana, meaning, part_of_speech || null, example_jp || null, example_reading || null, example_zh || null);
  const row = db.prepare('SELECT * FROM user_words WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(toCustomRow(row));
});

// DELETE /api/words/custom/:id
router.delete('/custom/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM user_words WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

export default router;
