import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db, addWord, addProgress, srsLevel } from './helpers.js';
const { applyMeaningFixes, mergeDuplicateWords, loadMeaningFixes } = await import('../src/meaningFixes.js');
const { translate } = await import('../src/locale.js');

const addQuestion = (prompt, options, answer, explanation = null) =>
  db.prepare("INSERT INTO quiz_questions (type, level, prompt, option_a, option_b, option_c, option_d, answer, explanation) VALUES ('vocab','N5',?,?,?,?,?,?,?)")
    .run(prompt, ...options, answer, explanation).lastInsertRowid;
const question = (id) => db.prepare('SELECT * FROM quiz_questions WHERE id = ?').get(id);

const FIXES = [
  { level: 'N5', kanji: '後ろ', kana: 'うしろ', zh: '後面、背後', en: 'back, behind', ko: '뒤' },
  { level: 'N5', kanji: '歌う', kana: 'うたう', zh: '唱（歌）', en: 'to sing', ko: '노래하다' },
  { level: 'N5', kanji: '便利', kana: 'べんり', zh: '方便的', en: 'convenient', ko: '편리하다' },
  { level: 'N5', kanji: '', kana: 'ベッド', zh: '床', en: 'bed', ko: '침대' },
];

test('corrects meanings in place: same ids, progress and 待考 untouched', () => {
  const ushiro = addWord('N5', '後ろ', 'うしろ', '之上、家後面，後面，');
  const utau = addWord('N5', '歌う', 'うたう', '之上、家後面，後面，');
  const benri = addWord('N5', '便利', 'べんり', '床');
  const bed = addWord('N5', null, 'ベッド', '床');
  addProgress('u1', 'word', utau, '+3 days', 3);
  db.prepare("INSERT INTO pending_tests (user_id, item_type, item_id) VALUES ('u1', 'word', ?)").run(benri);

  const r = applyMeaningFixes(db, FIXES);
  assert.equal(r.updated, 3); // ベッド already says 床
  assert.deepEqual(r.unmatched, []);
  const m = (id) => db.prepare('SELECT meaning FROM words WHERE id = ?').get(id).meaning;
  assert.equal(m(ushiro), '後面、背後');
  assert.equal(m(utau), '唱（歌）');
  assert.equal(m(benri), '方便的');
  assert.equal(m(bed), '床');
  assert.equal(srsLevel('u1', 'word', utau), 3);
  assert.ok(db.prepare("SELECT 1 FROM pending_tests WHERE user_id = 'u1' AND item_id = ?").get(benri));
});

test('fixes the answer of the word\'s own quiz question, and old text used as a distractor elsewhere', () => {
  // Fresh rows with the old (wrong) texts again, plus questions using them.
  db.prepare("UPDATE words SET meaning = '之上、家後面，後面，' WHERE kanji IN ('後ろ', '歌う')").run();
  const qUtau = addQuestion('「歌う」の意味は？', ['烹飪', '紅色', '貴的', '之上、家後面，後面，'], 'd', '「歌う」= 之上、家後面，後面，');
  const qOther = addQuestion('「赤」の意味は？', ['紅色', '之上、家後面，後面，', '藍色', '白色'], 'a');
  applyMeaningFixes(db, FIXES);
  const a = question(qUtau);
  assert.equal(a.option_d, '唱（歌）');
  assert.equal(a.answer, 'd');
  assert.equal(a.explanation, '「歌う」= 唱（歌）');
  const b = question(qOther);
  assert.equal(b.option_a, '紅色'); // its own correct answer untouched
  assert.ok(['後面、背後', '唱（歌）'].includes(b.option_b)); // old text replaced by a real meaning
});

test('is idempotent', () => {
  const r = applyMeaningFixes(db, FIXES);
  assert.equal(r.updated, 0);
});

test('reports fixes that match no word', () => {
  const r = applyMeaningFixes(db, [{ level: 'N5', kanji: '無い字', kana: 'ないじ', zh: 'x', en: 'x', ko: 'x' }]);
  assert.deepEqual(r.unmatched, ['N5 無い字 ないじ']);
});

test('corrected meanings come with their own English and Korean', () => {
  const fix = loadMeaningFixes().find((f) => f.kanji === '便利');
  assert.equal(translate(fix.zh, 'en'), 'convenient');
  assert.equal(translate(fix.zh, 'ko'), '편리하다');
  assert.equal(translate(fix.zh, 'zh-TW'), fix.zh);
});

test('the shipped fix list is well-formed and has no conflicting duplicates', () => {
  const fixes = loadMeaningFixes();
  assert.ok(fixes.length > 100);
  const seen = new Map();
  for (const f of fixes) {
    assert.ok(f.level && f.kana && f.zh && f.en && f.ko, JSON.stringify(f));
    const key = `${f.level}|${f.kanji}|${f.kana}`;
    assert.ok(!seen.has(key), `duplicate fix ${key}`);
    seen.set(key, f);
  }
});

test('merging a duplicate word moves every reference to the kept row', () => {
  const keep = addWord('N5', '行く', 'いく; ゆく', '去');
  const drop = addWord('N5', '行く', 'いく', '去');
  // user A only has the duplicate; user B has both (keep the higher level, add counts)
  addProgress('ua', 'word', drop, '+1 day', 2);
  addProgress('ub', 'word', keep, '+1 day', 1);
  addProgress('ub', 'word', drop, '+7 days', 4);
  db.prepare('UPDATE user_progress SET correct_count = 3, wrong_count = 1 WHERE user_id = ? AND item_id = ?').run('ub', keep);
  db.prepare('UPDATE user_progress SET correct_count = 5, wrong_count = 2 WHERE user_id = ? AND item_id = ?').run('ub', drop);
  db.prepare("INSERT INTO pending_tests (user_id, item_type, item_id) VALUES ('ua', 'word', ?)").run(drop);
  db.prepare("INSERT INTO pending_tests (user_id, item_type, item_id) VALUES ('ub', 'word', ?), ('ub', 'word', ?)").run(keep, drop);
  db.prepare("INSERT INTO user_bookmarks (user_id, bookmark_id, item_key) VALUES ('ua', 'N5:all:kana', ?)").run(`word:${drop}`);
  db.prepare("INSERT INTO review_log (user_id, item_type, item_id, source, is_correct, response_ms) VALUES ('ua', 'word', ?, 'flashcard', 1, 900)").run(drop);

  assert.equal(mergeDuplicateWords(db), 1);

  assert.equal(db.prepare('SELECT 1 FROM words WHERE id = ?').get(drop), undefined);
  assert.equal(srsLevel('ua', 'word', keep), 2);
  const b = db.prepare("SELECT * FROM user_progress WHERE user_id = 'ub' AND item_type = 'word' AND item_id IN (?, ?)").all(keep, drop);
  assert.equal(b.length, 1);
  assert.equal(b[0].item_id, keep);
  assert.equal(b[0].srs_level, 4);
  assert.equal(b[0].correct_count, 8);
  assert.equal(b[0].wrong_count, 3);
  const pending = db.prepare('SELECT user_id, item_id FROM pending_tests WHERE item_id IN (?, ?) ORDER BY user_id').all(keep, drop);
  assert.deepEqual(pending, [{ user_id: 'ua', item_id: keep }, { user_id: 'ub', item_id: keep }]);
  assert.equal(db.prepare("SELECT item_key FROM user_bookmarks WHERE user_id = 'ua'").get().item_key, `word:${keep}`);
  assert.equal(db.prepare("SELECT item_id FROM review_log WHERE user_id = 'ua'").get().item_id, keep);
  assert.equal(mergeDuplicateWords(db), 0); // idempotent
});
