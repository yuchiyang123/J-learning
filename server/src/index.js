import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
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

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`JP learning API listening on http://localhost:${PORT}`);
});
