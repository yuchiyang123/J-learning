import crypto from 'node:crypto';

// Stateless double-submit cookie CSRF defense for this app's own API
// (separate from Mini-SSO's own XSRF-TOKEN, which only covers its auth
// endpoints). The cookie is httpOnly — the client never reads it directly,
// it gets the token from this endpoint's JSON body instead — so validation
// is just "does the header match the cookie", no server-side token store
// needed: a cross-site attacker can neither read nor set this cookie for
// j-learning.matthewyu.uk, so they can never make the two match.
export const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

export function issueCsrfToken(req, res) {
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: req.secure,
    sameSite: 'lax',
    maxAge: 4 * 60 * 60 * 1000,
  });
  res.json({ csrfToken: token });
}

export function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'csrf token invalid or missing' });
  }
  next();
}
