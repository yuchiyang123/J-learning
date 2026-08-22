import { getStoredLocale } from './i18n/LocaleContext.jsx';

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
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
  getProgress: () => request('/progress'),
  reviewProgress: (payload) => request('/progress/review', { method: 'POST', body: JSON.stringify(payload) }),
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
