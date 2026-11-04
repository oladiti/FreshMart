import User from '../models/User.js';
import { ACCESS_COOKIE, SETUP_COOKIE, readCookie } from '../utils/authCookies.js';
import { verifyAccessToken } from '../utils/jwt.js';

// Extract a bearer token from the HttpOnly access cookie (browser) or, as a
// fallback for API clients and tests, the Authorization header.
const extractToken = (req) => {
  const cookieToken = readCookie(req, ACCESS_COOKIE);
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer')) {
    return header.split(' ')[1];
  }
  return null;
};

// ✅ Protect routes (requires valid JWT)
export const protect = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    // Verify token (algorithm pinned to HS256)
    const decoded = verifyAccessToken(token);

    // Attach user to request (without password)
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Reject tokens issued before the last password change/reset. This revokes
    // every existing session the moment the password is changed.
    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res
        .status(401)
        .json({ message: 'Session expired, please log in again' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Accepts either a full access token OR the limited 2FA enrolment token. Used
// only by the 2FA setup/enable endpoints so an admin can enrol before a full
// session exists. Sets req.twoFactorSetup when the limited token was used.
export const protectOrTwoFactorSetup = async (req, res, next) => {
  const accessToken = extractToken(req);
  const setupToken = readCookie(req, SETUP_COOKIE);

  let decoded = null;
  let viaSetup = false;

  if (accessToken) {
    try {
      decoded = verifyAccessToken(accessToken);
    } catch {
      decoded = null;
    }
  }
  if (!decoded && setupToken) {
    try {
      const candidate = verifyAccessToken(setupToken);
      if (candidate.scope === '2fa_setup') {
        decoded = candidate;
        viaSetup = true;
      }
    } catch {
      decoded = null;
    }
  }

  if (!decoded) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res
        .status(401)
        .json({ message: 'Session expired, please log in again' });
    }
    req.user = user;
    req.twoFactorSetup = viaSetup;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Whether verified email is required before checkout/orders. Enabled by default
// in production; disabled in dev/test unless explicitly set, so local work
// isn't blocked when SMTP isn't configured.
const isVerificationRequired = () => {
  const flag = process.env.REQUIRE_EMAIL_VERIFICATION;
  if (flag === undefined || flag === '') return process.env.NODE_ENV === 'production';
  return !(flag === '0' || String(flag).toLowerCase() === 'false');
};



// ✅ Admin-only middleware
export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admins only' });
  }
};
