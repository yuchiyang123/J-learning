import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'app.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
-- Canonical user registry. "id" is whatever identifier the client currently has —
-- today that's the random id generated into localStorage by getUserId() on the
-- frontend, tomorrow it can be a real authenticated account id/email. Every table
-- below stores that same value in its user_id column, so once a login system
-- exists, records "just work" as long as the client keeps sending the same id
-- (see server/src/users.js for the resolve/attach helpers this points at).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,             -- N5..N1
  kanji TEXT,                      -- may be null if kana-only word
  kana TEXT NOT NULL,
  meaning TEXT NOT NULL,
  part_of_speech TEXT,
  example_jp TEXT,
  example_reading TEXT,
  example_zh TEXT
);

CREATE TABLE IF NOT EXISTS kanji (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  character TEXT NOT NULL,
  onyomi TEXT,
  kunyomi TEXT,
  meaning TEXT NOT NULL,
  stroke_count INTEGER
);

CREATE TABLE IF NOT EXISTS grammar_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  pattern TEXT NOT NULL,
  meaning TEXT NOT NULL,
  explanation TEXT,
  example_jp TEXT,
  example_reading TEXT,
  example_zh TEXT
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,              -- vocab | kanji | grammar | listening
  level TEXT NOT NULL,             -- N5..N1
  prompt TEXT NOT NULL,            -- question text (may be spoken via TTS for listening type)
  audio_text TEXT,                 -- text to speak via TTS (listening questions)
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  answer TEXT NOT NULL,            -- 'a' | 'b' | 'c' | 'd'
  explanation TEXT
);

CREATE TABLE IF NOT EXISTS user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,         -- word | kanji
  item_id INTEGER NOT NULL,
  srs_level INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed TEXT,
  next_review TEXT,
  UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  level TEXT NOT NULL,
  total INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  taken_at TEXT NOT NULL DEFAULT (datetime('now')),
  detail TEXT                      -- JSON string of per-question results
);

CREATE TABLE IF NOT EXISTS speaking_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  target_text TEXT NOT NULL,
  recognized_text TEXT,
  score REAL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User-authored vocabulary entries, private to the owner. Kept separate from
-- "words" (the shared seeded dictionary) so custom entries never collide with
-- public word ids; reviewProgress tags these with item_type 'custom_word' to
-- keep their SRS state independent of the public word with the same numeric id.
CREATE TABLE IF NOT EXISTS user_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  level TEXT NOT NULL,
  kanji TEXT,
  kana TEXT NOT NULL,
  meaning TEXT NOT NULL,
  part_of_speech TEXT,
  example_jp TEXT,
  example_reading TEXT,
  example_zh TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  game TEXT NOT NULL,               -- 'memory' | 'blitz' | 'falling'
  mode TEXT,                        -- category/type, e.g. 'vocab', 'kana'
  level TEXT,                       -- JLPT level, when applicable
  score INTEGER NOT NULL,
  detail TEXT,                      -- JSON string of extra stats (moves/time, combo, lives...)
  played_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every per-user read (history, stats, leaderboards) filters by these columns;
-- without an index each one is a full table scan that gets linearly slower
-- as usage accumulates rows.
CREATE INDEX IF NOT EXISTS idx_quiz_results_user ON quiz_results(user_id, taken_at);
CREATE INDEX IF NOT EXISTS idx_speaking_attempts_user ON speaking_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_words_user ON user_words(user_id, level);
CREATE INDEX IF NOT EXISTS idx_game_scores_lookup ON game_scores(game, mode, level, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id, game, played_at);
`);
