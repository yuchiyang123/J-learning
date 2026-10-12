// The response-time columns are added to an existing database without
// touching its rows. Builds a database file with the old user_progress
// schema, then loads the app's db module on top of it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jlearn-mig-')), 'old.db');
const old = new Database(file);
old.exec(`
  CREATE TABLE user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL, item_type TEXT NOT NULL, item_id INTEGER NOT NULL,
    srs_level INTEGER NOT NULL DEFAULT 0, correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0, last_reviewed TEXT, next_review TEXT,
    UNIQUE(user_id, item_type, item_id)
  );
  INSERT INTO user_progress (user_id, item_type, item_id, srs_level, correct_count, wrong_count, last_reviewed, next_review)
  VALUES ('old-user', 'word', 7, 3, 5, 1, '2026-01-01 00:00:00', '2026-01-08 00:00:00');
`);
old.close();

process.env.DB_PATH = file;
const { db } = await import('./helpers.js');
after(() => db.close());

test('adds last_response_ms / avg_response_ms and keeps existing rows intact', () => {
  const cols = db.prepare('PRAGMA table_info(user_progress)').all().map((c) => c.name);
  assert.ok(cols.includes('last_response_ms'));
  assert.ok(cols.includes('avg_response_ms'));
  const r = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get('old-user');
  assert.equal(r.srs_level, 3);
  assert.equal(r.correct_count, 5);
  assert.equal(r.next_review, '2026-01-08 00:00:00');
  assert.equal(r.last_response_ms, null);
  assert.equal(r.avg_response_ms, null);
});

test('creates the review_log table', () => {
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'review_log'").get();
  assert.ok(t);
});
