import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, startApp, addWord, addProgress, srsLevel } from './helpers.js';

let app;
const U = 'user-pending';

before(async () => { app = await startApp(); });
after(() => app.close());

const pendingKeys = async () =>
  (await app.call('GET', '/api/progress/pending', { user: U })).body.map((p) => `${p.itemType}:${p.itemId}`);
const mark = (itemId, pending, itemType = 'word') =>
  app.call('PUT', '/api/progress/pending', { user: U, body: { itemType, itemId, pending } });
const submit = (mode, prompt, w, isCorrect) => app.call('POST', '/api/quiz/vocab-practice/submit', {
  user: U,
  body: { mode, prompt, level: 'N5', items: [{ wordKey: `word:${w}`, prompt: 'p', answer: 'a', given: 'g', isCorrect }] },
});

test('requires login', async () => {
  assert.equal((await app.call('GET', '/api/progress/pending')).status, 401);
  assert.equal((await app.call('PUT', '/api/progress/pending', { body: { itemType: 'word', itemId: 1, pending: true } })).status, 401);
});

test('mark and unmark 待考; marking twice is harmless; no SRS row is created', async () => {
  const w = addWord('N5', '雨', 'あめ');
  assert.equal((await mark(w, true)).status, 200);
  assert.equal((await mark(w, true)).status, 200);
  assert.deepEqual(await pendingKeys(), [`word:${w}`]);
  assert.equal(srsLevel(U, 'word', w), undefined); // not turned into 不熟
  await mark(w, false);
  assert.deepEqual(await pendingKeys(), []);
});

test('rejects bad input', async () => {
  assert.equal((await mark('abc', true)).status, 400);
  assert.equal((await mark(1, true, 'kanji')).status, 400);
});

test('passing a 待考 word in typing (any prompt) marks it 記得 and clears 待考', async () => {
  const w = addWord('N5', '雪', 'ゆき');
  await mark(w, true);
  const r = await submit('typing', 'meaning', w, true);
  assert.deepEqual(r.body.resolvedPending, [{ key: `word:${w}`, isCorrect: true }]);
  assert.equal(srsLevel(U, 'word', w), 1);
  assert.ok(!(await pendingKeys()).includes(`word:${w}`));
});

test('failing a 待考 word in tiles marks it 不熟 and clears 待考', async () => {
  const w = addWord('N5', '風', 'かぜ');
  addProgress(U, 'word', w, '+5 days', 3);
  await mark(w, true);
  await submit('tiles', 'audio', w, false);
  assert.equal(srsLevel(U, 'word', w), 0);
  assert.ok(!(await pendingKeys()).includes(`word:${w}`));
});

test('self-graded handwriting never settles 待考 and leaves SRS alone', async () => {
  const w = addWord('N5', '花', 'はな');
  await mark(w, true);
  const r = await submit('handwrite', 'kanji', w, true);
  assert.deepEqual(r.body.resolvedPending, []);
  assert.equal(srsLevel(U, 'word', w), undefined);
  assert.ok((await pendingKeys()).includes(`word:${w}`));
});

test('a word that is not 待考 still follows the recognition-only SRS rule', async () => {
  const w = addWord('N5', '月', 'つき');
  addProgress(U, 'word', w, '+5 days', 2);
  await submit('typing', 'meaning', w, false);
  assert.equal(srsLevel(U, 'word', w), 2);
});

test('pressing 記得 / 不熟 on a flashcard settles 待考 too', async () => {
  const w = addWord('N5', '星', 'ほし');
  await mark(w, true);
  await app.call('POST', '/api/progress/review', { user: U, body: { itemType: 'word', itemId: w, correct: true } });
  assert.ok(!(await pendingKeys()).includes(`word:${w}`));
  assert.equal(srsLevel(U, 'word', w), 1);
});

test("another user's 待考 is invisible", async () => {
  const w = addWord('N5', '空', 'そら');
  db.prepare("INSERT INTO pending_tests (user_id, item_type, item_id) VALUES ('someone-else', 'word', ?)").run(w);
  assert.ok(!(await pendingKeys()).includes(`word:${w}`));
});
