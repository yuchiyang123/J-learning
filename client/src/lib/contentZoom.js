// Page-content size (設定 → 顯示大小): scales the main content column —
// not the navigation — for big screens where the default reads small.
// Applied as CSS zoom on .app-main through the --content-zoom variable
// (skins/shared.css), so every skin and page follows it. Per device.

export const CONTENT_ZOOMS = [1, 1.15, 1.3, 1.5];
const KEY = 'jp_content_zoom';

export function getContentZoom() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return CONTENT_ZOOMS.includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

export function applyContentZoom(zoom = getContentZoom()) {
  document.documentElement.style.setProperty('--content-zoom', String(zoom));
}

export function setContentZoom(zoom) {
  if (!CONTENT_ZOOMS.includes(zoom)) return;
  try { localStorage.setItem(KEY, String(zoom)); } catch { /* private mode: this visit only */ }
  applyContentZoom(zoom);
}
