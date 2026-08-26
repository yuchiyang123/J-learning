const KEY = 'jp_kana_write_autoplay';

// Whether switching characters in kana handwriting practice (WritingPractice)
// auto-plays pronunciation. Defaults on, matching the behavior introduced
// before this became a user-facing setting.
export function getKanaWriteAutoplay() {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export function setKanaWriteAutoplay(enabled) {
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0');
  } catch {
    // storage unavailable (private mode etc.) — preference just won't persist
  }
}
