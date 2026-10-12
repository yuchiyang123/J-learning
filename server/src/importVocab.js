import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Bulk JLPT vocabulary source: elzup/jlpt-word-list (MIT licensed), cached locally
// under server/data/jlpt/*.csv. Columns: expression,reading,meaning,tags

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data', 'jlpt');

// Minimal RFC4180-ish CSV line parser (handles quoted fields with embedded commas
// and doubled "" escapes, which is all this dataset uses).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (c === '\r') {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const isKanaOnly = (s) => /^[぀-ゟ゠-ヿー～]*$/.test(s);
const hasCjk = (s) => /[㐀-鿿]/.test(s);

// A handful of source rows have their columns swapped — the kana in
// `expression` and the kanji in `reading` (e.g. "うそ,嘘"). Taken as-is,
// that put kanji into the reading field, which then showed up on
// kana-only flashcard fronts and as the expected typing answer.
function normalizePair(expression, reading) {
  if (isKanaOnly(expression) && hasCjk(reading)) return { kanji: reading, kana: expression };
  const kanji = expression === reading || isKanaOnly(expression) ? null : expression;
  return { kanji, kana: reading };
}

function readRows(lv) {
  const file = path.join(DATA_DIR, `${lv}.csv`);
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, 'utf-8')).slice(1).filter((c) => c.length >= 3 && c[0] && c[1] && c[2]);
}

// Fixes rows already imported with the swapped columns above: a word with
// no kanji whose reading contains kanji is looked up in its level's CSV
// and rewritten as kanji = that reading, kana = the expression. Idempotent
// (fixed rows no longer match) and a no-op when the CSVs aren't present.
export function repairSwappedReadings(db) {
  const bad = db.prepare('SELECT id, level, kana FROM words WHERE kanji IS NULL').all().filter((w) => hasCjk(w.kana));
  if (bad.length === 0) return 0;
  const update = db.prepare('UPDATE words SET kanji = ?, kana = ? WHERE id = ?');
  const byLevel = new Map();
  let fixed = 0;
  for (const w of bad) {
    const lv = w.level.toLowerCase();
    if (!byLevel.has(lv)) byLevel.set(lv, readRows(lv));
    const row = byLevel.get(lv).find(([expression, reading]) => reading === w.kana && isKanaOnly(expression));
    if (!row) continue;
    update.run(w.kana, row[0], w.id);
    fixed++;
  }
  return fixed;
}

// Loads and dedupes bulk vocabulary across all levels, skipping any word whose
// (kanji||kana, kana) pair already exists in `existingKeys`.
export function loadBulkVocab(existingKeys) {
  const seen = new Set(existingKeys);
  const out = [];
  const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];

  for (const lv of levels) {
    for (const cols of readRows(lv)) {
      const [expression, reading, meaning] = cols;
      const { kanji, kana } = normalizePair(expression, reading);
      const key = `${kanji || ''}|${kana}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([lv.toUpperCase(), kanji, kana, meaning, null, null, null, null]);
    }
  }
  return out;
}
