// One-off migration: repair the kana multiple-choice quiz's answer keys in
// place, without touching row ids or any other table.
//
// Root cause (fixed in seed.js alongside this script): the kana question
// generator pre-shuffled its options array and passed its own computed
// answerKey to addQuiz(), but addQuiz() always ignores that argument and
// instead treats options[0] as "the correct choice" (true for every other
// call site in seed.js, which never pre-shuffles) — so it took the
// already-shuffled options[0], an essentially random pick, as correct,
// shuffled again, and stored an answer key pointing at that random value.
// Every kana MC question had roughly a 1-in-4 chance of being graded right
// even when answered correctly.
//
// Re-running `npm run seed` would fix new rows, but it also DELETEs and
// re-inserts words/kanji/grammar_points/quiz_questions wholesale, which
// would shift every row's id — and user_progress / quiz_results.detail
// reference those ids. That's a much bigger blast radius than this one
// bug needs. This script only updates quiz_questions.answer for existing
// type='kana' rows, matched by each row's own audio_text (the hiragana
// character already stored on it) against the same char->romaji mapping
// used to seed them.
//
// Usage: node scripts/fix-kana-quiz-answers.mjs [path/to/app.db]
// Defaults to the path this app uses in production (see db.js / the
// Docker volume mount) if no path is given.
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.join(__dirname, '..', 'data', 'app.db');

const kanaRomaji = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
};

const dbPath = process.argv[2] || defaultDbPath;
const db = new Database(dbPath);

const rows = db.prepare("SELECT id, audio_text, option_a, option_b, option_c, option_d, answer FROM quiz_questions WHERE type = 'kana'").all();

let fixed = 0;
let alreadyOk = 0;
let unmatched = 0;
const update = db.prepare('UPDATE quiz_questions SET answer = ? WHERE id = ?');

const tx = db.transaction(() => {
  for (const r of rows) {
    const correctRomaji = kanaRomaji[r.audio_text];
    if (!correctRomaji) { unmatched++; console.log('no romaji mapping for', JSON.stringify(r.audio_text), 'id=', r.id); continue; }
    const keys = ['a', 'b', 'c', 'd'];
    const correctKey = keys.find((k) => r[`option_${k}`] === correctRomaji);
    if (!correctKey) { unmatched++; console.log('romaji not found among options for id=', r.id, r.audio_text, correctRomaji, [r.option_a, r.option_b, r.option_c, r.option_d]); continue; }
    if (r.answer === correctKey) { alreadyOk++; continue; }
    update.run(correctKey, r.id);
    fixed++;
  }
});
tx();

console.log(`kana quiz rows: ${rows.length}, fixed: ${fixed}, already correct: ${alreadyOk}, unmatched: ${unmatched}`);
db.close();
