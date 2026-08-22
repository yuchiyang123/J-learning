import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { dictionaries } from './strings.js';

const KEY = 'jp_locale';
const DEFAULT_LOCALE = 'zh-TW';

export function getStoredLocale() {
  try {
    const v = localStorage.getItem(KEY);
    return v && dictionaries[v] ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

const LocaleContext = createContext({ locale: DEFAULT_LOCALE, setLocale: () => {}, t: (k) => k });

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(getStoredLocale);

  useEffect(() => {
    try { localStorage.setItem(KEY, locale); } catch { /* ignore */ }
    // Drives the locale-specific font stack in styles.css (see [data-locale]
    // rules) — Zen Maru Gothic only has good glyph coverage for Japanese/
    // Traditional-Chinese text, so other locales must not select it per-character
    // or headings end up with mismatched fonts mid-word.
    document.documentElement.setAttribute('data-locale', locale);
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (dictionaries[next]) setLocaleState(next);
  }, []);

  const t = useCallback((key, vars) => {
    const raw = dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE]?.[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
