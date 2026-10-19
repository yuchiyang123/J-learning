import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, startApp, addWord } from './helpers.js';

let app;
const U = 'user-mistakes';
let w = {};

const result = (type, items) => db.prepare(
  "INSERT INTO quiz_results (user_id, type, level, total, correct, detail) VALUES (?, ?, 'N5', ?, ?, ?)"
).run(U, type, items.length, items.filter((i) => i.isCorrect).length, JSON.stringify(items));

before(async () => {
  app = await startApp();
  w.school = addWord('N5', '学校', 'がっこう', '學校');
  w.time = addWord('N5', '時間', 'じかん', '時間');
  w.green = addWord('N5', '緑', 'みどり', '綠色');
  w.n4 = addWord('N4', '急ぐ', 'いそぐ', '趕快');
  // practice runs: 学校 wrong twice, 時間 wrong once / right once
  result('vocab_typing', [
    { questionId: `word:${w.school}`, isCorrect: false },
    { questionId: `word:${w.time}`, isCorrect: false },
  ]);
  result('vocab_choice', [
    { questionId: `word:${w.school}`, isCorrect: false },
    { questionId: `word:${w.time}`, isCorrect: true },
    { questionId: `word:${w.n4}`, isCorrect: false },
  ]);
  // 刷題 multiple-choice quiz names the word in its prompt
  result('vocab', [
    { questionId: 9001, prompt: '「時間」の意味は？', isCorrect: false },
    { questionId: 9002, prompt: '「緑」の読み方は？', isCorrect: true },
  ]);
  // flashcard 不熟 presses
  const mark = db.prepare("INSERT INTO review_log (user_id, item_type, item_id, source, is_correct, response_ms) VALUES (?, 'word', ?, ?, ?, 1000)");
  for (const ok of [0, 0, 0, 1]) mark.run(U, w.green, 'flashcard', ok);
  // kanji-prompt practice also writes review_log ('practice') and bumps
  // user_progress counts; those must not be counted a second time
  mark.run(U, w.time, 'practice', 0);
  db.prepare("INSERT INTO user_progress (user_id, item_type, item_id, srs_level, correct_count, wrong_count) VALUES (?, 'word', ?, 0, 0, 5)").run(U, w.time);
  // someone else's mistakes don't count
  db.prepare("INSERT INTO quiz_results (user_id, type, level, total, correct, detail) VALUES ('other', 'vocab_typing', 'N5', 1, 0, ?)")
    .run(JSON.stringify([{ questionId: `word:${w.green}`, isCorrect: false }]));
});
after(() => app.close());

test('requires login', async () => {
  assert.equal((await app.call('GET', '/api/quiz/vocab-practice/mistakes?level=N5')).status, 401);
});

test('tallies practice, the 刷題 quiz and flashcard 不熟, most wrong first', async () => {
  const r = await app.call('GET', '/api/quiz/vocab-practice/mistakes?level=N5', { user: U });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, [
    { key: `word:${w.green}`, wrong: 3, attempts: 5 },  // 3 不熟 of 4 card marks + 1 right in 刷題
    { key: `word:${w.school}`, wrong: 2, attempts: 2 },
    { key: `word:${w.time}`, wrong: 2, attempts: 3 },   // same count, better ratio -> after 学校
  ]);
});

test('level filter keeps other levels out; no level includes them', async () => {
  const all = await app.call('GET', '/api/quiz/vocab-practice/mistakes', { user: U });
  assert.ok(all.body.some((m) => m.key === `word:${w.n4}`));
  const n5 = await app.call('GET', '/api/quiz/vocab-practice/mistakes?level=N5', { user: U });
  assert.ok(!n5.body.some((m) => m.key === `word:${w.n4}`));
  assert.equal((await app.call('GET', '/api/quiz/vocab-practice/mistakes?level=N9', { user: U })).status, 400);
});

test('choice runs are saved under their own type and count as recognition with the kanji prompt', async () => {
  const k = addWord('N5', '会社', 'かいしゃ', '公司');
  const r = await app.call('POST', '/api/quiz/vocab-practice/submit', {
    user: U,
    body: { mode: 'choice', prompt: 'kanji', level: 'N5', items: [{ wordKey: `word:${k}`, prompt: '会社', answer: 'かいしゃ', given: 'かいしや', isCorrect: false }] },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.srsUpdated, true);
  assert.equal(db.prepare("SELECT type FROM quiz_results WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(U).type, 'vocab_choice');
});
