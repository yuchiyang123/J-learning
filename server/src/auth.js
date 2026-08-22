import jwt from 'jsonwebtoken';

const { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = process.env;

// Verifies the `token` cookie Mini-SSO issues (shared across *.matthewyu.uk via
// Cookie:Domain) using the same signing secret — no network call back to
// Mini-SSO needed per-request. Does NOT check Mini-SSO's Redis revocation
// list, so a token stays technically valid here until its natural ~60min
// expiry even if the user logged out elsewhere; accepted tradeoff for not
// coupling this service to Mini-SSO's Redis instance.
function verify(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    return { id: payload.sub };
  } catch {
    return null;
  }
}

// Attaches req.user (or null) without blocking the request — for routes that
// behave differently when logged in but don't require it.
export function optionalAuth(req, res, next) {
  req.user = verify(req.cookies?.token);
  next();
}

// Blocks with 401 unless a valid session is present.
export function requireAuth(req, res, next) {
  req.user = verify(req.cookies?.token);
  if (!req.user) return res.status(401).json({ error: 'login required' });
  next();
}
