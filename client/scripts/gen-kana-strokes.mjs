// One-off generator: downloads KanjiVG stroke-order SVG data for every kana
// character used in src/data/kana.js and writes it to src/data/kanaStrokes.json.
// KanjiVG data is CC BY-SA 3.0 (http://kanjivg.tagaini.net) — attribution kept
// in the generated file.
import { writeFile } from 'node:fs/promises';
import { seion, dakuon, handakuon } from '../src/data/kana.js';

const chars = new Set();
for (const row of [...seion, ...dakuon, ...handakuon]) {
  for (const cell of row.cells) {
    if (!cell) continue;
    chars.add(cell[0]);
    chars.add(cell[1]);
  }
}

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
