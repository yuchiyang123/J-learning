import { db } from './db.js';

// Every route that receives a userId calls touchUser() first so a `users` row
// always exists for it — this is the seam future login work plugs into: once
// real auth exists, swap the id this receives for the authenticated account id
// (and/or call attachProfile() to save email/display_name) without touching any
// of the other tables, since they all just store whatever id touchUser() was
// given.
const upsert = db.prepare(`
  INSERT INTO users (id, last_seen_at) VALUES (?, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET last_seen_at = datetime('now')
`);

export function touchUser(userId) {
  if (!userId) return;
  upsert.run(userId);
}

export function getUser(userId) {
  if (!userId) return null;
  return db.prepare('SELECT id, email, display_name, created_at, last_seen_at FROM users WHERE id = ?').get(userId) || null;
}

const updateProfile = db.prepare(`
  UPDATE users SET email = COALESCE(?, email), display_name = COALESCE(?, display_name) WHERE id = ?
`);

export function attachProfile(userId, { email, displayName } = {}) {
  touchUser(userId);
  updateProfile.run(email ?? null, displayName ?? null, userId);
  return getUser(userId);
}
