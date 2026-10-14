// Flashcard bookmarks: which card each deck was on, and which deck was open.
//
// Kept on the device for an instant start, and — when logged in — synced
// to the account (PUT/GET /api/progress/bookmarks) so they follow you
// across devices. Conflicts are settled without comparing clocks: a local
// change not yet confirmed by the server is "dirty" and wins over what the
// server says; anything else is replaced by the server's value on load.
//
// Ids: 'N5:all:kana' (level:deck:front) -> 'word:12'; DECK_ID -> 'all' etc.
import { api } from '../api.js';

const STORAGE_KEY = 'jp_vocab_bookmarks';
const LEGACY_DECK_KEY = 'jp_vocab_deck';
export const DECK_ID = '__deck';
const PUSH_DELAY_MS = 800;

function readAll() {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { /* unavailable */ }
  // Earlier versions stored a bare key string per id, and the deck apart.
  for (const [id, v] of Object.entries(all)) if (typeof v === 'string') all[id] = { key: v, dirty: true };
  try {
    const legacyDeck = localStorage.getItem(LEGACY_DECK_KEY);
    if (legacyDeck && !all[DECK_ID]) all[DECK_ID] = { key: legacyDeck, dirty: true };
  } catch { /* unavailable */ }
  return all;
}

function writeAll(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    localStorage.removeItem(LEGACY_DECK_KEY);
  } catch { /* unavailable */ }
}

export function getBookmark(id) {
  return readAll()[id]?.key ?? null;
}

const timers = new Map();

function push(id) {
  const entry = readAll()[id];
  const key = entry ? entry.key : null;
  return api.putBookmark({ id, key }).then(() => {
    const all = readAll();
    // Only mark it synced if nothing changed while the request was out.
    if (all[id] && all[id].key === key) { all[id].dirty = false; writeAll(all); }
  }).catch(() => { /* stays dirty; pushed again on the next load */ });
}

// Records a bookmark; when `sync` (logged in), sends it to the server
// shortly after — moving through cards quickly sends one request, not many.
export function setBookmark(id, key, { sync = false } = {}) {
  const all = readAll();
  // Always dirty until the server confirms it: a change made while logged
  // out is sent to the account at the next login.
  all[id] = { key: key || null, dirty: true };
  writeAll(all);
  if (!sync) return;
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => { timers.delete(id); push(id); }, PUSH_DELAY_MS));
}

// Logged in: adopt the account's bookmarks (except this device's unsent
// changes, which are sent now). Resolves to true if anything local changed.
export async function syncBookmarks() {
  const server = await api.getBookmarks();
  const all = readAll();
  let changed = false;
  for (const [id, key] of Object.entries(server || {})) {
    if (all[id]?.dirty) continue;
    if (all[id]?.key !== key) { all[id] = { key, dirty: false }; changed = true; }
  }
  for (const [id, entry] of Object.entries(all)) {
    if (!entry.dirty && !(id in (server || {}))) { delete all[id]; changed = true; }
  }
  writeAll(all);
  for (const [id, entry] of Object.entries(all)) if (entry.dirty) push(id);
  return changed;
}
