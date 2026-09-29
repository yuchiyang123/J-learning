import { useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { SKINS } from '../skins/registry.js';
import { useSkin } from '../skins/SkinContext.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

// Each card previews its skin in that skin's own palette and display face.
// Only the active skin's fonts are loaded site-wide, so the preview glyphs
// and names are fetched here as a tiny Google Fonts `text=` subset (just
// these characters, a few KB) instead of five full CJK families.
const PREVIEW_FONTS = 'family=Zen+Maru+Gothic:wght@700&family=Shippori+Mincho:wght@800&family=Dela+Gothic+One&family=Yuji+Syuku&family=Reggae+One';

function usePreviewFonts() {
  useEffect(() => {
    if (document.getElementById('skin-preview-fonts')) return;
    const text = [...new Set(SKINS.flatMap((s) => [...s.preview.glyph, ...s.name, ...s.tagline]))].join('');
    const link = document.createElement('link');
    link.id = 'skin-preview-fonts';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${PREVIEW_FONTS}&text=${encodeURIComponent(text)}&display=swap`;
    document.head.appendChild(link);
  }, []);
}

export default function SkinPicker() {
  const { skin, setSkin, switching } = useSkin();
  const { t } = useLocale();
  usePreviewFonts();

  return (
    <div className="skin-picker" role="radiogroup" aria-label={t('settings_skin_heading')}>
      {SKINS.map((s) => {
        const active = s.id === skin;
        const loading = s.id === switching;
        const p = s.preview;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`skin-card${active ? ' is-active' : ''}${loading ? ' is-loading' : ''}`}
            onClick={() => setSkin(s.id)}
            disabled={!!switching}
            style={{ '--pv-bg': p.bg, '--pv-fg': p.fg, '--pv-accent': p.accent, '--pv-font': p.font }}
          >
            <span className={`skin-preview${p.glow ? ' is-glow' : ''}`} aria-hidden="true">
              <span className="skin-preview-bar" />
              <span className="skin-preview-glyph" lang="ja">{p.glyph}</span>
              <span className="skin-preview-line" />
            </span>
            <span className="skin-card-name" lang="ja">{s.name}</span>
            <span className="skin-card-tag">{s.tagline}</span>
            {active && <span className="skin-card-badge"><Check size={13} /> {t('settings_skin_current')}</span>}
            {loading && <span className="skin-card-badge"><Loader2 size={13} className="spin" /> {t('settings_skin_loading')}</span>}
          </button>
        );
      })}
    </div>
  );
}
