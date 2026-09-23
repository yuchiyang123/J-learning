const KEY = 'jp_theme';

export function getStoredTheme() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const THEME_EVENT = 'jp-theme-change';

// theme: 'light' | 'dark' | null (null = follow the OS preference)
export function setTheme(theme) {
  try {
    if (theme) localStorage.setItem(KEY, theme);
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable (private mode etc.) — theme just won't persist
  }
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  else document.documentElement.removeAttribute('data-theme');
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function getEffectiveTheme() {
  const stored = getStoredTheme();
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// For anything that paints onto a <canvas> instead of styling with CSS —
// canvas pixels don't pick up CSS custom properties automatically, so
// stroke ink and the reference stroke-order guide were both hardcoded to
// their light-mode colors and turned near-invisible against a dark canvas
// once dark mode shipped. Call this to repaint whenever the theme changes:
// ThemeToggle's explicit switch fires the custom event, and an OS-level
// scheme flip (when following system preference) fires the media query
// change event — both need to trigger the same redraw.
export function onThemeChange(callback) {
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener(THEME_EVENT, callback);
  mq?.addEventListener('change', callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    mq?.removeEventListener('change', callback);
  };
}

// Canvas-safe equivalents of this theme's --ink / --accent / --accent-2 /
// --line tokens (see styles.css) — kept in sync with those by hand since a
// canvas 2D context can't read CSS variables.
// Canvases live inside the lit paper panels (.page), whose ink is dark in
// both themes — so these track the panel, not the night sky around it.
export function getInkColor() {
  return getEffectiveTheme() === 'dark' ? '#2a2117' : '#221c14';
}
export function getAccentColor() {
  return getEffectiveTheme() === 'dark' ? '#d6402b' : '#c23320';
}
export function getAccent2Color() {
  return getEffectiveTheme() === 'dark' ? '#2f8a5c' : '#2b7a52';
}
export function getGridLineColor() {
  return getEffectiveTheme() === 'dark' ? '#d9c9a8' : '#d9cdb4';
}
