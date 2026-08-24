import { Router } from 'express';
import { db } from '../db.js';
import { touchUser } from '../users.js';
import { translate } from '../locale.js';
import { optionalAuth, requireAuth } from '../auth.js';

const router = Router();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Quiz option text is copied verbatim from a word/kanji/grammar "meaning" field
// at seed time, so the same zh->locale lookup used for those tables also covers
// quiz options. Reading-type options (kana/romaji) simply aren't in the
// translation cache and pass through unchanged, which is correct — a kana
// reading doesn't need localizing.
function localizeQuestion(q, locale) {
  return {
    ...q,
    option_a: translate(q.option_a, locale),
    option_b: translate(q.option_b, locale),
    option_c: translate(q.option_c, locale),
    option_d: translate(q.option_d, locale),
    explanation: q.explanation ? translate(q.explanation, locale) : q.explanation,
  };
}

// GET /api/quiz?type=vocab&level=N5&count=10  -> questions WITHOUT answer/explanation
// GET /api/quiz?...&includeAnswers=1 -> includes answer/explanation, for the client-side
// game modes (Blitz challenge) that need instant local scoring without a round trip
// per question. Results from that mode are still aggregated and logged via /submit.
router.get('/', (req, res) => {
  const { type, level, count, includeAnswers, locale } = req.query;
  let sql = 'SELECT * FROM quiz_questions WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (level) { sql += ' AND level = ?'; params.push(level); }
  const rows = db.prepare(sql).all(...params);
  const picked = shuffle(rows).slice(0, count ? Number(count) : rows.length).map((q) => localizeQuestion(q, locale));
  const safe = includeAnswers ? picked : picked.map(({ answer, explanation, ...rest }) => rest);
  res.json(safe);
});

// POST /api/quiz/submit { type, level, answers: [{questionId, selected}], locale }
// Grades and returns results regardless of login (practicing without an
// account still needs to show right/wrong); only persists to quiz_results
// (and therefore /history and /stats) when the caller is authenticated.
router.post('/submit', optionalAuth, (req, res) => {
  const { type = 'mixed', level = 'N5', answers = [], locale } = req.body;
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers required' });
  }
  const userId = req.user?.id;
  if (userId) touchUser(userId);
  const getQ = db.prepare('SELECT * FROM quiz_questions WHERE id = ?');
  const detail = [];
  let correct = 0;
  for (const a of answers) {
    const q = getQ.get(a.questionId);
    if (!q) continue;
    const isCorrect = q.answer === a.selected;
    if (isCorrect) correct++;
    detail.push({
      questionId: q.id,
      prompt: q.prompt,
      selected: a.selected,
      correctAnswer: q.answer,
      isCorrect,
      explanation: q.explanation ? translate(q.explanation, locale) : q.explanation,
    });
  }
  const total = detail.length;
  if (userId) {
    db.prepare(
      'INSERT INTO quiz_results (user_id, type, level, total, correct, detail) VALUES (?,?,?,?,?,?)'
    ).run(userId, type, level, total, correct, JSON.stringify(detail));
  }

  res.json({ total, correct, detail });
});

// GET /api/quiz/history
router.get('/history', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, type, level, total, correct, taken_at FROM quiz_results WHERE user_id = ? ORDER BY taken_at DESC LIMIT 50')
    .all(req.user.id);
  res.json(rows);
});

// GET /api/quiz/history/:id -> full per-question detail for review, with the
// original question's option text re-attached (quiz_results.detail only
// stored the prompt/selected/correct letters, not the option labels).
router.get('/history/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM quiz_results WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const { locale } = req.query;
  const getQ = db.prepare('SELECT * FROM quiz_questions WHERE id = ?');
  const rawDetail = JSON.parse(row.detail || '[]');
  const detail = rawDetail.map((d) => {
    const q = getQ.get(d.questionId);
    if (!q) return d;
    const lq = localizeQuestion(q, locale);
    return {
      ...d,
      option_a: lq.option_a,
      option_b: lq.option_b,
      option_c: lq.option_c,
      option_d: lq.option_d,
      audio_text: q.audio_text,
    };
  });
  res.json({ ...row, detail });
});

