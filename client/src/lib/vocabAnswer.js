// Answer checking for the vocabulary practice modes: what counts as a
// correct reading, where a wrong one went wrong, and which classic learner
// mistake it looks like.
import { seion, dakuon, handakuon } from '../data/kana.js';

// Dictionary readings come in shapes like "いい; よい", "～かい",
// "けっこん (する)" — split variants, drop the ～ affix marker and
// parenthesised extras, so each variant is a plain typeable reading.
function variants(text) {
  if (!text) return [];
  return text
    .split(/[;；、,]/)
    .map((v) => v.replace(/[(（][^)）]*[)）]/g, '').replace(/[～〜~\s]/g, '').trim())
    .filter(Boolean);
}
export const readingVariants = (word) => variants(word.kana);
export const kanjiVariants = (word) => variants(word.kanji);

// The reading used when a single answer has to be shown or built (tiles,
// handwriting): the first variant, as written in the dictionary.
export const primaryReading = (word) => readingVariants(word)[0] ?? '';
export const primaryKanji = (word) => kanjiVariants(word)[0] ?? '';

export function toHiragana(s) {
  return [...s].map((c) => {
    const code = c.charCodeAt(0);
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : c;
  }).join('');
}
const norm = (s) => toHiragana(s.normalize('NFKC').replace(/[\s～〜~]/g, ''));

// Katakana and hiragana count the same when typing (romaji input always
// produces hiragana), so コーヒー accepts こーひー.
export function checkAnswer(given, word, { acceptKanji = false } = {}) {
  const g = norm(given);
  const pool = [...readingVariants(word), ...(acceptKanji ? kanjiVariants(word) : [])];
  const hit = pool.find((v) => norm(v) === g);
  return { correct: !!hit && g.length > 0, matched: hit ?? null };
}

// Character diff between what was typed and the answer (LCS alignment),
// rendered in the answer's own script: 'same' chars, chars 'missing' from
// the attempt, and 'extra' chars the attempt had that the answer doesn't.
export function diffAnswer(given, answer) {
  const a = [...norm(given)];
  const bOrig = [...answer];
  const b = bOrig.map((c) => toHiragana(c));
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  const push = (type, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text; else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push('same', bOrig[j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push('extra', a[i]); i++; }
    else { push('missing', bOrig[j]); j++; }
  }
  while (i < n) push('extra', a[i++]);
  while (j < m) push('missing', bOrig[j++]);
  return out;
}

// ---------- typical mistake detection ----------

const VOWEL_OF = new Map();
for (const row of [...seion, ...dakuon, ...handakuon]) {
  for (const cell of row.cells) {
    if (!cell) continue;
    const r = cell[2];
    VOWEL_OF.set(cell[0], r === 'n' ? null : r[r.length - 1]);
  }
}
for (const [c, v] of [['ゃ', 'a'], ['ゅ', 'u'], ['ょ', 'o'], ['ぁ', 'a'], ['ぃ', 'i'], ['ぅ', 'u'], ['ぇ', 'e'], ['ぉ', 'o']]) VOWEL_OF.set(c, v);
// Vowels that lengthen the one before (おう, えい, ああ, いい, うう, ええ, おお).
const LENGTHENS = { a: 'あ', i: 'い', u: 'う', e: 'えい', o: 'おう' };

function stripLong(s) {
  let out = '';
  for (const c of s) {
    if (c === 'ー') continue;
    const prev = out[out.length - 1];
    const v = prev && VOWEL_OF.get(prev);
    if (v && LENGTHENS[v].includes(c)) continue;
    out += c;
  }
  return out;
}
const stripSokuon = (s) => s.replace(/っ/g, '');
const stripDakuten = (s) => s.normalize('NFD').replace(/[゙゚]/g, '').normalize('NFC');
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', っ: 'つ', ゎ: 'わ' };
const enlargeSmall = (s) => [...s].map((c) => SMALL[c] ?? c).join('');

// Returns an i18n key naming the mistake, or null. Checked against every
// accepted reading so a near-miss on any variant is recognised.
export function mistakeKind(given, word) {
  const g = norm(given);
  if (!g) return null;
  for (const v of readingVariants(word)) {
    const a = norm(v);
    if (a === g) return null;
    if (stripLong(a) === stripLong(g)) return 'vp_mistake_long_vowel';
    if (stripSokuon(a) === stripSokuon(g)) return 'vp_mistake_sokuon';
    if (stripDakuten(a) === stripDakuten(g)) return 'vp_mistake_dakuten';
    if (enlargeSmall(a) === enlargeSmall(g)) return 'vp_mistake_small_kana';
  }
  return null;
}

// Characters handwriting recognition can score: small kana are matched
// against their full-size shape (the stroke data only has full-size), and
// ー has no stroke data at all.
export function recognitionChar(c) {
  const h = toHiragana(c);
  const big = SMALL[h];
  if (!big) return c;
  return c === h ? big : String.fromCharCode(big.charCodeAt(0) + 0x60);
}

const ALL_HIRA = [...seion, ...dakuon, ...handakuon].flatMap((r) => r.cells.filter(Boolean).map((c) => c[0]));
const ALL_KATA = [...seion, ...dakuon, ...handakuon].flatMap((r) => r.cells.filter(Boolean).map((c) => c[1]));

// Tile distractors: plausible kana in the answer's script (preferring
// look-alikes / sound-alikes of the answer's own characters) that don't
// already appear in it.
export function distractorsFor(answer, count) {
  const isKata = /[ァ-ヶ]/.test(answer);
  const pool = isKata ? ALL_KATA : ALL_HIRA;
  const used = new Set(answer);
  const near = [];
  for (const c of answer) {
    const h = toHiragana(c);
    const flip = stripDakuten(h) !== h ? stripDakuten(h) : null; // が -> か
    const voiced = (h + '゙').normalize('NFC');              // か -> が
    for (const cand of [flip, voiced.length === 1 ? voiced : null, SMALL[h]]) {
      if (!cand) continue;
      const shown = isKata ? String.fromCharCode(cand.charCodeAt(0) + 0x60) : cand;
      if (!used.has(shown) && !near.includes(shown)) near.push(shown);
    }
  }
  const random = pool.filter((c) => !used.has(c) && !near.includes(c));
  for (let i = random.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [random[i], random[j]] = [random[j], random[i]];
  }
  const picked = near.sort(() => Math.random() - 0.5).slice(0, Math.ceil(count / 2));
  return [...picked, ...random].slice(0, count);
}
