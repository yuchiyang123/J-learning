import * as OpenCC from 'opencc-js';
import { loadCache } from './translate.js';

export const LOCALES = ['zh-TW', 'zh-CN', 'en', 'ko'];
export const DEFAULT_LOCALE = 'zh-TW';

export function normalizeLocale(input) {
  if (!input) return DEFAULT_LOCALE;
  const found = LOCALES.find((l) => l.toLowerCase() === String(input).toLowerCase());
  return found || DEFAULT_LOCALE;
}

const toCn = OpenCC.Converter({ from: 'tw', to: 'cn' });

let cache = null;
function getCache() {
  cache ??= loadCache();
  return cache;
}

// Resolves `zhText` (the site's base Traditional Chinese content) into the
// requested locale. zh-CN is derived live via character conversion (no stored
// translation needed); en/ko come from the pre-built translations.json cache
// (falls back to the Traditional Chinese source if that string was never
// translated, e.g. content added after the last `npm run translate`).
export function translate(zhText, locale) {
  if (!zhText) return zhText;
  const loc = normalizeLocale(locale);
  if (loc === 'zh-TW') return zhText;
  if (loc === 'zh-CN') return toCn(zhText);
  const bucket = getCache()[loc === 'en' ? 'en' : 'ko'];
  return bucket?.[zhText] ?? zhText;
}
