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

// Canvas-safe equivalents of the active skin's --ink / --accent /
// --accent-2 / --line tokens (see skins/<id>/styles.css) — kept in sync
// with those by hand since a canvas 2D context can't read CSS variables.
// The torii skin's canvases sit inside lit paper panels whose ink is dark
// in both modes, hence its dark-on-light "dark" row.
const CANVAS = {
  classic: { dark: ['#ece5db', '#e2564a', '#3ecfa8', '#4a4038'], light: ['#262421', '#c23a2e', '#1f6f5c', '#d9d3ca'] },
  washi: { dark: ['#ebe4d6', '#e05a4f', '#4fbf94', '#4a4036'], light: ['#1f1b17', '#b7282e', '#2e6a4e', '#c9bda6'] },
  neon: { dark: ['#f3f2fa', '#ff2d95', '#39ff88', '#2a2a3f'], light: ['#0e0e18', '#e0187a', '#14a55c', '#d6d4ea'] },
  sumi: { dark: ['#ece7db', '#d8443a', '#6fbf95', '#46413a'], light: ['#171512', '#b3261e', '#3a6b52', '#b9b0a0'] },
  torii: { dark: ['#2a2117', '#d6402b', '#2f8a5c', '#d9c9a8'], light: ['#221c14', '#c23320', '#2b7a52', '#d9cdb4'] },
};
function canvasColor(i) {
  const set = CANVAS[document.documentElement.getAttribute('data-skin')] ?? CANVAS.classic;
  return set[getEffectiveTheme()][i];
}
export function getInkColor() { return canvasColor(0); }
export function getAccentColor() { return canvasColor(1); }
export function getAccent2Color() { return canvasColor(2); }
export function getGridLineColor() { return canvasColor(3); }

// For things other than the theme toggle that change what canvases should
// paint with (switching skins) — fires the same event onThemeChange hears.
export function notifyThemeChange() {
  window.dispatchEvent(new Event(THEME_EVENT));
}
