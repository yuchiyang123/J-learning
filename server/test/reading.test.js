import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, tokenFor } from './helpers.js';

const { default: express } = await import('express');
const { default: cookieParser } = await import('cookie-parser');
const { default: readingRouter, loadPassages } = await import('../src/routes/reading.js');

let server;
let base;
const U = 'user-reading';
const call = async (method, url, { user, body } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user ? { Cookie: `token=${tokenFor(user)}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/reading', readingRouter);
  server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('the N5 passages are well formed', () => {
  const list = loadPassages().N5;
  assert.ok(list.length >= 10);
  assert.equal(new Set(list.map((p) => p.id)).size, list.length);
  for (const p of list) {
    for (const f of ['zh', 'en', 'ko']) {
      assert.ok(p.title[f] && p.translation[f], `${p.id} ${f}`);
      for (const q of p.questions) assert.ok(q.why[f], `${p.id} why.${f}`);
    }
    assert.ok(p.text && p.furigana, p.id);
    assert.equal(p.text.split('\n').length, p.furigana.split('\n').length, `${p.id} furigana lines`);
    for (const q of p.questions) {
      assert.equal(q.options.length, 4, p.id);
      assert.equal(new Set(q.options).size, 4, p.id);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, p.id);
    }
    for (const v of p.vocab) assert.equal(v.length, 5, p.id);
  }
});

test('lists passages in the requested language', async () => {
  const en = await call('GET', '/api/reading?level=N5&locale=en');
  assert.equal(en.status, 200);
  const p = loadPassages().N5[0];
  assert.equal(en.body[0].title, p.title.en);
  assert.equal(en.body[0].questions[0].why, p.questions[0].why.en);
  assert.equal(en.body[0].vocab[0].meaning, p.vocab[0][3]);
  const zh = await call('GET', '/api/reading?level=N5');
  assert.equal(zh.body[0].translation, p.translation.zh);
  assert.equal((await call('GET', '/api/reading?level=N9')).status, 400);
});

test('submit grades on the server and saves a reading result for accounts', async () => {
  const p = loadPassages().N5[1];
  const answers = p.questions.map((q, i) => (i === 0 ? q.answer : (q.answer + 1) % 4));
  const anon = await call('POST', '/api/reading/submit', { body: { level: 'N5', passageId: p.id, answers, seconds: 95 } });
  assert.deepEqual(anon.body, { total: p.questions.length, correct: 1, saved: false });
  assert.equal(db.prepare("SELECT COUNT(*) c FROM quiz_results WHERE type = 'reading'").get().c, 0);

  const r = await call('POST', '/api/reading/submit', { user: U, body: { level: 'N5', passageId: p.id, answers, seconds: 95 } });
  assert.equal(r.body.saved, true);
  const row = db.prepare("SELECT * FROM quiz_results WHERE user_id = ? AND type = 'reading'").get(U);
  assert.equal(row.correct, 1);
  assert.equal(JSON.parse(row.detail)[0].questionId, `reading:${p.id}:0`);

  const h = await call('GET', '/api/reading/history?level=N5', { user: U });
  assert.deepEqual({ ...h.body[p.id], takenAt: undefined }, { correct: 1, total: p.questions.length, seconds: 95, takenAt: undefined });
  assert.equal((await call('GET', '/api/reading/history')).status, 401);
});

test('submit rejects unknown passages and a wrong number of answers', async () => {
  assert.equal((await call('POST', '/api/reading/submit', { body: { passageId: 'nope', answers: [] } })).status, 404);
  const p = loadPassages().N5[0];
  assert.equal((await call('POST', '/api/reading/submit', { body: { passageId: p.id, answers: [0] } })).status, p.questions.length === 1 ? 200 : 400);
});
