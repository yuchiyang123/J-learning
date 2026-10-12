import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, startApp, addWord, addProgress, srsLevel } from './helpers.js';
const { practiceUpdatesSrs } = await import('../src/srs.js');

let app;
const U = 'user-practice';
let w;

before(async () => { app = await startApp(); });
after(() => app.close());

function submit(mode, prompt, isCorrect, user = U) {
  return app.call('POST', '/api/quiz/vocab-practice/submit', {
    user,
    body: { mode, prompt, level: 'N5', items: [{ wordKey: `word:${w}`, prompt: 'x', answer: 'y', given: 'z', isCorrect }] },
  });
}
// Each test starts from a fresh word at srs_level 2.
function freshWord() {
  w = addWord('N5', '本', 'ほん');
  addProgress(U, 'word', w, '+3 days', 2);
}
const historyCount = () => db.prepare('SELECT COUNT(*) AS n FROM quiz_results WHERE user_id = ?').get(U).n;

test('only typing/tiles with the kanji prompt count as a recognition review', () => {
  const yes = [['typing', 'kanji'], ['tiles', 'kanji']];
  const no = [
    ['typing', 'meaning'], ['typing', 'audio'], ['tiles', 'meaning'], ['tiles', 'audio'],
    ['handwrite', 'kanji'], ['handwrite', 'meaning'], ['handwrite', 'audio'],
    ['kanji', 'reading'], ['kanji', 'kanji'],
    ['typing', undefined], ['tiles', null],
  ];
  for (const [m, p] of yes) assert.equal(practiceUpdatesSrs(m, p), true, `${m}/${p}`);
  for (const [m, p] of no) assert.equal(practiceUpdatesSrs(m, p), false, `${m}/${p}`);
});

test('a wrong answer in handwrite mode leaves srs_level unchanged but is saved to history', async () => {
  freshWord();
  const before = historyCount();
  const r = await submit('handwrite', 'kanji', false);
  assert.equal(r.status, 200);
  assert.equal(r.body.srsUpdated, false);
  assert.equal(srsLevel(U, 'word', w), 2);
  assert.equal(historyCount(), before + 1);
});

test('self-graded kanji writing never touches SRS, right or wrong', async () => {
  freshWord();
  await submit('kanji', 'reading', false);
  assert.equal(srsLevel(U, 'word', w), 2);
  await submit('kanji', 'reading', true);
  assert.equal(srsLevel(U, 'word', w), 2);
});

test('production prompts (meaning, audio) do not touch SRS', async () => {
  freshWord();
  await submit('typing', 'meaning', false);
  await submit('typing', 'audio', false);
  await submit('tiles', 'meaning', true);
  assert.equal(srsLevel(U, 'word', w), 2);
});

test('a missing prompt is treated as non-recognition', async () => {
  freshWord();
  await submit('typing', undefined, false);
  assert.equal(srsLevel(U, 'word', w), 2);
});

test('typing from the kanji prompt: wrong resets to 0, right goes up one', async () => {
  freshWord();
  const r = await submit('typing', 'kanji', false);
  assert.equal(r.body.srsUpdated, true);
  assert.equal(srsLevel(U, 'word', w), 0);
  await submit('tiles', 'kanji', true);
  assert.equal(srsLevel(U, 'word', w), 1);
});

test('a word never reviewed before gets no SRS row from a production run', async () => {
  w = addWord('N5', '水', 'みず');
  await submit('handwrite', 'kanji', false);
  assert.equal(srsLevel(U, 'word', w), undefined);
});

test('logged out: graded and returned, nothing persisted', async () => {
  freshWord();
  const before = historyCount();
  const r = await submit('typing', 'kanji', false, null);
  assert.equal(r.status, 200);
  assert.equal(r.body.srsUpdated, false);
  assert.equal(historyCount(), before);
  assert.equal(srsLevel(U, 'word', w), 2);
});
