import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Extra grammar points (src/grammar-n5.json — next to the code, not in
// data/, which is a Docker volume in production). The seed only had 24 N5
// points; these fill in the rest of the N5 range. Each point is inserted
// once, matched on level + pattern, together with two 刷題 questions: the
// usual 「pattern」の意味は？ and a fill-in-the-blank one. Existing rows are
// never touched, so ids (and anyone's progress) stay put.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADDITIONS_FILE = path.join(__dirname, 'grammar-n5.json');

let cached = null;
export function loadGrammarAdditions() {
  if (cached) return cached;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(ADDITIONS_FILE, 'utf8'));
  } catch (err) {
    console.warn(`grammar additions not loaded: ${err.message}`);
    raw = {};
  }
  const rows = [];
  for (const [level, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    for (const g of list) rows.push({ level, ...g });
  }
  cached = rows;
  return rows;
}

const quizExplanation = (pattern, meaning) => `${pattern}＝${meaning}`;

// zh-TW text -> { en, ko } for the added points' meaning, explanation,
// example and quiz explanation (en/ko are looked up by the Chinese text).
let overrides = null;
export function grammarOverrides() {
  if (overrides) return overrides;
  overrides = new Map();
  for (const g of loadGrammarAdditions()) {
    for (const field of ['meaning', 'explanation', 'example']) {
      overrides.set(g.zh[field], { en: g.en[field], ko: g.ko[field] });
    }
    overrides.set(quizExplanation(g.pattern, g.zh.meaning), {
      en: quizExplanation(g.pattern, g.en.meaning),
      ko: quizExplanation(g.pattern, g.ko.meaning),
    });
  }
  return overrides;
}

const OPTION_KEYS = ['a', 'b', 'c', 'd'];

// Stable per-question shuffle (so a re-run or a test sees the same layout)
// that still spreads the right answer over a-d.
function arrange(options, seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const out = [...options];
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = (h >>> 16) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { options: out, answer: OPTION_KEYS[out.indexOf(options[0])] };
}

// Inserts the points that aren't there yet plus their questions. Idempotent.
// Returns the number of points added.
export function applyGrammarAdditions(db, additions = loadGrammarAdditions()) {
  const exists = db.prepare('SELECT 1 FROM grammar_points WHERE level = ? AND pattern = ?');
  const insertPoint = db.prepare(
    'INSERT INTO grammar_points (level, pattern, meaning, explanation, example_jp, example_reading, example_zh) VALUES (?,?,?,?,?,?,?)'
  );
  const insertQuiz = db.prepare(
    `INSERT INTO quiz_questions (type, level, prompt, audio_text, option_a, option_b, option_c, option_d, answer, explanation)
     VALUES ('grammar', ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
  );
  const addQuiz = (level, prompt, correctFirst, explanation) => {
    const { options, answer } = arrange(correctFirst, prompt);
    insertQuiz.run(level, prompt, ...options, answer, explanation);
  };

  let added = 0;
  db.transaction(() => {
    for (const [i, g] of additions.entries()) {
      if (exists.get(g.level, g.pattern)) continue;
      insertPoint.run(g.level, g.pattern, g.zh.meaning, g.zh.explanation, g.example_jp, g.example_reading, g.zh.example);
      const explanation = quizExplanation(g.pattern, g.zh.meaning);
      // Distractor meanings: the next three added points of the same level.
      const pool = additions.filter((x) => x.level === g.level && x.pattern !== g.pattern);
      const distractors = [0, 1, 2].map((k) => pool[(i + k) % pool.length]?.zh.meaning).filter(Boolean);
      if (new Set(distractors).size === 3) addQuiz(g.level, `「${g.pattern}」の意味は？`, [g.zh.meaning, ...distractors], explanation);
      const { prompt, options, answer } = g.quiz;
      addQuiz(g.level, prompt, [options[answer], ...options.filter((_, k) => k !== answer)], explanation);
      added++;
    }
  })();
  return added;
}
