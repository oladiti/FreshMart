import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import {
  generateSecret,
  buildOtpAuthUrl,
  buildQrDataUrl,
  verifyTotp,
  generateRecoveryCodes,
} from '../utils/twoFactor.js';
import { clearSetupCookie } from '../utils/authCookies.js';
import { establishSession, sessionMeta } from './authController.js';
import { auditLog } from '../utils/audit.js';

// ðŸ“Œ Begin TOTP setup: generate a secret and return the otpauth URL + QR image.
// The secret is stored but 2FA is not enabled until a valid code is confirmed.
export const setupTwoFactor = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.twoFactorEnabled) {
      return res
        .status(400)
        .json({ message: 'Two-factor authentication is already enabled' });
    }

    const secret = generateSecret();
    user.twoFactorSecret = secret;
    await user.save();

    const otpauthUrl = buildOtpAuthUrl(user.email, secret);
    const qrDataUrl = await buildQrDataUrl(otpauthUrl);

    res.json({ secret, otpauthUrl, qrDataUrl });
  } catch (err) {
    next(err);
  }
};

// ðŸ“Œ Confirm the first code, enable 2FA, and return one-time recovery codes.
export const enableTwoFactor = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'A verification code is required' });
    }

    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.twoFactorEnabled) {
      return res
        .status(400)
        .json({ message: 'Two-factor authentication is already enabled' });
    }
    if (!user.twoFactorSecret) {
      return res
        .status(400)
        .json({ message: 'Start the two-factor setup before enabling it' });
    }
    if (!verifyTotp(code, user.twoFactorSecret)) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    const { codes, hashes } = generateRecoveryCodes();
    user.twoFactorEnabled = true;
    user.twoFactorRecoveryCodes = hashes;
    await user.save();

    try { await auditLog({ req, actor: user, action: 'auth.2fa.enabled', target: user.email }); } catch (e) {}

    // Enrolment completed from the limited setup token: grant the full session
    // the admin was blocked from at login and drop the short-lived token.
    if (req.twoFactorSetup) {
      clearSetupCookie(res, req);
      await establishSession(req, res, user, sessionMeta(req));
    }

    res.json({ twoFactorEnabled: true, recoveryCodes: codes });
  } catch (err) {
    next(err);
  }
};

// ðŸ“Œ Disable 2FA. Requires the account password so a hijacked session alone
// cannot remove the second factor.
export const disableTwoFactor = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { password } = req.body;
    if (!password) {
      return res
        .status(400)
        .json({ message: 'Password is required to disable two-factor authentication' });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorRecoveryCodes = [];
    await user.save();

    res.json({ twoFactorEnabled: false });
  } catch (err) {
    next(err);
  }
};

export default { setupTwoFactor, enableTwoFactor, disableTwoFactor };

