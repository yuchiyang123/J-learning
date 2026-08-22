import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/api/auth/me`, { credentials: 'include' });
      setUser(res.ok ? await res.json() : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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

  const forgotPassword = useCallback(async (userName) => {
    const csrfToken = await getCsrfToken();
    await fetch(`${AUTH_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ userName }),
    });
  }, []);

  const resetPassword = useCallback(async (userName, code, newPassword) => {
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${AUTH_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ userName, code, newPassword }),
    });
    if (!res.ok) throw new Error('confirm_code_invalid');
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
      resetPassword,
    }),
    [user, loading, login, register, logout, refresh, confirmEmail, resendConfirmation, forgotPassword, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
