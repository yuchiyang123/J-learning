// One-off: regrade a single already-submitted quiz_results row against the
// now-corrected quiz_questions.answer values (see fix-kana-quiz-answers.mjs
// and the seed.js fix it ships with). A submission graded before that fix
// has selected/correctAnswer/isCorrect baked into its own `detail` JSON at
// the wrong (pre-fix) answer keys — fixing quiz_questions afterwards does
// NOT retroactively correct rows already in quiz_results, since /submit
// copies the answer key into detail at submission time rather than
// re-deriving it live. This recomputes each entry against the live
// quiz_questions.answer (leaving `selected` — what the user actually
// clicked — untouched) and updates `correct` and `detail` in place.
//
// Usage: node scripts/regrade-quiz-result.mjs <quiz_results.id> [path/to/app.db]
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.join(__dirname, '..', 'data', 'app.db');

const resultId = Number(process.argv[2]);
if (!resultId) {
  console.error('Usage: node scripts/regrade-quiz-result.mjs <quiz_results.id> [path/to/app.db]');
  process.exit(1);
}
const dbPath = process.argv[3] || defaultDbPath;
const db = new Database(dbPath);

const row = db.prepare('SELECT * FROM quiz_results WHERE id = ?').get(resultId);
if (!row) { console.error('no quiz_results row with id', resultId); process.exit(1); }

const detail = JSON.parse(row.detail || '[]');
const getQ = db.prepare('SELECT answer FROM quiz_questions WHERE id = ?');

let correct = 0;
const newDetail = detail.map((d) => {
  const q = getQ.get(d.questionId);
  const correctAnswer = q ? q.answer : d.correctAnswer; // question deleted since — leave as-is
  const isCorrect = d.selected === correctAnswer;
  if (isCorrect) correct++;
  return { ...d, correctAnswer, isCorrect };
});

db.prepare('UPDATE quiz_results SET correct = ?, detail = ? WHERE id = ?')
  .run(correct, JSON.stringify(newDetail), resultId);

console.log(`result #${resultId}: regraded ${newDetail.length} questions, ${row.correct} -> ${correct} correct`);
db.close();
