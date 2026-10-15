import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Hand-checked corrections for vocabulary meanings (src/meaning-fixes.json —
// kept next to the code, not in data/, which is a Docker volume in
// production and would hide any file the image puts there).
// The original batch machine translation shifted some meanings onto
// neighbouring words (歌う showed 後ろ's meaning, 便利 showed 床, ...) and
// rendered "counter for ~" as 櫃檯. Corrections are matched on
// level + kanji + kana, so word ids — and therefore every user's progress,
// 待考 marks and bookmarks — are untouched.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXES_FILE = path.join(__dirname, 'meaning-fixes.json');

let cached = null;
export function loadMeaningFixes() {
  if (cached) return cached;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(FIXES_FILE, 'utf8'));
  } catch (err) {
    // Never take the server down over a missing/broken corrections file.
    console.warn(`meaning fixes not loaded: ${err.message}`);
    raw = {};
  }
  const rows = [];
  for (const [level, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    for (const [kanji, kana, zh, en, ko] of list) rows.push({ level, kanji, kana, zh, en, ko });
  }
  cached = rows;
  return rows;
}

// zh-TW text -> { en, ko } for corrected meanings: the en/ko lookup is keyed
// by the Chinese text, so corrected text needs its own entries (and a few
// unchanged texts, like 郵局, had picked up a wrong English pairing).
let overrides = null;
export function meaningOverrides() {
  if (overrides) return overrides;
  overrides = new Map();
  for (const f of loadMeaningFixes()) overrides.set(f.zh, { en: f.en, ko: f.ko });
  return overrides;
}

const OPTION_KEYS = ['a', 'b', 'c', 'd'];

// Applies the corrections to `words` and to quiz options that copied the old
// text. Idempotent: rows already holding the corrected meaning are skipped.
// Returns { updated, unmatched } for logging.
export function applyMeaningFixes(db, fixes = loadMeaningFixes()) {
  const find = db.prepare("SELECT id, meaning FROM words WHERE level = ? AND COALESCE(kanji, '') = ? AND kana = ?");
  const setMeaning = db.prepare('UPDATE words SET meaning = ? WHERE id = ?');
  const questions = db.prepare(
    `SELECT id, prompt, audio_text, option_a, option_b, option_c, option_d, answer, explanation
     FROM quiz_questions WHERE level = ? AND (option_a = ? OR option_b = ? OR option_c = ? OR option_d = ?)`
  );
  const updateQuestion = db.prepare(
    'UPDATE quiz_questions SET option_a = ?, option_b = ?, option_c = ?, option_d = ?, explanation = ? WHERE id = ?'
  );

  let updated = 0;
  const unmatched = [];
  const changes = [];
  const run = db.transaction(() => {
    for (const f of fixes) {
      const rows = find.all(f.level, f.kanji || '', f.kana);
      if (rows.length === 0) { unmatched.push(`${f.level} ${f.kanji || '-'} ${f.kana}`); continue; }
      for (const w of rows) {
        if (w.meaning === f.zh) continue;
        setMeaning.run(f.zh, w.id);
        changes.push({ fix: f, old: w.meaning });
        updated++;
      }
    }

    // Quiz options. First each corrected word's own questions (its answer
    // option), then any other option that still shows an old (wrong) text —
    // as a distractor it stood for that word, so it gets the corrected text.
    // Answer options are only ever changed for their own word's question.
    const labels = (f) => [f.kanji, f.kana].filter(Boolean).flatMap((s) => s.split(/;\s*/));
    const isOwnQuestion = (q, f) => labels(f).some((l) => q.prompt.includes(`「${l}」`) || q.audio_text === l);
    for (const pass of ['answers', 'distractors']) {
      for (const { fix: f, old } of changes) {
        for (const q of questions.all(f.level, old, old, old, old)) {
          const opts = OPTION_KEYS.map((k) => q[`option_${k}`]);
          let explanation = q.explanation;
          let touched = false;
          OPTION_KEYS.forEach((k, i) => {
            if (opts[i] !== old) return;
            const isAnswer = k === q.answer;
            if (pass === 'answers' && isAnswer && isOwnQuestion(q, f)) {
              opts[i] = f.zh;
              if (explanation) explanation = explanation.split(old).join(f.zh);
              touched = true;
            } else if (pass === 'distractors' && !isAnswer && !opts.includes(f.zh)) {
              opts[i] = f.zh;
              touched = true;
            }
          });
          if (touched) updateQuestion.run(...opts, explanation, q.id);
        }
      }
    }
  });
  run();
  return { updated, unmatched };
}

