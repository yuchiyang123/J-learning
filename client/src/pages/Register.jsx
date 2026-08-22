import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, MailCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { isPasswordValid } from '../auth/passwordPolicy.js';

export default function Register() {
  const [userName, setUserName] = useState('');
  const [userNameConfirm, setUserNameConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [resent, setResent] = useState(false);

  const { register, confirmEmail, resendConfirmation, login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (userName !== userNameConfirm) {
      setError(t('register_username_mismatch'));
      return;
    }
    if (password !== passwordConfirm) {
      setError(t('register_password_mismatch'));
      return;
    }
    if (!isPasswordValid(password)) {
      setError(t('register_password_weak'));
      return;
    }

    setSubmitting(true);
    try {
      await register(userName, password, email);
      setRegistered(true);
    } catch (err) {
      const key = ['register_username_taken', 'register_email_taken'].includes(err.message)
        ? err.message
        : 'register_failed';
      setError(t(key));
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirm(e) {
    e.preventDefault();
    setCodeError('');
    setConfirming(true);
    try {
      await confirmEmail(userName, code);
      // Verified — log straight in rather than bouncing back to the login form.
      await login(userName, password);
      navigate('/');
    } catch {
      setCodeError(t('confirm_code_invalid'));
    } finally {
      setConfirming(false);
    }
  }

  async function onResend() {
    setResent(false);
    await resendConfirmation(userName);
    setResent(true);
  }

  if (registered) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <h1><MailCheck size={22} /> {t('register_check_email_title')}</h1>
          <p>{t('register_check_email_desc', { email })}</p>
          <form onSubmit={onConfirm} className="auth-form">
            <label>
              {t('confirm_code_label')}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
              />
            </label>
            {codeError && <p className="warning">{codeError}</p>}
            <button className="submit-btn" type="submit" disabled={confirming}>{t('confirm_code_btn')}</button>
          </form>
          <p className="auth-switch">
            {resent ? t('confirm_code_resent') : (
              <button type="button" className="link-btn" onClick={onResend}>{t('confirm_code_resend')}</button>
            )}
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
            {t('username_confirm_label')}
            <input value={userNameConfirm} onChange={(e) => setUserNameConfirm(e.target.value)} required />
          </label>
          <label>
            {t('email_label')}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            {t('password_label')}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <span className="field-hint">{t('password_policy_hint')}</span>
          </label>
          <label>
            {t('password_confirm_label')}
            <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required minLength={6} />
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
