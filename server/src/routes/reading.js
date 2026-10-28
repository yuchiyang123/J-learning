import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { db } from '../db.js';
import { touchUser } from '../users.js';
import { normalizeLocale, translate } from '../locale.js';
import { optionalAuth, requireAuth } from '../auth.js';

// 閱讀測驗: short JLPT-style passages (src/reading-<level>.json, next to the
// code — data/ is a Docker volume in production). The passages carry their
// own zh / en / ko text; zh-CN is converted from zh like everything else.
// A finished passage is logged as a 'reading' quiz result whose detail
// items are keyed `reading:<passageId>:<questionIndex>`.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

let cached = null;
export function loadPassages() {
  if (cached) return cached;
  cached = {};
  for (const level of LEVELS) {
    const file = path.join(__dirname, '..', `reading-${level.toLowerCase()}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      cached[level] = JSON.parse(fs.readFileSync(file, 'utf8'))[level] || [];
    } catch (err) {
      console.warn(`reading passages for ${level} not loaded: ${err.message}`);
    }
  }
  return cached;
}

function pick(text, locale) {
  const loc = normalizeLocale(locale);
  if (loc === 'en') return text.en;
  if (loc === 'ko') return text.ko;
  return translate(text.zh, loc);
}

function localize(p, locale) {
  const loc = normalizeLocale(locale);
  const vocabMeaning = ([, , zh, en, ko]) => (loc === 'en' ? en : loc === 'ko' ? ko : translate(zh, loc));
  return {
    id: p.id,
    kind: p.kind,
    title: pick(p.title, locale),
    text: p.text,
    furigana: p.furigana,
    translation: pick(p.translation, locale),
    vocab: p.vocab.map((v) => ({ written: v[0], kana: v[1], meaning: vocabMeaning(v) })),
    questions: p.questions.map((q) => ({ q: q.q, options: q.options, answer: q.answer, why: pick(q.why, locale) })),
  };
}

const router = Router();

// GET /api/reading?level=N5&locale= -> passages with questions and answers
// (graded on the client so the explanation shows right away).
router.get('/', (req, res) => {
  const { level = 'N5', locale } = req.query;
  if (!LEVELS.includes(level)) return res.status(400).json({ error: 'level must be N1-N5' });
  res.json((loadPassages()[level] || []).map((p) => localize(p, locale)));
});

// GET /api/reading/history?level=N5 -> { [passageId]: { correct, total, seconds, takenAt } }
// (the latest attempt at each passage).
router.get('/history', requireAuth, (req, res) => {
  const { level = 'N5' } = req.query;
  const rows = db.prepare(
    "SELECT correct, total, detail, taken_at FROM quiz_results WHERE user_id = ? AND type = 'reading' AND level = ? ORDER BY id"
  ).all(req.user.id, level);
  const out = {};
  for (const r of rows) {
    let detail = [];
    try { detail = JSON.parse(r.detail || '[]'); } catch { /* skip */ }
    const id = /^reading:([^:]+):/.exec(detail[0]?.questionId || '')?.[1];
    if (id) out[id] = { correct: r.correct, total: r.total, seconds: detail[0]?.seconds ?? null, takenAt: r.taken_at };
  }
  res.json(out);
});

// POST /api/reading/submit { level, passageId, answers: [optionIndex...], seconds }
// Grades on the server too, so the stored result can't disagree with the key.
router.post('/submit', optionalAuth, (req, res) => {
  const { level = 'N5', passageId, answers, seconds } = req.body || {};
  const passage = (loadPassages()[level] || []).find((p) => p.id === passageId);
  if (!passage) return res.status(404).json({ error: 'unknown passage' });
  if (!Array.isArray(answers) || answers.length !== passage.questions.length) {
    return res.status(400).json({ error: 'one answer per question' });
  }
  const secs = Number.isFinite(seconds) && seconds > 0 && seconds < 3 * 3600 ? Math.round(seconds) : null;
  const detail = passage.questions.map((q, i) => ({
    questionId: `reading:${passage.id}:${i}`,
    prompt: q.q,
    selected: answers[i],
    correctAnswer: q.answer,
    isCorrect: answers[i] === q.answer,
    seconds: secs,
  }));
  const correct = detail.filter((d) => d.isCorrect).length;
  if (req.user?.id) {
    touchUser(req.user.id);
    db.prepare('INSERT INTO quiz_results (user_id, type, level, total, correct, detail) VALUES (?,?,?,?,?,?)')
      .run(req.user.id, 'reading', level, detail.length, correct, JSON.stringify(detail));
  }
  res.json({ total: detail.length, correct, saved: !!req.user?.id });
});

export default router;
