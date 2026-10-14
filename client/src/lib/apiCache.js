// Small response cache shared across the app.
//
// Memory layer: module-scope, survives component unmount/remount within a
// session (navigating away and back) but resets on reload.
//
// Persistent layer (opt-in per key, see useCachedApi's `persist`): a copy in
// localStorage so read-only content — word / kanji / grammar lists — shows
// instantly on the next visit too. Every request to this site takes a long
// round trip for some networks (Cloudflare routes HiNet traffic to overseas
// edges), so not re-downloading a list before showing it is the biggest
// single win. Persisted entries are always revalidated in the background.
//
// There's deliberately no global state library (Redux/Zustand) in this
// project; this is the minimal thing that solves "don't wait for content
// that hasn't changed" plus "invalidate after a write".
const cache = new Map();
const PERSIST_PREFIX = 'jp_cache:v1:';

export function getCached(key) {
  return cache.has(key) ? cache.get(key) : undefined;
}

export function setCached(key, value) {
  cache.set(key, value);
}

export function getPersisted(key) {
  try {
    const raw = localStorage.getItem(PERSIST_PREFIX + key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function setPersisted(key, value) {
  try {
    localStorage.setItem(PERSIST_PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota full or storage blocked: drop the older copies and carry on
    // without persisting — the memory cache still works.
    clearPersisted('');
  }
}

function clearPersisted(prefix) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PERSIST_PREFIX + prefix)) localStorage.removeItem(k);
    }
  } catch { /* storage unavailable */ }
}

// Drops every cached entry whose key starts with `prefix` — pass a full key
// to drop just that one entry, or a shared prefix (e.g. 'words:N5:') to drop
// a family of keys at once. Call this right after any mutation that could
// make a cached read stale (adding/deleting a custom word, submitting a
// kana-write quiz that changes the mistake-book count, ...).
export function invalidateCache(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  clearPersisted(prefix);
}
