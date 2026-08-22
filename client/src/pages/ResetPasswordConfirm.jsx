import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { isPasswordValid } from '../auth/passwordPolicy.js';

const ACTIVE_WINDOW_SEC = 5 * 60;

export default function ResetPasswordConfirm() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState('checking'); // checking | active | invalid | done
  const [secondsLeft, setSecondsLeft] = useState(ACTIVE_WINDOW_SEC);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);

  const { activateResetToken, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    activateResetToken(token).then((ok) => {
      setStatus(ok ? 'active' : 'invalid');
    });
  }, [token, activateResetToken]);

  useEffect(() => {
    if (status !== 'active') return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          setStatus('invalid');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [status]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('register_password_mismatch'));
      return;
    }
    if (!isPasswordValid(newPassword)) {
      setError(t('register_password_weak'));
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      clearInterval(timerRef.current);
      setStatus('done');
    } catch {
      setError(t('reset_link_invalid'));
      setStatus('invalid');
    } finally {
      setSubmitting(false);
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (status === 'checking') {
    return <div className="page auth-page" />;
  }

  if (status === 'invalid') {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <h1><KeyRound size={22} /> {t('reset_password_title')}</h1>
          <p className="warning">{t('reset_link_invalid')}</p>
          <p className="auth-switch">
            <Link to="/forgot-password">{t('reset_password_title')}</Link>
          </p>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <h1><KeyRound size={22} /> {t('reset_password_done_title')}</h1>
          <p>{t('reset_password_done_desc')}</p>
          <button type="button" className="submit-btn" onClick={() => navigate('/login')}>{t('login_title')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1><KeyRound size={22} /> {t('reset_password_title')}</h1>
        <p className="reset-countdown">{t('reset_password_expires_in', { time: `${mm}:${ss}` })}</p>
        <form onSubmit={onSubmit} className="auth-form">
          <label>
            {t('reset_password_new_label')}
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            <span className="field-hint">{t('password_policy_hint')}</span>
          </label>
          <label>
            {t('password_confirm_label')}
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </label>
          {error && <p className="warning">{error}</p>}
          <button className="submit-btn" type="submit" disabled={submitting}>{t('reset_password_submit_btn')}</button>
        </form>
      </div>
    </div>
  );
}
