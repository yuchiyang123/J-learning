import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, MailCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

export default function Register() {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { register } = useAuth();
  const { t } = useLocale();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(userName, password, email);
      setDone(true);
    } catch (err) {
      const key = ['register_username_taken', 'register_email_taken'].includes(err.message)
        ? err.message
        : 'register_failed';
      setError(t(key));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <h1><MailCheck size={22} /> {t('register_check_email_title')}</h1>
          <p>{t('register_check_email_desc', { email })}</p>
          <p className="auth-switch">
            <Link to="/login">{t('login_title')}</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1><UserPlus size={22} /> {t('register_title')}</h1>
        <form onSubmit={onSubmit} className="auth-form">
          <label>
            {t('username_label')}
            <input value={userName} onChange={(e) => setUserName(e.target.value)} required autoFocus />
          </label>
          <label>
            {t('email_label')}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            {t('password_label')}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </label>
          {error && <p className="warning">{error}</p>}
          <button className="submit-btn" type="submit" disabled={submitting}>{t('register_btn')}</button>
        </form>
        <p className="auth-switch">
          {t('register_has_account')} <Link to="/login">{t('login_title')}</Link>
        </p>
      </div>
    </div>
  );
}
