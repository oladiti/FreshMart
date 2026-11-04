// CSRF protection (double-submit cookie).
//
// Cross-site requests must not be able to perform authenticated state changes.
// SameSite=Lax cookies are the primary defence, but a cross-site script could
// still trigger unsafe requests where SameSite is not enforced, so we require
// that any request carrying a session cookie also prove it can read the
// first-party CSRF cookie by echoing it back in the `X-CSRF-Token` header.
//
// A genuinely cross-origin attacker cannot read the cookie (or the response),
// so it cannot produce a matching header. Enforcement only kicks in when a
// session cookie is present, which keeps public/anonymous form posts working.

import crypto from 'crypto';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  readCookie,
} from '../utils/authCookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Constant-time string comparison so the cookie/header check cannot be probed
// byte-by-byte via response timing.
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

// Session-bootstrap endpoints legitimately run before a CSRF cookie exists (or
// re-issue one) and cannot be used to perform a privileged action on their own.
const EXEMPT_PATHS = [
  /^\/auth\/login$/,
  /^\/auth\/register$/,
  /^\/auth\/forgot-password$/,
  /^\/auth\/reset-password\//,
  /^\/auth\/verify-email\//,
];

export const csrfGuard = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const hasSession = Boolean(
    readCookie(req, ACCESS_COOKIE) || readCookie(req, REFRESH_COOKIE)
  );
  if (!hasSession) return next();

  const fullPath = (req.originalUrl || req.url || '').split('?')[0];
  const path = fullPath.startsWith('/api') ? fullPath.slice(4) : fullPath;
  if (EXEMPT_PATHS.some((pattern) => pattern.test(path))) return next();

  const header = req.headers['x-csrf-token'];
  const cookie = readCookie(req, CSRF_COOKIE);

  if (!cookie || !header || !safeEqual(String(header), String(cookie))) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  return next();
};

export default csrfGuard;
