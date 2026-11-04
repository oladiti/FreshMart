import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
      
import { signAccessToken } from '../utils/jwt.js';
import { sendPasswordResetEmail, sendNewLoginEmail } from '../config/email.js';
import { validatePassword } from '../utils/passwordPolicy.js';
import { isPasswordBreached } from '../utils/breachCheck.js';
import { verifyTotp, hashRecoveryCode } from '../utils/twoFactor.js';
import { auditLog, getClientIp, getUserAgent } from "../utils/audit.js";
import {
  REFRESH_COOKIE,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  parseDurationMs,
  setAuthCookies,
  clearAuthCookies,
  setSetupCookie,
  clearSetupCookie,
  readCookie,
} from '../utils/authCookies.js';

// Access-token lifetime. Access tokens are short-lived and delivered as an
// HttpOnly cookie; the refresh token (see establishSession) renews the session.
const JWT_EXPIRES_IN = ACCESS_TOKEN_TTL;
const REFRESH_MAX_AGE = parseDurationMs(
  REFRESH_TOKEN_TTL,
  7 * 24 * 60 * 60 * 1000
);

// ✅ Utility: Generate an access JWT. `tv` (token version) lets us revoke every
// token issued before a password change/reset by bumping User.tokenVersion.
const generateToken = (id, role, tokenVersion = 0, scope, expiresIn = JWT_EXPIRES_IN) => {
  const payload = { id, role, tv: tokenVersion };
  if (scope) payload.scope = scope;
  return signAccessToken(payload, expiresIn);
};

// Whether admins must have TOTP 2FA enabled. Enabled by default; disabled in
// tests so the admin suite isn't forced through enrolment.
const isAdmin2faRequired = () => {
  const flag = process.env.REQUIRE_ADMIN_2FA;
  // Enabled by default outside tests; tests must opt in explicitly so the
  // existing admin fixtures keep working.
  if (flag === undefined || flag === '') return process.env.NODE_ENV !== 'test';
  return !(flag === '0' || String(flag).toLowerCase() === 'false');
};

// Base URL the storefront is served from, used to build email links. Reading it
// from config (rather than the request's Host header) prevents host-header
// injection from poisoning password-reset / verification links.
const clientUrl = () => {
  const configured = (process.env.CLIENT_URL || '').trim() || 'http://localhost:5173';
  return configured.replace(/\/+$/, '');
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Account lockout thresholds. After MAX_FAILED_LOGINS consecutive failures the
// account is locked for LOCKOUT_MS; a success clears the counter.
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// A valid bcrypt hash used only to equalise login timing when the account does
// not exist, so response time can't reveal which emails are registered. It is
// never a real account's hash.
const DUMMY_PASSWORD_HASH =
  '$2b$10$3iWGQSgNJp0V5F9XGU8CA..J7udSvw1kFwbzMyUNCOOlvsvbnbgay';

// Shared copy for the HaveIBeenPwned rejection so every password-setting path
// responds identically.
const BREACHED_PASSWORD_MESSAGE =
  'This password has appeared in a data breach. Please choose a different password';

// Best-effort client metadata for the "active sessions" view.
export const sessionMeta = (req) => ({
  userAgent: String(req.headers?.['user-agent'] || '').slice(0, 300),
  ip: req.ip || '',
});

// Issue a random refresh token, storing only its hash, and return the raw value
// so it can be placed in the HttpOnly refresh cookie.
const issueRefreshToken = async (user, meta = {}) => {
  const raw = crypto.randomBytes(48).toString('hex');
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE),
    userAgent: meta.userAgent || '',
    ip: meta.ip || '',
    lastUsedAt: new Date(),
  });
  return raw;
};

// Start an authenticated session: mint an access token + rotating refresh token
// and hand both to the client as HttpOnly cookies, plus a readable CSRF cookie.
export const establishSession = async (req, res, user, meta = {}) => {
  const accessToken = generateToken(user._id, user.role, user.tokenVersion || 0);
  const refreshToken = await issueRefreshToken(user, meta);
  const csrfToken = crypto.randomBytes(32).toString('hex');

  setAuthCookies(res, { accessToken, refreshToken, csrfToken, req });

  return { accessToken, refreshToken, csrfToken };
};

// Best-effort "new sign-in" notification. A login from an IP we haven't seen
// before for this account triggers an email so the owner can spot hijacks.
// Skipped under the test suite; never blocks or fails the login itself.
const notifyNewLogin = async (req, user) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const isNewDevice = Boolean(ip) && ip !== user.lastLoginIp;

  user.lastLoginIp = ip;
  user.lastLoginUserAgent = userAgent;
  user.lastLoginAt = new Date();
  try {
    await user.save();
  } catch (err) {
    console.error('Failed to record login context:', err.message);
  }

  if (process.env.NODE_ENV === 'test' || !isNewDevice) return;
  try {
    await sendNewLoginEmail(user.email, {
      ip,
      userAgent,
      when: user.lastLoginAt,
    });
  } catch (err) {
    console.error('Failed to send new-login email:', err.message);
  }
};

