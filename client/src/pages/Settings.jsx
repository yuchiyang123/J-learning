import { Link } from 'react-router-dom';
import { LogIn, UserCircle } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Settings() {
  const { t } = useLocale();
  const { isLoggedIn, user, loading } = useAuth();

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

      <p className="muted">{t('settings_more_soon')}</p>
    </div>
  );
}
