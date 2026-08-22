// Thin wrappers around browser Web Speech API (SpeechSynthesis + SpeechRecognition).

// Voice list loads asynchronously on most mobile browsers — the first call to
// getVoices() right after page load often returns an empty array, so cache it
// and refresh on the voiceschanged event rather than reading it fresh (and
// possibly empty) every time speak() runs.
let cachedVoices = [];

function refreshVoices() {
  if ('speechSynthesis' in window) cachedVoices = window.speechSynthesis.getVoices();
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;

  // iOS Safari silently drops the first speechSynthesis.speak() call unless
  // the engine has already been "used" inside a real user gesture earlier in
  // the page's life. Prime it on the user's very first tap anywhere.
  const unlock = () => {
    try {
      const warm = new SpeechSynthesisUtterance(' ');
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    } catch {
      // best-effort priming only
    }
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
}

function pickVoice(lang) {
  if (!cachedVoices.length) refreshVoices();
  const base = lang.split('-')[0];
  return (
    cachedVoices.find((v) => v.lang === lang) ||
    cachedVoices.find((v) => v.lang?.toLowerCase().startsWith(base)) ||
    null
  );
}

export function speak(text, { rate = 0.9, lang = 'ja-JP' } = {}) {
  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis not supported in this browser.');
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = rate;
  const voice = pickVoice(lang);
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

export function isRecognitionSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createRecognizer({ lang = 'ja-JP' } = {}) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognizer = new Ctor();
  recognizer.lang = lang;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  return recognizer;
}

// Simple normalized similarity score (0-100) between recognized text and target text.
// Uses Levenshtein distance over the two strings after stripping whitespace/punctuation.
export function similarityScore(target, recognized) {
  const clean = (s) =>
    (s || '')
      .replace(/[\s。、！？「」『』・,.!?]/g, '')
      .trim();
  const a = clean(target);
  const b = clean(recognized);
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const score = Math.max(0, 1 - dist / maxLen);
  return Math.round(score * 100);
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