// 📌 Register User
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Reject non-string input so operators/objects can't be smuggled into the
    // Mongo query below (e.g. { email: { $gt: "" } }).
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res
        .status(400)
        .json({ message: 'A valid email and password are required' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    // Screen against known breaches (no-op in tests / when disabled).
    if (await isPasswordBreached(password)) {
      return res.status(400).json({ message: BREACHED_PASSWORD_MESSAGE });
    }

    // Create user (the User model's pre-save hook hashes the password)
    const user = await User.create({
      name,
      email,
      password,
    });

    // Establish the session as HttpOnly cookies (no token in the body).
    await establishSession(req, res, user, sessionMeta(req));

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || '',
    });
  } catch (err) {
    next(err);
  }
};

// 📌 Login User
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Type-check before querying. Passing a Mongo operator object as `email`
    // would otherwise let an attacker bypass credential checks.
    if (typeof email !== 'string' || typeof password !== 'string') {
      try { await auditLog({ req, action: "auth.login.failure", target: null, success: false, metadata: { reason: "invalid_credentials" } }); } catch (e) {}
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Find user (include hidden auth fields needed for lockout + 2FA).
    const user = await User.findOne({ email }).select(
      '+password +failedLoginAttempts +lockUntil +twoFactorEnabled +twoFactorSecret +twoFactorRecoveryCodes +lastLoginIp'
    );
    if (!user) {
      // Perform a throwaway hash comparison so an unknown email takes about as
      // long as a wrong password, defeating a timing-based enumeration oracle.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH).catch(() => {});
      try { await auditLog({ req, action: "auth.login.failure", target: email, success: false, metadata: { reason: "unknown_user" } }); } catch (e) {}
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Reject while the account is locked, without revealing whether the
    // password was correct.
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      try { await auditLog({ req, actor: user, action: "auth.login.failure", target: email, success: false, metadata: { reason: "account_locked" } }); } catch (e) {}
      return res.status(423).json({
        message:
          'Account temporarily locked after too many failed attempts. Please try again later.',
        lockedUntil: user.lockUntil,
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
        user.lockUntil = new Date(Date.now() + LOCKOUT_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      try { await auditLog({ req, actor: user, action: "auth.login.failure", target: email, success: false, metadata: { reason: "bad_password" } }); } catch (e) {}
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Admin policy: an admin without 2FA must enrol before a full session is
    // granted. Issue a short-lived, limited-scope token that authorises only
    // the 2FA setup/enable endpoints.
    if (isAdmin2faRequired() && user.role === 'admin' && !user.twoFactorEnabled) {
      const setupToken = generateToken(
        user._id,
        user.role,
        user.tokenVersion || 0,
        '2fa_setup',
        '10m'
      );
      setSetupCookie(res, setupToken, req);
      try { await auditLog({ req, actor: user, action: "auth.login.2fa_setup_required", target: email, success: false }); } catch (e) {}
      return res.status(403).json({
        message: 'Two-factor authentication must be enabled before signing in.',
        twoFactorSetupRequired: true,
      });
    }

    // Second factor: if TOTP is enabled, require a valid code (or a one-time
    // recovery code) before issuing a session.
    let recoveryConsumed = false;
    if (user.twoFactorEnabled) {
      const code = req.body.twoFactorCode;
      if (!code) {
        try { await auditLog({ req, actor: user, action: "auth.login.failure", target: email, success: false, metadata: { reason: "two_factor_missing" } }); } catch (e) {}
        return res.status(401).json({
          message: 'Two-factor authentication code required',
          twoFactorRequired: true,
        });
      }

      let secondFactorOk = verifyTotp(code, user.twoFactorSecret);

      if (!secondFactorOk) {
        // Fall back to a recovery code, consuming it on success.
        const digest = hashRecoveryCode(code);
        const codes = user.twoFactorRecoveryCodes || [];
        if (codes.includes(digest)) {
          secondFactorOk = true;
          recoveryConsumed = true;
          user.twoFactorRecoveryCodes = codes.filter((h) => h !== digest);
        }
      }

      if (!secondFactorOk) {
        try { await auditLog({ req, actor: user, action: "auth.login.failure", target: email, success: false, metadata: { reason: "two_factor_failed" } }); } catch (e) {}
        return res.status(400).json({
          message: 'Invalid two-factor authentication code',
          twoFactorRequired: true,
        });
      }
    }

    // Successful login clears any failed-attempt/lock state and persists a
    // consumed recovery code.
    if (user.failedLoginAttempts || user.lockUntil || recoveryConsumed) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    // Establish the session as HttpOnly cookies (no token in the body).
    await establishSession(req, res, user, sessionMeta(req));
    try { await auditLog({ req, actor: user, action: "auth.login.success", target: user.email }); } catch (e) {}
    await notifyNewLogin(req, user);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified !== false,
      avatar: user.avatar || '',
    });
  } catch (err) {
    next(err);
  }
};

// 📌 Get Profile
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    next(err);
  }
};

