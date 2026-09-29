// The site's visual skins. Each one is a complete redesign — its own
// stylesheet, navigation, home page and ambient effects — that grew on its
// own redesign/* branch and now lives side by side under src/skins/<id>/.
// Only the chosen skin is downloaded: `load()` is a dynamic import, so each
// skin (CSS included, via ?inline) is its own chunk.
import { notifyThemeChange, setTheme } from '../theme.js';

const fonts = (families) => `https://fonts.googleapis.com/css2?${families}&display=swap`;
const NOTO_SANS = 'family=Noto+Sans+JP:wght@400;500;700;900&family=Noto+Sans+TC:wght@400;500;700;900&family=Noto+Sans+SC:wght@400;500;700;900&family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Sans:wght@400;500;700;900';

export const SKINS = [
  {
    id: 'classic',
    name: '經典',
    tagline: 'Classic',
    // Theme to switch to when this skin is picked (null = keep the current one).
    theme: null,
    themeColor: '#c23a2e',
    fonts: fonts(`${NOTO_SANS}&family=Zen+Maru+Gothic:wght@500;700`),
    preview: { bg: '#faf6ef', fg: '#2a2420', accent: '#c23a2e', glyph: '学', font: '"Zen Maru Gothic", sans-serif' },
    load: () => import('./classic/index.js'),
  },
  {
    id: 'washi',
    name: '和紙と墨',
    tagline: 'Washi & Ink',
    theme: 'light',
    themeColor: '#b7282e',
    fonts: fonts(`${NOTO_SANS}&family=Noto+Serif+JP:wght@500;700;900&family=Noto+Serif+TC:wght@500;700;900&family=Noto+Serif+SC:wght@500;700;900&family=Noto+Serif+KR:wght@500;700;900&family=Shippori+Mincho:wght@500;700;800`),
    preview: { bg: '#f5efe2', fg: '#1f1b17', accent: '#b7282e', glyph: '桜', font: '"Shippori Mincho", serif' },
    load: () => import('./washi/index.js'),
  },
  {
    id: 'neon',
    name: 'TOKYO NIGHT',
    tagline: 'Neon Tokyo',
    theme: 'dark',
    themeColor: '#07070f',
    fonts: fonts(`${NOTO_SANS}&family=Dela+Gothic+One`),
    preview: { bg: '#07070f', fg: '#f3f2fa', accent: '#ff2d95', glyph: '夜', font: '"Dela Gothic One", sans-serif', glow: true },
    load: () => import('./neon/index.js'),
  },
  {
    id: 'sumi',
    name: '墨・絵巻',
    tagline: 'Sumi Emaki',
    theme: 'light',
    themeColor: '#f2ede3',
    fonts: fonts('family=Noto+Serif+JP:wght@400;500;700;900&family=Noto+Serif+TC:wght@400;500;700;900&family=Noto+Serif+SC:wght@400;500;700;900&family=Noto+Serif+KR:wght@400;500;700;900&family=Noto+Serif:wght@400;500;700;900&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700&family=Shippori+Mincho:wght@500;700;800&family=Yuji+Syuku'),
    preview: { bg: '#f2ede3', fg: '#171512', accent: '#b3261e', glyph: '墨', font: '"Yuji Syuku", serif' },
    load: () => import('./sumi/index.js'),
  },
  {
    id: 'torii',
    name: '千本鳥居',
    tagline: 'Torii World',
    theme: 'dark',
    themeColor: '#0b0d1a',
    fonts: fonts(`${NOTO_SANS}&family=Reggae+One&family=Shippori+Mincho:wght@500;700;800`),
    preview: { bg: '#0b0d1a', fg: '#f4ecd8', accent: '#ffb347', glyph: '道', font: '"Reggae One", sans-serif', glow: true },
    load: () => import('./torii/index.js'),
  },
];

export const DEFAULT_SKIN = 'classic';
const KEY = 'jp_skin';

export function getSkinMeta(id) {
  return SKINS.find((s) => s.id === id) ?? SKINS.find((s) => s.id === DEFAULT_SKIN);
}

export function getStoredSkin() {
  try {
    return getSkinMeta(localStorage.getItem(KEY)).id;
  } catch {
    return DEFAULT_SKIN;
  }
}

function storeSkin(id) {
  try { localStorage.setItem(KEY, id); } catch { /* won't persist */ }
}

// Swap the page over to a loaded skin module: its stylesheet replaces the
// previous one wholesale (skins never share CSS, so there's nothing to
// scope), plus its fonts and browser chrome color.
export function applySkin(meta, mod) {
  const root = document.documentElement;
  let style = document.getElementById('skin-css');
  if (!style) {
    style = document.createElement('style');
    style.id = 'skin-css';
    document.head.appendChild(style);
  }
  style.textContent = mod.css;

  let link = document.getElementById('skin-fonts');
  if (!link) {
    link = document.createElement('link');
    link.id = 'skin-fonts';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== meta.fonts) link.href = meta.fonts;

  // The boot background in index.html only covers the load; left in place it
  // would stop the body's background from painting the whole canvas.
  document.getElementById('boot-bg')?.remove();
  document.getElementById('favicon')?.setAttribute('href', `/favicons/${meta.id}.svg`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', meta.themeColor);
  root.setAttribute('data-skin', meta.id);
  // Canvases pick their ink per skin (theme.js), so repaint them.
  notifyThemeChange();
}

export async function loadSkin(id) {
  const meta = getSkinMeta(id);
  const mod = (await meta.load()).default;
  return { meta, mod };
}

// User-initiated switch (the settings page): persist, move to the skin's
// intended light/dark mode, then apply.
export async function switchSkin(id) {
  const loaded = await loadSkin(id);
  storeSkin(loaded.meta.id);
  if (loaded.meta.theme) setTheme(loaded.meta.theme);
  applySkin(loaded.meta, loaded.mod);
  return loaded;
}
