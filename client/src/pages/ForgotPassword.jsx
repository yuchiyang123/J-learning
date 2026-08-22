import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

export default function ForgotPassword() {
  const [userName, setUserName] = useState('');
  const [requesting, setRequesting] = useState(false);
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();

  async function onRequest(e) {
    e.preventDefault();
    setRequesting(true);
    try {
      await forgotPassword(userName);
    } finally {
      // Always proceed to the same "check your email" outcome regardless of
      // whether the account exists — Mini-SSO itself never reveals that, so
      // branching here on success/failure would just leak it a different way.
      navigate('/', { state: { passwordResetRequested: true } });
    }
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1><KeyRound size={22} /> {t('reset_password_title')}</h1>
        <p>{t('reset_password_intro')}</p>
        <form onSubmit={onRequest} className="auth-form">
          <label>
            {t('username_label')}
            <input value={userName} onChange={(e) => setUserName(e.target.value)} required autoFocus />
          </label>
          <button className="submit-btn" type="submit" disabled={requesting}>{t('reset_password_request_btn')}</button>
        </form>
        <p className="auth-switch">
          <Link to="/login">{t('login_title')}</Link>
        </p>
      </div>
    </div>
  );
}
