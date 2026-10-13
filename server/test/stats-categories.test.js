import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, startApp } from './helpers.js';

let app;
const U = 'user-stats';
const add = (type, total, correct) =>
  db.prepare("INSERT INTO quiz_results (user_id, type, level, total, correct, detail) VALUES (?, ?, 'N5', ?, ?, '[]')").run(U, type, total, correct);

before(async () => { app = await startApp(); });
after(() => app.close());

const area = (body, type) => body.categoryBreakdown.find((c) => c.type === type);

test('vocabulary-page practice counts toward the 單字 area', async () => {
  add('vocab_typing', 10, 8);
  add('vocab_tiles', 5, 5);
  add('vocab_handwrite', 4, 1);
  add('vocab_kanji_write', 1, 0);
  const r = await app.call('GET', '/api/progress/stats', { user: U });
  assert.equal(r.status, 200);
  assert.deepEqual(area(r.body, 'vocab'), { type: 'vocab', total: 20, accuracy: 70 });
});

test('the 刷題 vocab quiz and practice are summed into one area', async () => {
  add('vocab', 10, 10);
  const r = await app.call('GET', '/api/progress/stats', { user: U });
  assert.deepEqual(area(r.body, 'vocab'), { type: 'vocab', total: 30, accuracy: 80 });
});

test('kanji handwriting counts toward 漢字; kana drills toward 五十音', async () => {
  add('kanji', 4, 2);
  add('kanji_write', 6, 6);
  add('kana', 2, 2);
  add('kana_write', 2, 0);
  add('kana_read', 4, 2);
  const r = await app.call('GET', '/api/progress/stats', { user: U });
  assert.deepEqual(area(r.body, 'kanji'), { type: 'kanji', total: 10, accuracy: 80 });
  assert.deepEqual(area(r.body, 'kana'), { type: 'kana', total: 8, accuracy: 50 });
});

test('an area with no results has no accuracy', async () => {
  const r = await app.call('GET', '/api/progress/stats', { user: U });
  assert.deepEqual(area(r.body, 'grammar'), { type: 'grammar', total: 0, accuracy: null });
});
