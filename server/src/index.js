import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');

import wordsRouter from './routes/words.js';
import kanjiRouter from './routes/kanji.js';
import grammarRouter from './routes/grammar.js';
import quizRouter from './routes/quiz.js';
import progressRouter from './routes/progress.js';
import speakingRouter from './routes/speaking.js';
import gamesRouter from './routes/games.js';
import usersRouter from './routes/users.js';

const ALLOWED_ORIGINS = [
  'https://j-learning.matthewyu.uk',
  'http://localhost:5173',
  'http://localhost:5176',
];

const app = express();

// Cloudflare Tunnel sits in front of this process, so req.ip / X-Forwarded-For
// must be trusted for rate limiting to key on the real client IP instead of
// the tunnel's.
app.set('trust proxy', 1);

app.use(helmet({
  // The client is a same-origin SPA with no user-supplied HTML rendering
  // (React escapes all output), so CSP isn't load-bearing for XSS here.
  // Left off rather than shipping an untested policy that could silently
  // break Google Fonts or the anti-flash inline <script> in index.html.
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '50kb' }));

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/progress/review', writeLimiter);
app.use('/api/speaking', writeLimiter);
app.use('/api/games/score', writeLimiter);
app.use('/api/quiz/submit', writeLimiter);
app.use('/api/users/profile', writeLimiter);

app.use('/api/words', wordsRouter);
app.use('/api/kanji', kanjiRouter);
app.use('/api/grammar', grammarRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/progress', progressRouter);
app.use('/api/speaking', speakingRouter);
app.use('/api/games', gamesRouter);
app.use('/api/users', usersRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Catch-all error handler: never let a stack trace or internal error detail
// reach the client, regardless of NODE_ENV.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`JP learning API listening on http://localhost:${PORT}`);
});
