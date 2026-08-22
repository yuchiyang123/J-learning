// Batched machine translation via the free/unofficial Google Translate endpoint
// (translate.googleapis.com) — no API key needed. Used only by the one-time
// scripts/build-translations.js cache builder, never at request time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_PATH = path.join(__dirname, '..', 'data', 'translations.json');

const DELIM = ' ||| ';
const BATCH_SIZE = 20;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateBatch(texts, targetLang, sourceLang) {
  const q = encodeURIComponent(texts.join(DELIM));
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${q}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
  const json = await res.json();
  const translated = json[0].map((seg) => seg[0]).join('');
  const parts = translated.split('|||').map((s) => s.trim());
  if (parts.length !== texts.length) throw new Error(`segment count mismatch: ${parts.length} vs ${texts.length}`);
  return parts;
}

// Resolves a chunk of texts, bisecting on failure so a single bad item never
// loses its whole batch — a single-item "batch" always has exactly 1 segment,
// so this always terminates successfully (modulo real network failures, which
// get one retry before that item is left untranslated).
async function resolveChunk(texts, targetLang, sourceLang) {
  if (texts.length === 0) return [];
  try {
    return await translateBatch(texts, targetLang, sourceLang);
  } catch (err) {
    if (texts.length === 1) {
      await sleep(300);
      try {
        return await translateBatch(texts, targetLang, sourceLang);
      } catch {
        return [null]; // give up on this one item; caller falls back to source text
      }
    }
    const mid = Math.ceil(texts.length / 2);
    const left = await resolveChunk(texts.slice(0, mid), targetLang, sourceLang);
    const right = await resolveChunk(texts.slice(mid), targetLang, sourceLang);
    return [...left, ...right];
  }
}

// Loads the on-disk cache: { [targetLang]: { [sourceText]: translatedText } }
export function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

// Translates every unique string in `texts` into `targetLang`, using/populating
// the on-disk cache so repeat runs (or re-seeds) don't re-call the API.
// sourceLang: BCP-47 code of the source text ('zh-TW' for our Chinese content,
// 'en' for the bulk-imported English word meanings).
export async function translateAllCached(texts, targetLang, { sourceLang = 'zh-TW', onProgress } = {}) {
  const cache = loadCache();
  cache[targetLang] ??= {};
  const bucket = cache[targetLang];

  const unique = [...new Set(texts.filter(Boolean))].filter((t) => !(t in bucket));
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const chunk = unique.slice(i, i + BATCH_SIZE);
    const translated = await resolveChunk(chunk, targetLang, sourceLang);
    let failures = 0;
    chunk.forEach((src, j) => {
      if (translated[j] == null) failures++;
      else bucket[src] = translated[j];
    });
    onProgress?.(i + chunk.length, unique.length, failures ? `${failures} item(s) failed` : undefined);
    saveCache(cache);
    await sleep(100);
  }

  return (text) => bucket[text] ?? text;
}
