import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, startApp, addWord } from './helpers.js';
const { normalizeResponseMs, nextAverage } = await import('../src/srs.js');

let app;
const U = 'user-rt';
const row = (itemType, itemId) =>
  db.prepare('SELECT srs_level, last_response_ms, avg_response_ms FROM user_progress WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .get(U, itemType, itemId);
const review = (itemId, correct, responseMs) =>
  app.call('POST', '/api/progress/review', { user: U, body: { itemType: 'word', itemId, correct, responseMs } });

before(async () => { app = await startApp(); });
after(() => app.close());

test('normalizeResponseMs keeps positive times up to 10 minutes, else null', () => {
  assert.equal(normalizeResponseMs(1234.6), 1235);
  assert.equal(normalizeResponseMs('800'), 800);
  for (const bad of [undefined, null, 0, -5, NaN, Infinity, 'abc', '', 10 * 60 * 1000 + 1, {}]) {
    assert.equal(normalizeResponseMs(bad), null, String(bad));
  }
});

test('moving average weights the newest answer 0.3', () => {
  assert.equal(nextAverage(null, 1000), 1000);
  assert.equal(nextAverage(1000, 2000), 1300);
  assert.equal(nextAverage(1000, null), 1000);
  assert.equal(nextAverage(null, null), null);
});

test('flashcard review records last and average response time', async () => {
  const w = addWord('N5', '山', 'やま');
  await review(w, true, 1000);
  assert.deepEqual(row('word', w), { srs_level: 1, last_response_ms: 1000, avg_response_ms: 1000 });
  await review(w, true, 2000);
  assert.deepEqual(row('word', w), { srs_level: 2, last_response_ms: 2000, avg_response_ms: 1300 });
});

test('a review without responseMs moves SRS but leaves the averages alone', async () => {
  const w = addWord('N5', '川', 'かわ');
  await review(w, true, 1500);
  await review(w, false);
  assert.deepEqual(row('word', w), { srs_level: 0, last_response_ms: 1500, avg_response_ms: 1500 });
  await review(w, true, 'garbage');
  assert.deepEqual(row('word', w), { srs_level: 1, last_response_ms: 1500, avg_response_ms: 1500 });
});

test('a first review without responseMs leaves both columns null', async () => {
  const w = addWord('N5', '空', 'そら');
  await review(w, true);
  assert.deepEqual(row('word', w), { srs_level: 1, last_response_ms: null, avg_response_ms: null });
});

test('practice: responseMs is kept per question, and only recognition runs update the averages', async () => {
  const w = addWord('N5', '海', 'うみ');
  const submit = (mode, prompt, responseMs) => app.call('POST', '/api/quiz/vocab-practice/submit', {
    user: U,
    body: { mode, prompt, level: 'N5', items: [{ wordKey: `word:${w}`, prompt: '海', answer: 'うみ', given: 'うみ', isCorrect: true, responseMs }] },
  });
  const r = await submit('typing', 'kanji', 2400);
  assert.equal(r.body.detail[0].responseMs, 2400);
  assert.equal(row('word', w).avg_response_ms, 2400);
  const r2 = await submit('typing', 'meaning', 9000);
  assert.equal(r2.body.detail[0].responseMs, 9000);   // still recorded in the result
  assert.equal(row('word', w).avg_response_ms, 2400); // but not in the recognition average
});

test('response-times: 14 local days, correct answers only, oldest first', async () => {
  db.prepare('DELETE FROM review_log WHERE user_id = ?').run(U);
  const ins = db.prepare(
    "INSERT INTO review_log (user_id, item_type, item_id, source, is_correct, response_ms, created_at) VALUES (?, 'word', 1, 'flashcard', ?, ?, datetime('now', ?))"
  );
  ins.run(U, 1, 1000, '-0 days');
  ins.run(U, 1, 3000, '-0 days');
  ins.run(U, 0, 9999, '-0 days');   // wrong: ignored
  ins.run(U, 1, 1500, '-3 days');
  ins.run(U, 1, 4000, '-20 days');  // outside the window
  ins.run('other-user', 1, 100, '-0 days');

  const r = await app.call('GET', '/api/progress/response-times?days=14', { user: U });
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 14);
  const today = r.body[13];
  assert.deepEqual({ avgMs: today.avgMs, count: today.count }, { avgMs: 2000, count: 2 });
  assert.deepEqual({ avgMs: r.body[10].avgMs, count: r.body[10].count }, { avgMs: 1500, count: 1 });
  assert.equal(r.body.filter((d) => d.avgMs != null).length, 2);
  assert.ok(r.body[0].date < r.body[13].date);
});

test('response-times requires login', async () => {
  assert.equal((await app.call('GET', '/api/progress/response-times')).status, 401);
});
