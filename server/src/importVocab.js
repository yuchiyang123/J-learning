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

// Loads and dedupes bulk vocabulary across all levels, skipping any word whose
// (kanji||kana, kana) pair already exists in `existingKeys`.
export function loadBulkVocab(existingKeys) {
  const seen = new Set(existingKeys);
  const out = [];
  const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];

  for (const lv of levels) {
    const file = path.join(DATA_DIR, `${lv}.csv`);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf-8');
    const rows = parseCsv(text).slice(1); // drop header
    for (const cols of rows) {
      if (cols.length < 3) continue;
      const [expression, reading, meaning] = cols;
      if (!expression || !reading || !meaning) continue;
      const kanji = expression === reading || isKanaOnly(expression) ? null : expression;
      const kana = reading;
      const key = `${kanji || ''}|${kana}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([lv.toUpperCase(), kanji, kana, meaning, null, null, null, null]);
    }
  }
  return out;
}
