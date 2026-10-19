import { db } from './db.js';

// 我的錯字: the words this user gets wrong most, across everything that
// grades vocabulary —
//   - vocabulary practice runs (quiz_results types vocab_*), which record
//     the word itself ('word:12' / 'custom_word:3')
//   - the 刷題 vocabulary quiz ('vocab'), whose questions name the word in
//     the prompt (「学校」の意味は？ / 「学校」の読み方は？)
//   - flashcard 記得 / 不熟 presses (review_log, source 'flashcard')
// Returns [{ key, wrong, attempts }] for words wrong at least once, most
// wrong first (ties: worse ratio first).
export function getVocabMistakes(userId, { level } = {}) {
  const words = db.prepare('SELECT id, level, kanji, kana FROM words' + (level ? ' WHERE level = ?' : '')).all(...(level ? [level] : []));
  const levelOf = new Map(words.map((w) => [`word:${w.id}`, w.level]));
  const byLabel = new Map();
  for (const w of words) {
    for (const label of [w.kanji, w.kana].filter(Boolean).flatMap((s) => s.split(/;\s*/))) {
      const k = `${w.level}|${label}`;
      if (!byLabel.has(k)) byLabel.set(k, `word:${w.id}`);
    }
  }
  if (level) {
    for (const c of db.prepare('SELECT id FROM user_words WHERE user_id = ? AND level = ?').all(userId, level)) levelOf.set(`custom_word:${c.id}`, level);
  }

  const tally = new Map();
  const add = (key, ok) => {
    if (!key || (level && !levelOf.has(key))) return;
    const t = tally.get(key) || { key, wrong: 0, attempts: 0 };
    t.attempts++;
    if (!ok) t.wrong++;
    tally.set(key, t);
  };

  const rows = db.prepare(
    "SELECT type, level, detail FROM quiz_results WHERE user_id = ? AND (type = 'vocab' OR type LIKE 'vocab\\_%' ESCAPE '\\')"
  ).all(userId);
  for (const r of rows) {
    let detail = [];
    try { detail = JSON.parse(r.detail || '[]'); } catch { /* skip a bad row */ }
    for (const d of detail) {
      if (/^(word|custom_word):\d+$/.test(String(d.questionId))) add(String(d.questionId), d.isCorrect);
      else if (r.type === 'vocab') {
        const m = /「([^」]+)」/.exec(d.prompt || '');
        if (m) add(byLabel.get(`${r.level}|${m[1]}`), d.isCorrect);
      }
    }
  }

  // Flashcard marks come from review_log (source 'flashcard'), not from
  // user_progress counts: those also rise for kanji-prompt practice, which
  // is already counted from its quiz_results above.
  for (const r of db.prepare(
    "SELECT item_type, item_id, is_correct FROM review_log WHERE user_id = ? AND source = 'flashcard' AND item_type IN ('word', 'custom_word')"
  ).all(userId)) add(`${r.item_type}:${r.item_id}`, !!r.is_correct);

  return [...tally.values()]
    .filter((t) => t.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.attempts - a.wrong / a.attempts);
}
