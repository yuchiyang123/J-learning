import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from './helpers.js';
const extra = await import('../src/grammarAdditions.js');
const { applyGrammarAdditions, loadGrammarAdditions } = extra;
const { translate } = await import('../src/locale.js');

const additions = loadGrammarAdditions();
const n5 = () => db.prepare("SELECT * FROM grammar_points WHERE level = 'N5' ORDER BY id").all();
const quiz = () => db.prepare("SELECT * FROM quiz_questions WHERE type = 'grammar' AND level = 'N5'").all();

test('the data file is well formed', () => {
  assert.ok(additions.length >= 50);
  assert.equal(new Set(additions.map((g) => g.pattern)).size, additions.length);
  for (const g of additions) {
    for (const lang of ['zh', 'en', 'ko']) for (const f of ['meaning', 'explanation', 'example']) assert.ok(g[lang][f], `${g.pattern} ${lang}.${f}`);
    assert.ok(g.example_jp && g.example_reading, g.pattern);
    assert.equal(g.quiz.options.length, 4, g.pattern);
    assert.equal(new Set(g.quiz.options).size, 4, g.pattern);
    assert.ok(g.quiz.answer >= 0 && g.quiz.answer < 4, g.pattern);
  }
});

test('inserts every point with a meaning and a fill-in question, once', () => {
  // an existing point with the same pattern is left alone
  db.prepare("INSERT INTO grammar_points (level, pattern, meaning) VALUES ('N5', ?, '舊的')").run(additions[0].pattern);
  const before = n5();
  assert.equal(applyGrammarAdditions(db), additions.length - 1);
  const rows = n5();
  assert.equal(rows.length, additions.length);
  assert.deepEqual(rows[0], before[0]);
  const qs = quiz();
  assert.equal(qs.length, (additions.length - 1) * 2);
  for (const q of qs) {
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
    assert.equal(new Set(opts).size, 4, q.prompt);
  }
  const g = additions[5];
  const fill = qs.find((q) => q.prompt === g.quiz.prompt);
  assert.equal(fill[`option_${fill.answer}`], g.quiz.options[g.quiz.answer]);
  const meaning = qs.find((q) => q.prompt === `「${g.pattern}」の意味は？`);
  assert.equal(meaning[`option_${meaning.answer}`], g.zh.meaning);
  // answers aren't all in the same slot
  assert.ok(new Set(qs.map((q) => q.answer)).size >= 3);

  assert.equal(applyGrammarAdditions(db), 0);
  assert.equal(n5().length, additions.length);
  assert.equal(quiz().length, (additions.length - 1) * 2);
});

test('the added text has English and Korean', () => {
  const g = additions[3];
  assert.equal(translate(g.zh.meaning, 'en'), g.en.meaning);
  assert.equal(translate(g.zh.explanation, 'ko'), g.ko.explanation);
  assert.equal(translate(`${g.pattern}＝${g.zh.meaning}`, 'en'), `${g.pattern}＝${g.en.meaning}`);
  assert.equal(translate(g.zh.example, 'zh-TW'), g.zh.example);
});

test('extra fill-in questions go to existing seed points, once', () => {
  const { loadExtraGrammarQuiz } = extra;
  const q = loadExtraGrammarQuiz()[0];
  db.prepare("INSERT INTO grammar_points (level, pattern, meaning) VALUES (?, ?, '請〜')").run(q.level, q.pattern);
  applyGrammarAdditions(db);
  applyGrammarAdditions(db);
  const rows = db.prepare("SELECT * FROM quiz_questions WHERE prompt = ?").all(q.prompt);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][`option_${rows[0].answer}`], q.options[0]);
  assert.equal(rows[0].explanation, `${q.pattern}＝請〜`);
});

test('GET /api/grammar/practice ties every question to its point', async () => {
  const { default: express } = await import('express');
  const { default: grammarRouter } = await import('../src/routes/grammar.js');
  const app = express();
  app.use('/api/grammar', grammarRouter);
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/grammar/practice`;
    assert.equal((await fetch(base)).status, 400);
    const list = await (await fetch(`${base}?level=N5&locale=en`)).json();
    const ids = new Map(n5().map((g) => [g.id, g]));
    assert.ok(list.length > 0);
    for (const q of list) {
      assert.ok(ids.has(q.grammarId), q.prompt);
      assert.ok(['a', 'b', 'c', 'd'].includes(q.answer));
      assert.equal(q.options.length, 4);
      assert.ok(q.explanation.startsWith(`${ids.get(q.grammarId).pattern}＝`));
    }
    const g = additions[2];
    const meaning = list.find((q) => q.kind === 'meaning' && q.prompt === `「${g.pattern}」の意味は？`);
    assert.equal(meaning.options[['a', 'b', 'c', 'd'].indexOf(meaning.answer)], g.en.meaning);
    const fill = list.find((q) => q.kind === 'fill' && q.prompt === g.quiz.prompt);
    assert.equal(fill.options[['a', 'b', 'c', 'd'].indexOf(fill.answer)], g.quiz.options[g.quiz.answer]);
  } finally {
    server.close();
  }
});
