import { Router } from 'express';
import { db } from '../db.js';
import { touchUser } from '../users.js';
import { translate } from '../locale.js';
import { optionalAuth, requireAuth } from '../auth.js';
import { applyReview, practiceUpdatesSrs, logResponse, normalizeResponseMs, isPending, setPending, practiceSettlesPending } from '../srs.js';
import { getVocabMistakes } from '../mistakes.js';

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

// POST /api/quiz/kana-read/submit { script: 'hira'|'kata', items: [{char, romaji, isCorrect}] }
// Reading-recall drill: shown the kana, the learner says its reading out
// loud before revealing it — the opposite direction of kana-write (shown
// the romaji, draw the kana). Same self-graded shape as kana-write above,
// minus strokes (there's no drawing here to persist).
router.post('/kana-read/submit', optionalAuth, (req, res) => {
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
      prompt: item.char,
      selected: isCorrect ? item.romaji : '',
      correctAnswer: item.romaji,
      isCorrect,
      char: item.char,
    };
  });
  const total = detail.length;

  if (userId) {
    db.prepare(
      'INSERT INTO quiz_results (user_id, type, level, total, correct, detail) VALUES (?,?,?,?,?,?)'
    ).run(userId, 'kana_read', script, total, correct, JSON.stringify(detail));
  }

  res.json({ total, correct, detail });
});

// GET /api/quiz/kana-read/wrong?script=hira|kata
router.get('/kana-read/wrong', requireAuth, (req, res) => {
  const { script } = req.query;
  let sql = "SELECT detail FROM quiz_results WHERE user_id = ? AND type = 'kana_read'";
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
    .map((d) => ({ script: d.script, char: d.char, romaji: d.correctAnswer }));
  res.json(wrong);
});

// POST /api/quiz/kanji-write/submit { level, items: [{char, meaning, isCorrect, strokes}] }
// Same self-graded shape as kana-write above, with `level` (N5..N1) standing
// in for kana's `script` as the grouping/level column.
router.post('/kanji-write/submit', optionalAuth, (req, res) => {
  const { level, items = [] } = req.body;
  if (!level || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'level and items required' });
  }
  const userId = req.user?.id;
  if (userId) touchUser(userId);

  let correct = 0;
  const detail = items.map((item) => {
    const isCorrect = !!item.isCorrect;
    if (isCorrect) correct++;
    return {
      questionId: `kanji:${item.char}`,
      prompt: item.meaning,
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
    ).run(userId, 'kanji_write', level, total, correct, JSON.stringify(detail));
  }

  res.json({ total, correct, detail });
});

// GET /api/quiz/kanji-write/wrong?level=N5
router.get('/kanji-write/wrong', requireAuth, (req, res) => {
  const { level } = req.query;
  let sql = "SELECT detail FROM quiz_results WHERE user_id = ? AND type = 'kanji_write'";
  const params = [req.user.id];
  if (level) { sql += ' AND level = ?'; params.push(level); }
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
    .map((d) => ({ char: d.correctAnswer, meaning: d.prompt }));
  res.json(wrong);
});

// ---------- Vocabulary practice (typing / tiles / handwriting) ----------
//
// The four practice modes on the vocabulary page are graded client-side
// (typing and tiles compare against the word's readings exactly; the two
// handwriting modes are self-graded after a shape-match suggestion), so
// like kana-write this just tallies and persists. Each mode is its own
// quiz_results.type so history can tell them apart.
const VOCAB_PRACTICE_TYPES = {
  typing: 'vocab_typing',
  tiles: 'vocab_tiles',
  handwrite: 'vocab_handwrite',
  kanji: 'vocab_kanji_write',
  choice: 'vocab_choice',
};
const WORD_KEY = /^(word|custom_word):(\d+)$/;
const clip = (v, n) => String(v ?? '').slice(0, n);
const MAX_PRACTICE_ITEMS = 100;

