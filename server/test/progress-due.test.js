import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, startApp, addWord, addProgress } from './helpers.js';

let app;
const U = 'user-due';
const ids = {};

before(async () => {
  app = await startApp();
  ids.a = addWord('N5', '水', 'みず');
  ids.b = addWord('N5', '火', 'ひ');
  ids.c = addWord('N5', '木', 'き');
  ids.n4 = addWord('N4', '急ぐ', 'いそぐ');
  ids.custom = db.prepare("INSERT INTO user_words (user_id, level, kanji, kana, meaning) VALUES (?, 'N5', '猫', 'ねこ', 'cat')")
    .run(U).lastInsertRowid;

  addProgress(U, 'word', ids.a, '-1 day');      // due, newer
  addProgress(U, 'word', ids.b, '-3 days');     // due, oldest
  addProgress(U, 'word', ids.c, '+2 days');     // not due yet
  addProgress(U, 'word', ids.n4, '-5 days');    // due, but N4
  addProgress(U, 'custom_word', ids.custom, '-2 days'); // due, custom
  addProgress(U, 'kanji', 1, '-4 days');        // due, but not vocab
  addProgress('someone-else', 'word', ids.a, '-9 days');
});
after(() => app.close());

test('requires login', async () => {
  const r = await app.call('GET', '/api/progress/due?level=N5');
  assert.equal(r.status, 401);
});

test('returns only items whose next_review has passed, oldest first', async () => {
  const r = await app.call('GET', '/api/progress/due?level=N5&itemType=vocab', { user: U });
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.body.map((d) => `${d.itemType}:${d.itemId}`),
    [`word:${ids.b}`, `custom_word:${ids.custom}`, `word:${ids.a}`]
  );
});

test('level filter excludes other levels; no level returns all levels', async () => {
  const n4 = await app.call('GET', '/api/progress/due?level=N4', { user: U });
  assert.deepEqual(n4.body.map((d) => d.itemId), [ids.n4]);
  const all = await app.call('GET', '/api/progress/due', { user: U });
  assert.equal(all.body.length, 4); // b, custom, a, n4 — never kanji, never another user's
  assert.equal(all.body[0].itemId, ids.n4);
});

test('a word just answered wrong (level 0, due now) shows up immediately', async () => {
  db.prepare("UPDATE user_progress SET srs_level = 0, next_review = datetime('now', '-1 second') WHERE user_id = ? AND item_type = 'word' AND item_id = ?")
    .run(U, ids.c);
  const r = await app.call('GET', '/api/progress/due?level=N5', { user: U });
  assert.ok(r.body.some((d) => d.itemType === 'word' && d.itemId === ids.c));
});

test('rejects a bad level or itemType', async () => {
  assert.equal((await app.call('GET', '/api/progress/due?level=N9', { user: U })).status, 400);
  assert.equal((await app.call('GET', '/api/progress/due?itemType=grammar', { user: U })).status, 400);
});

test('with tz, everything scheduled for the local day is due from its start', async () => {
  const d = addWord('N5', '空', 'そら');
  // Scheduled for later today in UTC+8: due by local day, not yet by the clock.
  db.prepare("INSERT INTO user_progress (user_id, item_type, item_id, srs_level, next_review) VALUES (?, 'word', ?, 1, ?)")
    .run(U, d, db.prepare("SELECT datetime(date('now', '+480 minutes'), '+23 hours', '+59 minutes', '-480 minutes') t").get().t);
  const byClock = await app.call('GET', '/api/progress/due?level=N5', { user: U });
  const byDay = await app.call('GET', '/api/progress/due?level=N5&tz=480', { user: U });
  const has = (r) => r.body.some((x) => x.itemType === 'word' && x.itemId === d);
  assert.equal(has(byDay), true);
  assert.equal(has(byClock), db.prepare("SELECT datetime('now') >= datetime(date('now', '+480 minutes'), '+23 hours', '+59 minutes', '-480 minutes') x").get().x === 1);
  // tomorrow (local) stays out
  db.prepare("UPDATE user_progress SET next_review = datetime(date('now', '+480 minutes'), '+1 day', '+1 hour', '-480 minutes') WHERE user_id = ? AND item_id = ?").run(U, d);
  assert.equal(has(await app.call('GET', '/api/progress/due?level=N5&tz=480', { user: U })), false);
});
