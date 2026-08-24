// Tiny in-memory response cache shared across the app. Module-scope, so it
// survives component unmount/remount within a session (e.g. navigating away
// from Vocabulary and back) but resets on a full page reload — no need for
// anything heavier, since nothing here has to survive a reload or be shared
// across tabs. There's deliberately no global state library (Redux/Zustand)
// in this project; this is the minimal thing that solves "don't refetch
// content that hasn't changed" plus "invalidate after a write".
const cache = new Map();

export function getCached(key) {
  return cache.has(key) ? cache.get(key) : undefined;
}

export function setCached(key, value) {
  cache.set(key, value);
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
}