// ---------- duplicate words ----------
//
// The same word imported twice (e.g. 行く as both 'いく' and 'いく; ゆく').
// Each entry names the row to keep and the one to fold into it; every
// reference to the duplicate is moved over first, so nobody's progress,
// 待考 mark, bookmark or response history is lost:
//   user_progress  — moved; if the user has both, the higher srs_level row
//                    is kept and the correct/wrong counts are added up
//   pending_tests  — moved (kept once)
//   user_bookmarks — 'word:<dup>' -> 'word:<keep>'
//   review_log     — moved
// Idempotent: once the duplicate row is gone there's nothing to do.
export const DUPLICATE_WORDS = [
  { level: 'N5', kanji: '行く', keepKana: 'いく; ゆく', dropKana: 'いく' },
];

export function mergeDuplicateWords(db, list = DUPLICATE_WORDS) {
  const find = db.prepare("SELECT id FROM words WHERE level = ? AND COALESCE(kanji, '') = ? AND kana = ?");
  let merged = 0;
  const run = db.transaction(() => {
    for (const d of list) {
      const keep = find.get(d.level, d.kanji || '', d.keepKana);
      const drop = find.get(d.level, d.kanji || '', d.dropKana);
      if (!keep || !drop || keep.id === drop.id) continue;
      const k = keep.id;
      const x = drop.id;

      const dupRows = db.prepare("SELECT * FROM user_progress WHERE item_type = 'word' AND item_id = ?").all(x);
      for (const r of dupRows) {
        const mine = db.prepare("SELECT * FROM user_progress WHERE user_id = ? AND item_type = 'word' AND item_id = ?").get(r.user_id, k);
        if (!mine) {
          db.prepare('UPDATE user_progress SET item_id = ? WHERE id = ?').run(k, r.id);
          continue;
        }
        const winner = r.srs_level > mine.srs_level ? r : mine;
        db.prepare(
          `UPDATE user_progress SET srs_level = ?, correct_count = ?, wrong_count = ?, last_reviewed = ?, next_review = ?,
             last_response_ms = ?, avg_response_ms = ? WHERE id = ?`
        ).run(
          winner.srs_level, mine.correct_count + r.correct_count, mine.wrong_count + r.wrong_count,
          winner.last_reviewed, winner.next_review, winner.last_response_ms, winner.avg_response_ms, mine.id
        );
        db.prepare('DELETE FROM user_progress WHERE id = ?').run(r.id);
      }

      db.prepare("INSERT OR IGNORE INTO pending_tests (user_id, item_type, item_id, created_at) SELECT user_id, 'word', ?, created_at FROM pending_tests WHERE item_type = 'word' AND item_id = ?").run(k, x);
      db.prepare("DELETE FROM pending_tests WHERE item_type = 'word' AND item_id = ?").run(x);
      db.prepare('UPDATE user_bookmarks SET item_key = ? WHERE item_key = ?').run(`word:${k}`, `word:${x}`);
      db.prepare("UPDATE review_log SET item_id = ? WHERE item_type = 'word' AND item_id = ?").run(k, x);
      db.prepare('DELETE FROM words WHERE id = ?').run(x);
      merged++;
    }
  });
  run();
  return merged;
}
