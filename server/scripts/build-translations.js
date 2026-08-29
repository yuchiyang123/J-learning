// One-time (re-runnable) batch job that populates server/data/translations.json
// with machine translations for every piece of learning content, so the app can
// serve zh-TW / en / ko without calling any translation API at request time.
// Run with: npm run translate  (from server/)
//
// zh-CN is NOT translated here — it's derived deterministically from zh-TW via
// opencc-js at request time (see server/src/locale.js), since it's a character
// conversion, not a real translation.
// Pull bulk data straight from the loaders rather than seed.js's own
// bulkWords/bulkKanji exports — seed.js mutates those meaning fields in
// place to whatever's already cached (English -> Chinese, for any entry a
// prior translate run already resolved), so re-reading them here on a
// second run would feed already-Chinese text back in as fake "English"
// source text for every previously-successful entry, silently polluting
// the cache with round-tripped garbage. (Caught this the hard way — see
// git history around this comment if it recurs.)
import { words, kanji, grammar } from '../src/seed.js';
import { loadBulkVocab } from '../src/importVocab.js';
import { loadBulkKanji } from '../src/importKanji.js';
import { translateAllCached, loadCache, saveCache } from '../src/translate.js';

const bulkWords = loadBulkVocab(words.map(([, k, kana]) => `${k || ''}|${kana}`));
const bulkKanji = loadBulkKanji(kanji.map((k) => k[1]));

function log(label) {
  return (done, total, note) => {
    process.stdout.write(`\r${label}: ${done}/${total}${note ? ' — ' + note : ''}          `);
    if (done === total) process.stdout.write('\n');
  };
}

async function main() {
  // 1) Fix the bulk-imported word meanings: they're English (from the JLPT word
  //    list source) and need to become Chinese, matching every other piece of
  //    content on the site.
  const bulkMeaningsEn = bulkWords.map((w) => w[3]);
  console.log(`Translating ${new Set(bulkMeaningsEn).size} unique bulk word meanings EN -> ZH-TW...`);
  await translateAllCached(bulkMeaningsEn, 'zh-TW', { sourceLang: 'en', onProgress: log('bulk EN->ZH') });

  // Same treatment for bulk kanji meanings (davidluzgouveia/kanji-data gives
  // English too — see importKanji.js).
  const bulkKanjiMeaningsEn = bulkKanji.map((k) => k[4]);
  console.log(`Translating ${new Set(bulkKanjiMeaningsEn).size} unique bulk kanji meanings EN -> ZH-TW...`);
  await translateAllCached(bulkKanjiMeaningsEn, 'zh-TW', { sourceLang: 'en', onProgress: log('bulk kanji EN->ZH') });

  // Re-load the cache to get the freshly-translated Chinese text for step 2/3.
  const cache = loadCache();
  const bulkMeaningsZh = bulkMeaningsEn.map((en) => cache['zh-TW']?.[en] ?? en);
  const bulkKanjiMeaningsZh = bulkKanjiMeaningsEn.map((en) => cache['zh-TW']?.[en] ?? en);

  // Bulk words/kanji already had a real (source) English meaning before we
  // translated them to Chinese above — reuse it as their "en" locale text
  // directly instead of machine-translating the Chinese back to English
  // (lossy round trip).
  cache.en ??= {};
  bulkMeaningsZh.forEach((zh, i) => { cache.en[zh] ??= bulkMeaningsEn[i]; });
  bulkKanjiMeaningsZh.forEach((zh, i) => { cache.en[zh] ??= bulkKanjiMeaningsEn[i]; });
  saveCache(cache);

  // 2) English: curated (already-Chinese) words + kanji + grammar need EN.
  //    Bulk words already have their original English — no translation needed,
  //    seed.js pulls that straight from the source CSV via a parallel column.
  const curatedMeaningsZh = words.map((w) => w[3]);
  const kanjiMeaningsZh = kanji.map((k) => k[4]);
  const grammarMeaningsZh = grammar.map((g) => g[2]);
  const grammarExplanationsZh = grammar.map((g) => g[3]).filter(Boolean);

  console.log('Translating curated word meanings ZH -> EN...');
  await translateAllCached(curatedMeaningsZh, 'en', { onProgress: log('curated ZH->EN') });
  console.log('Translating kanji meanings ZH -> EN...');
  await translateAllCached(kanjiMeaningsZh, 'en', { onProgress: log('kanji ZH->EN') });
  console.log('Translating grammar meanings ZH -> EN...');
  await translateAllCached(grammarMeaningsZh, 'en', { onProgress: log('grammar meaning ZH->EN') });
  console.log('Translating grammar explanations ZH -> EN...');
  await translateAllCached(grammarExplanationsZh, 'en', { onProgress: log('grammar expl ZH->EN') });

  // 3) Korean: everything, from its final Chinese text.
  const allWordMeaningsZh = [...curatedMeaningsZh, ...bulkMeaningsZh];
  const allKanjiMeaningsZh = [...kanjiMeaningsZh, ...bulkKanjiMeaningsZh];
  console.log(`Translating ${new Set(allWordMeaningsZh).size} unique word meanings ZH -> KO...`);
  await translateAllCached(allWordMeaningsZh, 'ko', { onProgress: log('words ZH->KO') });
  console.log(`Translating ${new Set(allKanjiMeaningsZh).size} unique kanji meanings ZH -> KO...`);
  await translateAllCached(allKanjiMeaningsZh, 'ko', { onProgress: log('kanji ZH->KO') });
  console.log('Translating grammar meanings ZH -> KO...');
  await translateAllCached(grammarMeaningsZh, 'ko', { onProgress: log('grammar meaning ZH->KO') });
  console.log('Translating grammar explanations ZH -> KO...');
  await translateAllCached(grammarExplanationsZh, 'ko', { onProgress: log('grammar expl ZH->KO') });

  console.log('Done. Cache saved to server/data/translations.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
