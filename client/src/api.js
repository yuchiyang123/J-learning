import { getStoredLocale } from './i18n/LocaleContext.jsx';

const BASE = '/api';
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Double-submit CSRF cookie: the server hands the token back in this
// response body (the cookie itself is httpOnly, unreadable from JS), and
// every write echoes it in a header the server checks against the cookie.
// Cached across calls since it's valid for the cookie's 4h lifetime; on a
// 403 (e.g. first load raced the cookie, or it expired) we refetch once.
let csrfTokenPromise = null;
function getCsrfToken(forceRefresh = false) {
  if (forceRefresh) csrfTokenPromise = null;
  csrfTokenPromise ??= fetch(`${BASE}/csrf`, { credentials: 'include' })
    .then((r) => r.json())
    .then((b) => b.csrfToken);
  return csrfTokenPromise;
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isWrite = WRITE_METHODS.has(method);
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (isWrite) headers['X-CSRF-TOKEN'] = await getCsrfToken();

  let res = await fetch(BASE + path, { credentials: 'include', ...options, headers });
  if (res.status === 403 && isWrite) {
    headers['X-CSRF-TOKEN'] = await getCsrfToken(true);
    res = await fetch(BASE + path, { credentials: 'include', ...options, headers });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Content endpoints (words/kanji/grammar/quiz) always send the viewer's current
// UI locale so the server can return translated meanings/explanations/options —
// see server/src/locale.js. Read fresh on every call so switching language
// mid-session takes effect on the next fetch without every caller passing it.
function withLocale(params) {
  params.set('locale', getStoredLocale());
  return params;
}

export const api = {
  getWords: (level) => request(`/words?${withLocale(new URLSearchParams(level ? { level } : {}))}`),
  addCustomWord: (payload) => request('/words/custom', { method: 'POST', body: JSON.stringify(payload) }),
  deleteCustomWord: (id) => request(`/words/custom/${id}`, { method: 'DELETE' }),
  getKanji: (level) => request(`/kanji?${withLocale(new URLSearchParams(level ? { level } : {}))}`),
  getGrammar: (level) => request(`/grammar?${withLocale(new URLSearchParams(level ? { level } : {}))}`),
  getQuiz: ({ type, level, count, includeAnswers } = {}) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (level) params.set('level', level);
    if (count) params.set('count', count);
    if (includeAnswers) params.set('includeAnswers', '1');
    return request(`/quiz?${withLocale(params)}`);
  },
  // Grades and returns results even when logged out; only persisted to
  // history/stats when the caller has a valid session (see server route).
  submitQuiz: (payload) => request('/quiz/submit', { method: 'POST', body: JSON.stringify({ locale: getStoredLocale(), ...payload }) }),
  getQuizHistory: () => request('/quiz/history'),
  getQuizHistoryDetail: (id) => request(`/quiz/history/${id}?${withLocale(new URLSearchParams())}`),
  getQuizWrong: ({ type, level, count } = {}) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (level) params.set('level', level);
    if (count) params.set('count', count);
    return request(`/quiz/wrong?${withLocale(params)}`);
  },
  submitKanaWrite: (payload) => request('/quiz/kana-write/submit', { method: 'POST', body: JSON.stringify(payload) }),
  getKanaWriteWrong: (script) => request(`/quiz/kana-write/wrong${script ? `?script=${script}` : ''}`),
  getProgress: () => request('/progress'),
  reviewProgress: (payload) => request('/progress/review', { method: 'POST', body: JSON.stringify(payload) }),
  clearProgress: ({ itemType, itemId }) => request(`/progress/${itemType}/${itemId}`, { method: 'DELETE' }),
  getStats: () => request('/progress/stats'),
  logSpeaking: (payload) => request('/speaking', { method: 'POST', body: JSON.stringify(payload) }),
  getSpeakingHistory: () => request('/speaking'),

  saveGameScore: (payload) => request('/games/score', { method: 'POST', body: JSON.stringify(payload) }),
  getGameBest: ({ game, mode, level } = {}) => {
    const params = new URLSearchParams({ game });
    if (mode) params.set('mode', mode);
    if (level) params.set('level', level);
    return request(`/games/best?${params.toString()}`);
  },
  getGameHistory: ({ game } = {}) => {
    const params = new URLSearchParams();
    if (game) params.set('game', game);
    return request(`/games/history?${params.toString()}`);
  },
  getGameLeaderboard: ({ game, mode, level, limit } = {}) => {
    const params = new URLSearchParams({ game });
    if (mode) params.set('mode', mode);
    if (level) params.set('level', level);
    if (limit) params.set('limit', limit);
    return request(`/games/leaderboard?${params.toString()}`);
  },

  getUserProfile: () => request('/users/me'),
  updateUserProfile: (payload) => request('/users/profile', { method: 'POST', body: JSON.stringify(payload) }),
};
