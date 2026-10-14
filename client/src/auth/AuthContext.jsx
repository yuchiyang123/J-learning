import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { refreshSession } from '../api.js';

// Mini-SSO: a separate service (its own repo) shared across everything under
// matthewyu.uk. It issues an HttpOnly JWT cookie scoped to the whole
// *.matthewyu.uk domain, so once logged in here the same cookie is
// automatically sent to this app's own API too (see server/src/auth.js,
// which verifies it locally with the shared signing secret).
const AUTH_BASE = 'https://auth.matthewyu.uk';

const AuthContext = createContext(null);

async function getCsrfToken() {
  const res = await fetch(`${AUTH_BASE}/api/auth/csrf`, { credentials: 'include' });
  const { csrfToken } = await res.json();
  return csrfToken;
}

// The last user /me confirmed, kept on the device. The /me round trip to
// the SSO service can take seconds on some networks (Cloudflare routes HiNet
// traffic overseas), and every logged-in page used to wait for it before
// even starting its own requests. Starting from the remembered user lets
// them begin at once; /me still runs and, if the session is gone, flips the
// UI to logged out. This only decides what the UI shows first — the API
// verifies the session cookie on every request regardless.
const USER_HINT_KEY = 'jp_auth_user';
function readUserHint() {
  try {
    const u = JSON.parse(localStorage.getItem(USER_HINT_KEY) || 'null');
    return u && typeof u === 'object' && u.id ? u : null;
  } catch {
    return null;
  }
}
function writeUserHint(u) {
  try {
    if (u) localStorage.setItem(USER_HINT_KEY, JSON.stringify({ id: u.id, userName: u.userName }));
    else localStorage.removeItem(USER_HINT_KEY);
  } catch { /* storage unavailable */ }
}

export function AuthProvider({ children }) {
  const [hint] = useState(readUserHint);
  const [user, setUserState] = useState(hint);
  const [loading, setLoading] = useState(!hint);
  const setUser = useCallback((u) => { setUserState(u); writeUserHint(u); }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/api/auth/me`, { credentials: 'include' });
      const next = res.ok ? await res.json() : null;
      // Keep the same object when /me just confirms the remembered user, so
      // pages don't refetch because `user` changed identity.
      setUserState((prev) => (prev && next && prev.id === next.id && prev.userName === next.userName ? prev : next));
      writeUserHint(next);
    } catch {
      // Network failure isn't a logout: keep the remembered user (the API
      // still enforces the real session) rather than flashing logged out.
      if (!hint) setUser(null);
    } finally {
      setLoading(false);
    }
  }, [hint, setUser]);

  useEffect(() => { refresh(); }, [refresh]);

  // The access token cookie only lives 60 minutes; a much longer-lived
  // refresh token rides along but nothing was ever calling it, so a study
  // session longer than an hour silently logged the user out mid-session.
  // Renewing it every 45 min (before it actually expires) while the app
  // stays open covers that — including the quiz-submit endpoints, which
  // don't 401 on an expired token at all (optionalAuth just grades them as
  // a logged-out guest instead), so they'd never trigger api.js's reactive
  // retry-after-401 refresh on their own.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => { refreshSession(); }, 45 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  const login = useCallback(async (userName, password) => {
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${AUTH_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ userName, password }),
    });
    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        throw new Error(`login_locked:${retryAfter || ''}`);
      }
      const body = await res.json().catch(() => ({}));
      if (body?.errors?.EmailConfirmed) {
        throw new Error('login_email_unconfirmed');
      }
      throw new Error('login_failed');
    }
    await refresh();
  }, [refresh]);

  // Does NOT log in afterwards — Mini-SSO now requires email confirmation
  // before a password-registered account can log in (server/-side check),
  // so the caller should show a "check your email" message instead.
  const register = useCallback(async (userName, password, email) => {
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${AUTH_BASE}/api/auth/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ userName, password, email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body?.errors?.UserName) throw new Error('register_username_taken');
      if (body?.errors?.Email) throw new Error('register_email_taken');
      throw new Error('register_failed');
    }
  }, []);

  const confirmEmail = useCallback(async (userName, code) => {
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${AUTH_BASE}/api/auth/confirm-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ userName, code }),
    });
    if (!res.ok) throw new Error('confirm_code_invalid');
  }, []);

  const resendConfirmation = useCallback(async (userName) => {
    const csrfToken = await getCsrfToken();
    await fetch(`${AUTH_BASE}/api/auth/resend-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ userName }),
    });
    // Always "succeeds" from the caller's perspective — the server intentionally
    // doesn't reveal whether the account exists, so there's nothing to branch on.
  }, []);

  // Password reset uses an emailed link, not a code — see AuthContext/Mini-SSO's
  // reset endpoints. redirectBaseUrl tells Mini-SSO which frontend to point the
  // link back to; it's validated server-side against an origin allow-list.
  const forgotPassword = useCallback(async (userName) => {
    const csrfToken = await getCsrfToken();
    await fetch(`${AUTH_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ userName, redirectBaseUrl: window.location.origin }),
    });
  }, []);

  // Call when the /reset-password?token=... landing page loads — starts the
  // 5-minute window the user has to actually submit a new password.
  const activateResetToken = useCallback(async (token) => {
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${AUTH_BASE}/api/auth/reset-password/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });
    return res.ok;
  }, []);

  const resetPassword = useCallback(async (token, newPassword) => {
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${AUTH_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ token, newPassword }),
    });
    if (!res.ok) throw new Error('reset_link_invalid');
  }, []);

  const logout = useCallback(async () => {
    const csrfToken = await getCsrfToken();
    await fetch(`${AUTH_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'X-CSRF-TOKEN': csrfToken },
      credentials: 'include',
    });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isLoggedIn: !!user,
      login,
      register,
      logout,
      refresh,
      confirmEmail,
      resendConfirmation,
      forgotPassword,
      activateResetToken,
      resetPassword,
    }),
    [
      user,
      loading,
      login,
      register,
      logout,
      refresh,
      confirmEmail,
      resendConfirmation,
      forgotPassword,
      activateResetToken,
      resetPassword,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
