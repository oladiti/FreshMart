// Auth cookie helpers.
//
// Cookie names are base names by default. When COOKIE_HOST_PREFIX is enabled
// and the request is served over HTTPS, the stronger `__Host-` prefix is used.
// `__Host-` requires Secure, Path=/ and no Domain, so it cannot be used across
// subdomains; it is therefore opt-in. Readers use `readCookie`, which accepts
// both the prefixed and bare names so a flip of the flag never locks anyone out.
export const ACCESS_COOKIE = 'fm_at';
export const REFRESH_COOKIE = 'fm_rt';
export const CSRF_COOKIE = 'fm_csrf';
// Short-lived token issued when an admin must enrol in 2FA before a full
// session is granted. It authorises only the 2FA setup/enable endpoints.
export const SETUP_COOKIE = 'fm_2fa';

export const HOST_PREFIX = '__Host-';
export const SETUP_MAX_AGE = 10 * 60 * 1000;

// Scope of the refresh cookie when it is NOT prefixed. `__Host-` forbids a
// non-root path, so a prefixed refresh cookie is scoped to `/` instead.
const REFRESH_PATH = '/api/auth';

export function parseDurationMs(value, fallbackMs) {
  if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;
  if (typeof value !== 'string') return fallbackMs;
  const match = value.trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
export const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '7d';

const ACCESS_MAX_AGE = parseDurationMs(ACCESS_TOKEN_TTL, 15 * 60 * 1000);
const REFRESH_MAX_AGE = parseDurationMs(REFRESH_TOKEN_TTL, 7 * 24 * 60 * 60 * 1000);
const CSRF_MAX_AGE = REFRESH_MAX_AGE;

const isProduction = () => process.env.NODE_ENV === 'production';

function getSecure(req) {
  // Trust the actual request scheme. Real production terminates TLS at the
  // proxy, so `x-forwarded-proto: https` is present and cookies are marked
  // Secure; a plain-HTTP request (e.g. http://localhost in dev) must not be,
  // or browsers reject the cookie. Only fall back to NODE_ENV when no request
  // context is available.
  if (!req) return isProduction();
  if (req.secure) return true;
  const proto = req.headers?.['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim() === 'https';
  }
  return false;
}

// Whether the stronger `__Host-` prefix should be used for this request. Only
// when explicitly enabled AND the cookie will be Secure (prefix requires it).
function useHostPrefix(req) {
  const flag = process.env.COOKIE_HOST_PREFIX;
  const enabled = flag !== undefined && flag !== '' && flag !== '0' && flag !== 'false';
  return enabled && getSecure(req);
}

// Auth cookies always use the base names internally. Every reader (auth
// middleware, CSRF guard, session controller) resolves the effective name via
// getCookieNames/readCookie so a prefixed deploy stays consistent.
export function getCookieNames(req) {
  const prefix = useHostPrefix(req) ? HOST_PREFIX : '';
  return {
    access: `${prefix}${ACCESS_COOKIE}`,
    refresh: `${prefix}${REFRESH_COOKIE}`,
    csrf: `${prefix}${CSRF_COOKIE}`,
    setup: `${prefix}${SETUP_COOKIE}`,
    prefixed: Boolean(prefix),
  };
}

// Read an auth cookie, tolerating any prefix left over from a previous
// configuration (prefixed first, then bare).
export function readCookie(req, base) {
  const cookies = req?.cookies || {};
  const names = getCookieNames(req);
  const resolved =
    base === ACCESS_COOKIE
      ? names.access
      : base === REFRESH_COOKIE
        ? names.refresh
        : base === CSRF_COOKIE
          ? names.csrf
          : base === SETUP_COOKIE
            ? names.setup
            : base;
  if (cookies[resolved] !== undefined) return cookies[resolved];
  return cookies[base];
}

// Short-lived HttpOnly cookie carrying the 2FA enrolment token.
export function setSetupCookie(res, token, req) {
  const secure = getSecure(req);
  const { setup } = getCookieNames(req);
  res.cookie(setup, token, {
    ...baseOptions(secure),
    maxAge: SETUP_MAX_AGE,
  });
}

export function clearSetupCookie(res, req) {
  const secure = getSecure(req);
  const { setup } = getCookieNames(req);
  const cleared = { ...baseOptions(secure), maxAge: 0 };
  res.clearCookie(setup, { ...cleared, path: '/' });
  res.clearCookie(SETUP_COOKIE, { ...cleared, path: '/' });
}

const baseOptions = (secure) => ({
  httpOnly: true,
  secure,
  sameSite: 'lax',
  path: '/',
});

export function setAuthCookies(res, { accessToken, refreshToken, csrfToken, req } = {}) {
  const secure = getSecure(req);
  const names = getCookieNames(req);
  const refreshPath = names.prefixed ? '/' : REFRESH_PATH;
  res.cookie(names.access, accessToken, {
    ...baseOptions(secure),
    maxAge: ACCESS_MAX_AGE,
  });

  if (refreshToken) {
    res.cookie(names.refresh, refreshToken, {
      ...baseOptions(secure),
      maxAge: REFRESH_MAX_AGE,
      path: refreshPath,
    });
  }

  if (csrfToken) {
    res.cookie(names.csrf, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: CSRF_MAX_AGE,
    });
  }
}

export function clearAuthCookies(res, req) {
  const secure = getSecure(req);
  const names = getCookieNames(req);
  const cleared = { ...baseOptions(secure), maxAge: 0 };

  // Clear the effective names and the bare names (in case the prefix changed),
  // across both the root and the scoped refresh path.
  res.clearCookie(names.access, { ...cleared, path: '/' });
  res.clearCookie(ACCESS_COOKIE, { ...cleared, path: '/' });
  for (const path of new Set([REFRESH_PATH, '/'])) {
    res.clearCookie(names.refresh, { ...cleared, path });
    res.clearCookie(REFRESH_COOKIE, { ...cleared, path });
  }
  res.clearCookie(names.csrf, { ...cleared, httpOnly: false, path: '/' });
  res.clearCookie(CSRF_COOKIE, { ...cleared, httpOnly: false, path: '/' });
}

export default {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  SETUP_COOKIE,
  HOST_PREFIX,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  parseDurationMs,
  getCookieNames,
  readCookie,
  setAuthCookies,
  clearAuthCookies,
  setSetupCookie,
  clearSetupCookie,
};
