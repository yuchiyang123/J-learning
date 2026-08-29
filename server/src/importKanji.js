import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Bulk JLPT kanji source: davidluzgouveia/kanji-data (MIT licensed, KANJIDIC-
// derived), cached locally as server/data/kanji-data/kanji.json. Keyed by
// character, each entry has { strokes, jlpt_new, meanings: [en...],
// readings_on: [hiragana...], readings_kun: [hiragana, dots mark okurigana] }.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'kanji-data', 'kanji.json');

function hiraganaToKatakana(s) {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

// The source marks the okurigana boundary within a reading with '.' (e.g.
// "ひと.つ" for 一つ); this app's existing curated entries use '-' for the
// same purpose (e.g. "おお-きい"), so normalize to match.
const formatReading = (r) => r.replace(/\./g, '-');

// Loads bulk kanji for every JLPT-tagged character, skipping any whose
// character already exists in `existingChars` (the curated 71). Meanings are
// left in English here — server/scripts/build-translations.js translates
// them to zh-TW (this app's base language) the same way it already handles
// loadBulkVocab's English meanings, and seed.js swaps in the cached
// translation before insert.
export function loadBulkKanji(existingChars) {
  const seen = new Set(existingChars);
  const out = [];
  if (!fs.existsSync(DATA_FILE)) return out;

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  for (const [char, info] of Object.entries(data)) {
    if (!info.jlpt_new || seen.has(char)) continue;
    seen.add(char);

    const onyomi = info.readings_on?.length
      ? info.readings_on.map((r) => formatReading(hiraganaToKatakana(r))).join('、')
      : '-';
    const kunyomi = info.readings_kun?.length ? info.readings_kun.map(formatReading).join('、') : '-';
    const meaning = info.meanings?.length ? info.meanings.join(', ') : char;

    out.push([`N${info.jlpt_new}`, char, onyomi, kunyomi, meaning, info.strokes ?? null]);
  }
  return out;
}
