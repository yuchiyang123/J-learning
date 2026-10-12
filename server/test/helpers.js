// Test harness: an in-memory database and the real routers mounted on a
// bare express app (no CSRF / rate limiting — those are covered by the
// app wiring, not by these route tests). node --test runs each file in its
// own process, so every test file starts from an empty database.
//
// Environment must be set before the app modules load (db.js and auth.js
// read it at import time), hence the dynamic imports.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ISSUER = 'test-issuer';
process.env.JWT_AUDIENCE = 'test-audience';

const { default: express } = await import('express');
const { default: cookieParser } = await import('cookie-parser');
const { default: jwt } = await import('jsonwebtoken');
export const { db } = await import('../src/db.js');
const { default: progressRouter } = await import('../src/routes/progress.js');
const { default: quizRouter } = await import('../src/routes/quiz.js');

export function tokenFor(userId) {
  return jwt.sign({ sub: userId }, 'test-secret', { algorithm: 'HS256', issuer: 'test-issuer', audience: 'test-audience' });
}

export async function startApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(cookieParser());
  app.use('/api/progress', progressRouter);
  app.use('/api/quiz', quizRouter);
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, { user, body } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { Cookie: `token=${tokenFor(user)}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { call, close: () => new Promise((r) => server.close(r)) };
}

export function addWord(level, kanji, kana, meaning = 'm') {
  return db.prepare('INSERT INTO words (level, kanji, kana, meaning) VALUES (?,?,?,?)').run(level, kanji, kana, meaning).lastInsertRowid;
}

// Inserts a progress row whose next review is `offset` from now, in SQLite
// datetime modifier form ('-2 days', '+1 day', '+0 days').
export function addProgress(userId, itemType, itemId, offset, srsLevel = 1) {
  db.prepare(
    `INSERT INTO user_progress (user_id, item_type, item_id, srs_level, last_reviewed, next_review)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now', ?))`
  ).run(userId, itemType, itemId, srsLevel, offset);
}

export function srsLevel(userId, itemType, itemId) {
  return db.prepare('SELECT srs_level FROM user_progress WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .get(userId, itemType, itemId)?.srs_level;
}