// 📌 Update Profile
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    // Include the hash so we can confirm the current password before changing it.
    const user = await User.findById(userId).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Changing the password requires proving possession of the current one, so
    // a stolen/leaked token alone can't be used to take over the account.
    let passwordChanged = false;
    if (req.body.password) {
      if (!req.body.currentPassword) {
        return res
          .status(400)
          .json({ message: 'Current password is required to set a new password' });
      }
      const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      const passwordError = validatePassword(req.body.password);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }

      if (await isPasswordBreached(req.body.password)) {
        return res.status(400).json({ message: BREACHED_PASSWORD_MESSAGE });
      }

      user.password = req.body.password;
      // Revoke every previously-issued token by bumping the token version.
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      passwordChanged = true;
    }

    user.name = req.body.name || user.name;

    // Email changes
    if (req.body.email && req.body.email !== user.email) {
      user.email = req.body.email;
    }

    // An empty string clears the uploaded picture and restores initials.
    if (req.body.avatar !== undefined) {
      user.avatar = req.body.avatar;
    }

    await user.save();

    const response = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || '',
    };

    // A password change invalidates every previously-issued access token, so
    // silently re-establish this session with fresh cookies while all others
    // are now stale. Refresh tokens are version-independent, so revoke them all
    // first and let establishSession mint a fresh one for this device.
    if (passwordChanged) {
      await RefreshToken.updateMany(
        { user: user._id, revokedAt: null },
        { revokedAt: new Date() }
      );
      await establishSession(req, res, user, sessionMeta(req));
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
};

// 📌 Forgot password - generate reset token and email a reset link
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    // Always respond generically for security (don't reveal if email exists)
    if (!user) {
      return res.status(200).json({
        message: 'If an account exists for that email, a reset link has been sent.',
      });
    }

    // Generate a random token, store a hashed version in the DB
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const resetUrl = `${clientUrl()}/reset-password/${resetToken}`;

    let emailSent = false;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
      emailSent = true;
    } catch (err) {
      console.error('Failed to send reset email:', err.message);
    }

    // Dev fallback: when SMTP is not configured, return the link so it's usable.
    // Never do this in production -- a leaked reset link is an account takeover.
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(200).json({
      message: 'If an account exists for that email, a reset link has been sent.',
      devResetLink: !isProduction && !emailSent ? resetUrl : undefined,
      emailSent,
    });
  } catch (err) {
    next(err);
  }
};

// 📌 Reset password using the token from the reset link
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    if (await isPasswordBreached(password)) {
      return res.status(400).json({ message: BREACHED_PASSWORD_MESSAGE });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Password reset token is invalid or has expired.' });
    }

    // Set the new password (User pre-save hook hashes it), clear token fields,
    // and revoke every previously-issued token (all sessions must re-login).
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // A reset must also kill refresh tokens, which are not tied to tokenVersion.
    await RefreshToken.updateMany(
      { user: user._id, revokedAt: null },
      { revokedAt: new Date() }
    );

    res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
};



// 📌 Refresh session: exchange a valid refresh cookie for a new access cookie.
// Refresh tokens rotate on every use. If a token that has already been rotated
// (revoked) is presented, we treat it as theft: revoke every active refresh
// token for that user and bump tokenVersion so all sessions must re-login.
export const refreshSession = async (req, res, next) => {
  try {
    const raw = readCookie(req, REFRESH_COOKIE);
    if (!raw) {
      return res.status(401).json({ message: 'No refresh token' });
    }

    const tokenHash = hashToken(raw);
    const existing = await RefreshToken.findOne({ tokenHash });

    if (existing && existing.revokedAt) {
      await RefreshToken.updateMany(
        { user: existing.user, revokedAt: null },
        { revokedAt: new Date() }
      );
      await User.findByIdAndUpdate(existing.user, { $inc: { tokenVersion: 1 } });
      clearAuthCookies(res, req);


      return res
        .status(401)
        .json({ message: 'Session expired, please log in again' });
    }

    if (!existing || existing.expiresAt.getTime() < Date.now()) {
      clearAuthCookies(res, req);


      return res
        .status(401)
        .json({ message: 'Session expired, please log in again' });
    }

    const user = await User.findById(existing.user).select('-password');
    if (!user) {
      clearAuthCookies(res, req);


      return res.status(401).json({ message: 'User not found' });
    }

    // Rotate: revoke the presented token and issue a fresh pair.
    existing.revokedAt = new Date();
    existing.lastUsedAt = new Date();
    await existing.save();
    await establishSession(req, res, user, sessionMeta(req));
    try { await auditLog({ req, actor: user, action: "auth.login.success", target: user.email }); } catch (e) {}
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
};

// 📌 Logout: revoke the presented refresh token and clear all auth cookies.
export const logoutUser = async (req, res, next) => {
  try {
    const raw = readCookie(req, REFRESH_COOKIE);
    if (raw) {
      await RefreshToken.updateMany(
        { tokenHash: hashToken(raw), revokedAt: null },
        { revokedAt: new Date() }
      );
    }
    clearAuthCookies(res);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};





