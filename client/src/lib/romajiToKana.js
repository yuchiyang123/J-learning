// Romaji -> hiragana, for typing answers without a Japanese IME (phones,
// shared computers, learners who haven't set one up). Covers Hepburn and
// the common kunrei/IME spellings (si, ti, tu, hu, zi, ...), doubled
// consonants for っ, "-" for ー, and x/l prefixes for small kana. Anything
// that isn't latin (kana or kanji typed through a real IME) passes through
// untouched, so both ways of typing can be mixed freely.

const TABLE = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ',
  ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  la: 'ら', li: 'り', lu: 'る', le: 'れ', lo: 'ろ',
  wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  da: 'だ', di: 'ぢ', du: 'づ', dzu: 'づ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
  tsa: 'つぁ', tsi: 'つぃ', tse: 'つぇ', tso: 'つぉ',
  thi: 'てぃ', dhi: 'でぃ', thu: 'てゅ', dhu: 'でゅ', twu: 'とぅ', dwu: 'どぅ',
  she: 'しぇ', che: 'ちぇ', je: 'じぇ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ',
  'n\'': 'ん', xn: 'ん',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', xtu: 'っ', xtsu: 'っ', xwa: 'ゎ', xka: 'ゕ', xke: 'ゖ',
};
// y-combinations: kya, sya, tya, cya, nya, hya, mya, rya, gya, zya, jya, dya, bya, pya, ...
const Y_BASES = { k: 'き', s: 'し', t: 'ち', c: 'ち', n: 'に', h: 'ひ', m: 'み', r: 'り', l: 'り', g: 'ぎ', z: 'じ', j: 'じ', d: 'ぢ', b: 'び', p: 'ぴ', f: 'ふ', v: 'ゔ' };
const SMALL_Y = { a: 'ゃ', i: 'ぃ', u: 'ゅ', e: 'ぇ', o: 'ょ' };
for (const [c, base] of Object.entries(Y_BASES)) {
  for (const [v, small] of Object.entries(SMALL_Y)) TABLE[`${c}y${v}`] ??= base + small;
}
// l-prefixed small kana mirror the x- ones.
for (const [k, v] of Object.entries(TABLE)) {
  if (k.startsWith('x') && k !== 'xn') TABLE[`l${k.slice(1)}`] ??= v;
}

const MAX_KEY = Math.max(...Object.keys(TABLE).map((k) => k.length));
const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);
const isLatin = (c) => c >= 'a' && c <= 'z';

// `final` resolves what's still pending at the end of the input — a lone
// trailing "n" becomes ん — which is what you want when the answer is
// submitted, but not while it's being typed ("ka" + "n" might still turn
// into "kana").
export function romajiToKana(input, { final = false } = {}) {
  const s = input.toLowerCase();
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '-' || c === 'ー') { out += 'ー'; i++; continue; }
    if (!isLatin(c) && c !== '\'') { out += input[i]; i++; continue; }

    const next = s[i + 1];
    // ん: "n'" or "xn" (table), "nn" (one ん; if a vowel follows, the second
    // n starts the next syllable so "konnichiha" -> こんにちは), "n" before a
    // consonant, or a lone "n" at the end of a submitted answer.
    if (c === 'n') {
      if (next === 'n') {
        const after = s[i + 2];
        out += 'ん';
        i += after && (VOWELS.has(after) || after === 'y') ? 1 : 2;
        continue;
      }
      if (next === undefined) {
        if (final) { out += 'ん'; i++; } else { out += input[i]; i++; }
        continue;
      }
      if (next !== '\'' && !VOWELS.has(next) && next !== 'y') { out += 'ん'; i++; continue; }
    }
    // Doubled consonant -> っ (kk, tt, tch, ss, pp, ...).
    if (next && c === next && !VOWELS.has(c) && c !== 'n' && isLatin(c)) { out += 'っ'; i++; continue; }
    if (c === 't' && next === 'c' && s[i + 2] === 'h') { out += 'っ'; i++; continue; }

    let matched = false;
    for (let len = Math.min(MAX_KEY, s.length - i); len > 0; len--) {
      const key = s.slice(i, i + len);
      if (TABLE[key]) { out += TABLE[key]; i += len; matched = true; break; }
    }
    if (!matched) { out += input[i]; i++; } // incomplete syllable — keep the letter for now
  }
  return out;
}
