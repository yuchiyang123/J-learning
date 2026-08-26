// One-off generator: downloads KanjiVG stroke-order SVG data for every kana
// character (src/data/kana.js) plus every kanji this app teaches, and writes
// it to src/data/kanaStrokes.json — kept as one flat character->strokes map
// (despite the kana-specific filename, left as-is to avoid touching every
// existing import) so KanaWriteQuiz's lib/kanaStrokeGuide.js and
// lib/kanaStrokeRecognition.js work unchanged for kanji too; only
// KanjiWriteQuiz.jsx is new. KanjiVG data is CC BY-SA 3.0
// (http://kanjivg.tagaini.net) — attribution kept in the generated file.
import { writeFile } from 'node:fs/promises';
import { seion, dakuon, handakuon } from '../src/data/kana.js';

// Mirrors server/src/seed.js's `kanji` export (character is field index 1).
// Inlined as a plain string rather than importing seed.js directly — that
// module opens a real SQLite connection as an import side effect via db.js,
// which this generator script has no business triggering.
const KANJI_CHARS =
  '日一人大小山川水火木金土学生経験説明影響白黒赤青雨天気円上下中外左右前後名女男子出入見聞食飲使働変若実全開閉集進増減選続決環境顕把握抽巧妙遂越';

const chars = new Set();
for (const row of [...seion, ...dakuon, ...handakuon]) {
  for (const cell of row.cells) {
    if (!cell) continue;
    chars.add(cell[0]);
    chars.add(cell[1]);
  }
}
for (const ch of KANJI_CHARS) chars.add(ch);

function codepointHex(ch) {
  return ch.codePointAt(0).toString(16).padStart(5, '0');
}

async function fetchStrokes(ch) {
  const hex = codepointHex(ch);
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${ch} (${hex}): HTTP ${res.status}`);
  const svg = await res.text();

  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  const numbers = [...svg.matchAll(/<text transform="matrix\(1 0 0 1 ([\d.-]+) ([\d.-]+)\)">(\d+)<\/text>/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), n: Number(m[3]) }));

  return { paths, numbers };
}

const out = {};
for (const ch of chars) {
  try {
    out[ch] = await fetchStrokes(ch);
    process.stdout.write(`ok ${ch}\n`);
  } catch (err) {
    process.stdout.write(`FAIL ${ch}: ${err.message}\n`);
  }
}

await writeFile(
  new URL('../src/data/kanaStrokes.json', import.meta.url),
  JSON.stringify(out),
);
console.log(`wrote ${Object.keys(out).length} characters`);
