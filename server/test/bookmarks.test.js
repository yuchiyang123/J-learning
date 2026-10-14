import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let app;
const U = 'user-bm';
const get = (user = U) => app.call('GET', '/api/progress/bookmarks', { user });
const put = (id, key, user = U) => app.call('PUT', '/api/progress/bookmarks', { user, body: { id, key } });

before(async () => { app = await startApp(); });
after(() => app.close());

test('requires login', async () => {
  assert.equal((await app.call('GET', '/api/progress/bookmarks')).status, 401);
  assert.equal((await app.call('PUT', '/api/progress/bookmarks', { body: { id: '__deck', key: 'all' } })).status, 401);
});

test('stores, overwrites and removes a deck position', async () => {
  assert.equal((await put('N5:all:kana', 'word:423')).status, 200);
  assert.deepEqual((await get()).body, { 'N5:all:kana': 'word:423' });
  await put('N5:all:kana', 'word:430');
  assert.deepEqual((await get()).body, { 'N5:all:kana': 'word:430' });
  await put('N5:all:kana', null);
  assert.deepEqual((await get()).body, {});
});

test('keeps separate positions per level / deck / front, plus the last deck', async () => {
  await put('N5:all:kana', 'word:1');
  await put('N5:unknown:kanji', 'custom_word:7');
  await put('N4:pending:both', 'word:9');
  await put('__deck', 'unknown');
  assert.deepEqual((await get()).body, {
    'N5:all:kana': 'word:1', 'N5:unknown:kanji': 'custom_word:7', 'N4:pending:both': 'word:9', __deck: 'unknown',
  });
});

test('rejects malformed ids and keys', async () => {
  for (const [id, key] of [
    ['N9:all:kana', 'word:1'], ['N5:due:kana', 'word:1'], ['N5:all:romaji', 'word:1'], ['anything', 'word:1'],
    ['N5:all:kana', 'kanji:1'], ['N5:all:kana', 'word:abc'], ['__deck', 'everything'],
  ]) {
    assert.equal((await put(id, key)).status, 400, `${id} -> ${key}`);
  }
});

test("users don't see each other's bookmarks", async () => {
  await put('N3:all:kana', 'word:5', 'other-user');
  assert.ok(!('N3:all:kana' in (await get()).body));
  assert.deepEqual((await get('other-user')).body, { 'N3:all:kana': 'word:5' });
});