// GET /api/quiz/wrong?type=&level=&count=&locale= -> questions (no answers)
// pulled from this user's own quiz history where their most recent attempt on
// that question was wrong. A question answered wrong once but later correct
// drops out, since only the latest outcome per question counts.
router.get('/wrong', requireAuth, (req, res) => {
  const { type, level, count, locale } = req.query;
  let sql = 'SELECT detail FROM quiz_results WHERE user_id = ?';
  const params = [req.user.id];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (level) { sql += ' AND level = ?'; params.push(level); }
  // Newest first + capped: only "recent" wrong questions matter for practice,
  // and this keeps the scan bounded instead of re-parsing a user's entire
  // quiz history (which only grows) on every click.
  sql += ' ORDER BY taken_at DESC LIMIT 300';
  const rows = db.prepare(sql).all(...params);

  const lastOutcome = new Map();
  for (const r of rows) {
    for (const d of JSON.parse(r.detail || '[]')) {
      // Rows are newest-first, so the first outcome seen per question is
      // already its most recent — never let an older row overwrite it.
      if (!lastOutcome.has(d.questionId)) lastOutcome.set(d.questionId, d.isCorrect);
    }
  }
  const wrongIds = [...lastOutcome.entries()].filter(([, ok]) => !ok).map(([id]) => id);
  if (wrongIds.length === 0) return res.json([]);

  const placeholders = wrongIds.map(() => '?').join(',');
  const questions = db.prepare(`SELECT * FROM quiz_questions WHERE id IN (${placeholders})`).all(...wrongIds);
  const picked = shuffle(questions).slice(0, count ? Number(count) : questions.length).map((q) => localizeQuestion(q, locale));
  res.json(picked.map(({ answer, explanation, ...rest }) => rest));
});

// POST /api/quiz/kana-write/submit { script: 'hira'|'kata', items: [{char, romaji, isCorrect, strokes}] }
// Handwriting quiz is self-graded client-side (there's no OCR here — the user
// draws, reveals the reference character, then honestly marks right/wrong), so
// unlike /submit there's no server-side answer lookup: we just tally what the
// client already scored and persist it under the same quiz_results shape used
// by every other quiz type, with level repurposed to hold the script.
router.post('/kana-write/submit', optionalAuth, (req, res) => {
  const { script, items = [] } = req.body;
  if ((script !== 'hira' && script !== 'kata') || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'script and items required' });
  }
  const userId = req.user?.id;
  if (userId) touchUser(userId);

  let correct = 0;
  const detail = items.map((item) => {
    const isCorrect = !!item.isCorrect;
    if (isCorrect) correct++;
    return {
      questionId: `${script}:${item.char}`,
      script,
      prompt: item.romaji,
      selected: isCorrect ? item.char : '',
      correctAnswer: item.char,
      isCorrect,
      strokes: Array.isArray(item.strokes) ? item.strokes : [],
    };
  });
  const total = detail.length;

  if (userId) {
    db.prepare(
      'INSERT INTO quiz_results (user_id, type, level, total, correct, detail) VALUES (?,?,?,?,?,?)'
    ).run(userId, 'kana_write', script, total, correct, JSON.stringify(detail));
  }

  res.json({ total, correct, detail });
});

// GET /api/quiz/kana-write/wrong?script=hira|kata
// Same "most recent outcome per character wins" logic as /wrong, but kana
// handwriting has no quiz_questions row to look up — everything needed
// (script/char/romaji) is already sitting in each detail entry from submit.
router.get('/kana-write/wrong', requireAuth, (req, res) => {
  const { script } = req.query;
  let sql = "SELECT detail FROM quiz_results WHERE user_id = ? AND type = 'kana_write'";
  const params = [req.user.id];
  if (script) { sql += ' AND level = ?'; params.push(script); }
  sql += ' ORDER BY taken_at DESC LIMIT 300';
  const rows = db.prepare(sql).all(...params);

  const lastOutcome = new Map();
  for (const r of rows) {
    for (const d of JSON.parse(r.detail || '[]')) {
      if (!lastOutcome.has(d.questionId)) lastOutcome.set(d.questionId, d);
    }
  }
  const wrong = [...lastOutcome.values()]
    .filter((d) => !d.isCorrect)
    .map((d) => ({ script: d.script, char: d.correctAnswer, romaji: d.prompt }));
  res.json(wrong);
});

export default router;
