import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

export default function Login() {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(userName, password);
      navigate('/');
    } catch (err) {
      if (err.message.startsWith('login_locked')) {
        const secs = err.message.split(':')[1];
        setError(t('login_locked', { seconds: secs || '?' }));
      } else if (err.message === 'login_email_unconfirmed') {
        setError(t('login_email_unconfirmed'));
      } else {
        setError(t('login_failed'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1><LogIn size={22} /> {t('login_title')}</h1>
        <form onSubmit={onSubmit} className="auth-form">
          <label>
            {t('username_label')}
            <input value={userName} onChange={(e) => setUserName(e.target.value)} required autoFocus />
          </label>
          <label>
            {t('password_label')}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="warning">{error}</p>}
          <button className="submit-btn" type="submit" disabled={submitting}>{t('login_btn')}</button>
        </form>
        <p className="auth-switch">
          {t('login_no_account')} <Link to="/register">{t('register_title')}</Link>
        </p>
      </div>
    </div>
  );
}
