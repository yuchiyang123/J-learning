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
      throw new Error('login_failed');
    }
    await refresh();
  }, [refresh]);

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
      throw new Error(body?.errors?.UserName?.[0] || 'register_failed');
    }
    await login(userName, password);
  }, [login]);

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
    () => ({ user, loading, isLoggedIn: !!user, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
