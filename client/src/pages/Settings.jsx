import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, UserCircle, Type } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { getKanaWriteAutoplay, setKanaWriteAutoplay } from '../lib/kanaWritePrefs.js';

export default function Settings() {
  const { t } = useLocale();
  const { isLoggedIn, user, loading } = useAuth();
  const [kanaAutoplay, setKanaAutoplayState] = useState(getKanaWriteAutoplay);

  function toggleKanaAutoplay(value) {
    setKanaAutoplayState(value);
    setKanaWriteAutoplay(value);
  }

  if (loading) return <div className="page" />;

  if (!isLoggedIn) {
    return (
      <div className="page coming-soon">
        <div className="coming-soon-card">
          <LogIn size={32} />
          <h1>{t('settings_title')}</h1>
          <p>{t('settings_login_required_hint')}</p>
          <Link className="submit-btn" to="/login" style={{ display: 'inline-flex', marginTop: '1rem' }}>
            {t('login_title')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{t('settings_title')}</h1>

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
      </div>

      <p className="muted">{t('settings_more_soon')}</p>
    </div>
  );
}