// POST /api/quiz/vocab-practice/submit
//   { mode, prompt, level, items: [{ wordKey: 'word:12', prompt, answer, given, isCorrect, responseMs?, strokesList? }] }
// responseMs: time from the question appearing to the answer being submitted.
// `prompt` is what the questions showed: 'kanji' | 'meaning' | 'audio'
// ('reading' for kanji writing). Every run goes to quiz_results/history;
// only recognition runs (see practiceUpdatesSrs) also move each word's SRS
// state, shared with the flashcards. The response says which happened.
router.post('/vocab-practice/submit', optionalAuth, (req, res) => {
  const { mode, prompt, level, items } = req.body;
  const type = VOCAB_PRACTICE_TYPES[mode];
  if (!type || !/^N[1-5]$/.test(level || '') || !Array.isArray(items) || items.length === 0 || items.length > MAX_PRACTICE_ITEMS) {
    return res.status(400).json({ error: 'mode, level and 1-100 items required' });
  }
  const userId = req.user?.id;
  if (userId) touchUser(userId);

  let correct = 0;
  const detail = [];
  for (const item of items) {
    const m = WORD_KEY.exec(item?.wordKey || '');
    if (!m) continue;
    const isCorrect = !!item.isCorrect;
    if (isCorrect) correct++;
    const entry = {
      questionId: m[0],
      prompt: clip(item.prompt, 200),
      selected: clip(item.given, 100),
      correctAnswer: clip(item.answer, 100),
      isCorrect,
      responseMs: normalizeResponseMs(item.responseMs),
    };
    // Handwriting modes: one stroke set per written character.
    if (Array.isArray(item.strokesList)) {
      entry.strokesList = item.strokesList.slice(0, 16).map((s) => (Array.isArray(s) ? s : []));
    }
    detail.push(entry);
  }
  if (detail.length === 0) return res.status(400).json({ error: 'no valid items' });
  const total = detail.length;

  const srsUpdated = !!userId && practiceUpdatesSrs(mode, prompt);
  const settles = !!userId && practiceSettlesPending(mode);
  const resolvedPending = [];
  if (userId) {
    const save = db.transaction(() => {
      db.prepare(
        'INSERT INTO quiz_results (user_id, type, level, total, correct, detail) VALUES (?,?,?,?,?,?)'
      ).run(userId, type, level, total, correct, JSON.stringify(detail));
      for (const d of detail) {
        const [, itemType, rawId] = WORD_KEY.exec(d.questionId);
        const itemId = Number(rawId);
        // A 待考 word answered in an auto-graded mode is settled by this
        // answer (right -> 記得, wrong -> 不熟), whatever the prompt — that's
        // the test it was waiting for.
        const settlesThis = settles && isPending(userId, itemType, itemId);
        if (srsUpdated || settlesThis) {
          applyReview(userId, itemType, itemId, d.isCorrect, srsUpdated ? d.responseMs : null);
          if (srsUpdated) logResponse(userId, itemType, itemId, 'practice', d.isCorrect, d.responseMs);
        }
        if (settlesThis) {
          setPending(userId, itemType, itemId, false);
          resolvedPending.push({ key: d.questionId, isCorrect: d.isCorrect });
        }
      }
    });
    save();
  }

  res.json({ total, correct, detail, srsUpdated, resolvedPending });
});

// GET /api/quiz/vocab-practice/mistakes?level=N5 -> [{ key, wrong, attempts }]
// The words this user gets wrong most (see mistakes.js), most wrong first.
router.get('/vocab-practice/mistakes', requireAuth, (req, res) => {
  const { level } = req.query;
  if (level && !/^N[1-5]$/.test(level)) return res.status(400).json({ error: 'level must be N1-N5' });
  res.json(getVocabMistakes(req.user.id, { level }));
});

// GET /api/quiz/vocab-practice/wrong?level=N5 -> ['word:12', 'custom_word:3', ...]
// Words whose most recent attempt in any practice mode was wrong.
router.get('/vocab-practice/wrong', requireAuth, (req, res) => {
  const { level } = req.query;
  const types = Object.values(VOCAB_PRACTICE_TYPES);
  let sql = `SELECT detail FROM quiz_results WHERE user_id = ? AND type IN (${types.map(() => '?').join(',')})`;
  const params = [req.user.id, ...types];
  if (level) { sql += ' AND level = ?'; params.push(level); }
  sql += ' ORDER BY taken_at DESC LIMIT 300';
  const lastOutcome = new Map();
  for (const r of db.prepare(sql).all(...params)) {
    for (const d of JSON.parse(r.detail || '[]')) {
      if (!lastOutcome.has(d.questionId)) lastOutcome.set(d.questionId, d.isCorrect);
    }
  }
  res.json([...lastOutcome.entries()].filter(([, ok]) => !ok).map(([key]) => key));
});

export default router;
