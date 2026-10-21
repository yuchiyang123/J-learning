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

// A word "has kanji" when its written form actually contains kanji and
// isn't just its reading again (some entries repeat the kana there).
export const hasKanji = (word) =>
  /[㐀-鿿]/.test(primaryKanji(word)) && toHiragana(primaryKanji(word)) !== toHiragana(primaryReading(word));

export function toHiragana(s) {
  return [...s].map((c) => {
    const code = c.charCodeAt(0);
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : c;
  }).join('');
}
const norm = (s) => toHiragana(s.normalize('NFKC').replace(/[\s～〜~]/g, ''));

// Katakana and hiragana count the same when typing (romaji input always
// produces hiragana), so コーヒー accepts こーひー.
// Typing every reading of a multi-reading word (いい; よい -> "いい;よい",
// "いい／よい") is right too, as long as each part is one of its readings.
export function checkAnswer(given, word, { acceptKanji = false } = {}) {
  const g = norm(given);
  const pool = [...readingVariants(word), ...(acceptKanji ? kanjiVariants(word) : [])];
  const hit = pool.find((v) => norm(v) === g);
  if (hit || !g) return { correct: !!hit && g.length > 0, matched: hit ?? null };
  const parts = given.split(/[;；、,，/／・\s]+/).map(norm).filter(Boolean);
  const all = parts.length > 1 && parts.every((part) => pool.some((v) => norm(v) === part));
  return { correct: all, matched: all ? pool.find((v) => norm(v) === parts[0]) : null };
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
    // っ written full size (がつこう for がっこう) is a 促音 slip, not one of
    // the ゃゅょ small-kana ones — check it before the small-kana rule.
    if (a.replace(/っ/g, 'つ') === g.replace(/っ/g, 'つ') && a.includes('っ') !== g.includes('っ')) return 'vp_mistake_sokuon';
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

// ---------- confusable readings (易混淆辨別) ----------
//
// Wrong-but-plausible versions of a reading, one per classic learner
// mistake: a voicing mark added or dropped (ひらがな / ひらかな), a small
// kana written large or the reverse (きょう / きよう), a small っ dropped or
// added (がっこう / がこう), a long vowel dropped or added (とおか / とか),
// and ん / う swapped at the end (じかん / じかう). Returned in the
// answer's own script, never equal to any accepted reading. Each entry is
// { text, kind } where kind is the vp_mistake_* key it illustrates.
const LARGE_TO_SMALL = { や: 'ゃ', ゆ: 'ゅ', よ: 'ょ' };
const SOKUON_BEFORE = /[かきくけこさしすせそたちつてとぱぴぷぺぽ]/;
// Only these rows take a voicing mark in real words (no ゔ from う).
const VOICEABLE = /[かきくけこさしすせそたちつてとはひふへほ]/;
const toKatakana = (s) => [...s].map((c) => {
  const code = c.charCodeAt(0);
  return code >= 0x3041 && code <= 0x3096 ? String.fromCharCode(code + 0x60) : c;
}).join('');

export function confusablesFor(word) {
  const reading = primaryReading(word);
  if (!reading) return [];
  const isKata = /[\u30a1-\u30f6]/.test(reading);
  const h = toHiragana(reading);
  const chars = [...h];
  const accepted = new Set(readingVariants(word).map((v) => norm(v)));
  const out = new Map();
  const add = (text, kind) => {
    if (!text || text === h || accepted.has(text) || out.has(text)) return;
    out.set(text, kind);
  };
  const swap = (i, c) => chars.slice(0, i).join('') + c + chars.slice(i + 1).join('');

  chars.forEach((c, i) => {
    // voicing marks
    const plain = stripDakuten(c);
    if (plain !== c) add(swap(i, plain), 'vp_mistake_dakuten');
    else if (VOICEABLE.test(c)) add(swap(i, (c + '\u3099').normalize('NFC')), 'vp_mistake_dakuten');
    // small <-> large
    if (SMALL[c] && c !== 'っ') add(swap(i, SMALL[c]), 'vp_mistake_small_kana');
    if (LARGE_TO_SMALL[c] && i > 0 && VOWEL_OF.get(chars[i - 1]) === 'i') add(swap(i, LARGE_TO_SMALL[c]), 'vp_mistake_small_kana');
    // っ dropped / written large / added
    if (c === 'っ') {
      add(chars.filter((_, j) => j !== i).join(''), 'vp_mistake_sokuon');
      add(swap(i, 'つ'), 'vp_mistake_sokuon');
    } else if (i > 0 && SOKUON_BEFORE.test(c) && chars[i - 1] !== 'っ' && chars[i - 1] !== 'ん' && VOWEL_OF.get(chars[i - 1])) {
      add(chars.slice(0, i).join('') + 'っ' + chars.slice(i).join(''), 'vp_mistake_sokuon');
    }
    // long vowel dropped (ー or a lengthening vowel)
    const v = i > 0 ? VOWEL_OF.get(chars[i - 1]) : null;
    if (c === 'ー' || (v && LENGTHENS[v].includes(c))) add(chars.filter((_, j) => j !== i).join(''), 'vp_mistake_long_vowel');
  });
  // long vowel added once, after the last o-row syllable that isn't
  // already long (とか -> とおか style)
  for (let i = chars.length - 1; i >= 0; i--) {
    const next = chars[i + 1];
    if (VOWEL_OF.get(chars[i]) === 'o' && next !== 'う' && next !== 'お' && next !== 'ー') {
      add(chars.slice(0, i + 1).join('') + 'う' + chars.slice(i + 1).join(''), 'vp_mistake_long_vowel');
      break;
    }
  }
  // final ん <-> う
  const last = chars.length - 1;
  if (chars[last] === 'ん') add(swap(last, 'う'), null);
  else if (chars[last] === 'う' && last > 0) add(swap(last, 'ん'), null);

  return [...out.entries()].map(([text, kind]) => ({ text: isKata ? toKatakana(text) : text, kind }));
}

// Up to `count` distractors for a reading, spread over different mistake
// kinds first so each question tests more than one kind of slip.
export function pickConfusables(word, count = 3) {
  const all = confusablesFor(word);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const picked = [];
  const kinds = new Set();
  for (const c of all) if (picked.length < count && !kinds.has(c.kind)) { picked.push(c); kinds.add(c.kind); }
  for (const c of all) if (picked.length < count && !picked.includes(c)) picked.push(c);
  return picked;
}
