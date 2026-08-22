import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

export default function ForgotPassword() {
  const [userName, setUserName] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [sent, setSent] = useState(false);

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();

  async function onRequest(e) {
    e.preventDefault();
    setRequesting(true);
    try {
      await forgotPassword(userName);
      setSent(true);
    } finally {
      setRequesting(false);
    }
  }

  async function onReset(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await resetPassword(userName, code, newPassword);
      setDone(true);
    } catch {
      setError(t('confirm_code_invalid'));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <h1><KeyRound size={22} /> {t('reset_password_done_title')}</h1>
          <p>{t('reset_password_done_desc')}</p>
          <p className="auth-switch">
            <button type="button" className="submit-btn" onClick={() => navigate('/login')}>{t('login_title')}</button>
          </p>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <h1><KeyRound size={22} /> {t('reset_password_title')}</h1>
          <p>{t('reset_password_check_email_desc')}</p>
          <form onSubmit={onReset} className="auth-form">
            <label>
              {t('confirm_code_label')}
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} required autoFocus />
            </label>
            <label>
              {t('reset_password_new_label')}
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </label>
            {error && <p className="warning">{error}</p>}
            <button className="submit-btn" type="submit" disabled={submitting}>{t('reset_password_submit_btn')}</button>
          </form>
        </div>
      </div>
    );
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
