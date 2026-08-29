// One-off fallback translator: fills translations.json cache gaps via
// MyMemory's free API (translated.net) since translate.googleapis.com is
// currently rate-limited (HTTP 429). Single-text-per-request (no batching
// like the gtx trick used by src/translate.js), so this is slower but works
// right now. Covers the same steps as scripts/build-translations.js for the
// newly-added bulk kanji content (plus any bulk word gaps left by the
// earlier interrupted Google-based run).
import { loadCache, saveCache } from '../src/translate.js';
// Pull the RAW bulk data straight from the loaders instead of seed.js's own
// bulkKanji/bulkWords exports — see the comment in build-translations.js;
// seed.js mutates those meaning fields in place using whatever's already
// cached, so re-reading them here would feed already-translated text back
// in as fake source text for every previously-successful entry.
import { words, kanji } from '../src/seed.js';
import { loadBulkVocab } from '../src/importVocab.js';
import { loadBulkKanji } from '../src/importKanji.js';

const bulkWords = loadBulkVocab(words.map(([, k, kana]) => `${k || ''}|${kana}`));
const bulkKanji = loadBulkKanji(kanji.map((k) => k[1]));

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function translateOne(text, sourceLang, targetLang) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.responseStatus !== 200 && json.responseStatus !== '200') {
    throw new Error(`MyMemory status ${json.responseStatus}: ${json.responseDetails}`);
  }
  if (json.quotaFinished) throw new Error('QUOTA_EXCEEDED');
  return json.responseData.translatedText;
}

async function fillMissing(items, sourceLang, targetLang, label) {
  const cache = loadCache();
  cache[targetLang] ??= {};
  const bucket = cache[targetLang];
  const missing = [...new Set(items)].filter((t) => t && !(t in bucket));
  console.log(`${label}: ${missing.length} missing`);
  let done = 0;
  let failures = 0;
  for (const text of missing) {
    try {
      const translated = await translateOne(text, sourceLang, targetLang);
      bucket[text] = translated;
    } catch (err) {
      if (err.message === 'QUOTA_EXCEEDED') {
        console.log(`\n${label}: quota exceeded after ${done}/${missing.length}, stopping this pass.`);
        saveCache(cache);
        return { done, failures, quotaHit: true };
      }
      failures++;
    }
    done++;
    if (done % 20 === 0) {
      saveCache(cache);
      process.stdout.write(`\r${label}: ${done}/${missing.length} (${failures} failed)          `);
    }
    await sleep(250);
  }
  saveCache(cache);
  console.log(`\r${label}: ${done}/${missing.length} (${failures} failed)          `);
  return { done, failures, quotaHit: false };
}

async function main() {
  // 1) zh-TW: bulk kanji + bulk word meanings, EN -> ZH-TW.
  const kanjiMeaningsEn = bulkKanji.map((k) => k[4]);
  let r = await fillMissing(kanjiMeaningsEn, 'en', 'zh-TW', 'bulk kanji EN->ZH');
  if (r.quotaHit) return console.log('Stopping — quota hit during bulk kanji EN->ZH.');

  const wordMeaningsEn = bulkWords.map((w) => w[3]);
  r = await fillMissing(wordMeaningsEn, 'en', 'zh-TW', 'bulk words EN->ZH');
  if (r.quotaHit) return console.log('Stopping — quota hit during bulk words EN->ZH.');

  // 2) en: bulk kanji/words already had a real source English meaning before
  //    step 1 translated them — reuse it directly instead of machine-
  //    translating the Chinese back to English (lossy round trip + zero
  //    network calls needed), same shortcut build-translations.js uses.
  const cache = loadCache();
  cache.en ??= {};
  const zhTw = cache['zh-TW'] || {};
  kanjiMeaningsEn.forEach((en) => { const zh = zhTw[en]; if (zh) cache.en[zh] ??= en; });
  wordMeaningsEn.forEach((en) => { const zh = zhTw[en]; if (zh) cache.en[zh] ??= en; });
  saveCache(cache);

  // 3) ko: everything needs a real translation from the final zh-TW text —
  //    only the new bulk kanji meanings are actually missing here (bulk
  //    words' ko coverage predates this run).
  const kanjiMeaningsZh = kanjiMeaningsEn.map((en) => zhTw[en] ?? en);
  r = await fillMissing(kanjiMeaningsZh, 'zh-TW', 'ko', 'bulk kanji ZH->KO');
  if (r.quotaHit) return console.log('Stopping — quota hit during bulk kanji ZH->KO.');

  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
