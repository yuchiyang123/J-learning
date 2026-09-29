import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, UserCircle, Type, Palette } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import SkinPicker from '../components/SkinPicker.jsx';
import { getKanaWriteAutoplay, setKanaWriteAutoplay, getStrokeAnimation, setStrokeAnimation } from '../lib/kanaWritePrefs.js';

export default function Settings() {
  const { t } = useLocale();
  const { isLoggedIn, user, loading } = useAuth();
  const [kanaAutoplay, setKanaAutoplayState] = useState(getKanaWriteAutoplay);
  const [strokeAnimation, setStrokeAnimationState] = useState(getStrokeAnimation);

  function toggleKanaAutoplay(value) {
    setKanaAutoplayState(value);
    setKanaWriteAutoplay(value);
  }

  function toggleStrokeAnimation(value) {
    setStrokeAnimationState(value);
    setStrokeAnimation(value);
  }

  // The visual style is a per-device preference, so it's available without
  // an account; everything below it needs one.
  return (
    <div className="page">
      <h1>{t('settings_title')}</h1>

      <div className="auth-card settings-card skin-settings-card">
        <h2 className="settings-section-heading">
          <Palette size={18} /> {t('settings_skin_heading')}
        </h2>
        <p className="muted">{t('settings_skin_hint')}</p>
        <SkinPicker />
      </div>

      {!loading && !isLoggedIn && (
        <div className="auth-card settings-card">
          <p className="muted">{t('settings_account_login_hint')}</p>
          <Link className="submit-btn icon-btn" to="/login" style={{ display: 'inline-flex', gap: '0.4rem' }}>
            <LogIn size={16} /> {t('login_title')}
          </Link>
        </div>
      )}

      {isLoggedIn && (
        <>
      <div className="auth-card settings-card">
        <h2 className="settings-section-heading">
          <UserCircle size={18} /> {t('settings_account_heading')}
        </h2>
        <div className="settings-row">
          <span className="filter-label">{t('settings_username_label')}</span>
          <span>{user?.userName}</span>
        </div>
      </div>

      <div className="auth-card settings-card">
        <h2 className="settings-section-heading">
          <Type size={18} /> {t('settings_kana_heading')}
        </h2>
        <div className="settings-row">
          <span className="filter-label">{t('settings_kana_autoplay_label')}</span>
          <div className="filter-group">
            <button className={kanaAutoplay ? 'active' : ''} onClick={() => toggleKanaAutoplay(true)}>
              {t('settings_toggle_on')}
            </button>
            <button className={!kanaAutoplay ? 'active' : ''} onClick={() => toggleKanaAutoplay(false)}>
              {t('settings_toggle_off')}
            </button>
          </div>
        </div>
        <div className="settings-row">
          <span className="filter-label">{t('settings_stroke_animation_label')}</span>
          <div className="filter-group">
            <button className={strokeAnimation ? 'active' : ''} onClick={() => toggleStrokeAnimation(true)}>
              {t('settings_toggle_on')}
            </button>
            <button className={!strokeAnimation ? 'active' : ''} onClick={() => toggleStrokeAnimation(false)}>
              {t('settings_toggle_off')}
            </button>
          </div>
        </div>
      </div>

        </>
      )}
    </div>
  );
}
