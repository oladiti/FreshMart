import express from 'express';
import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  refreshSession,
  logoutUser,
} from '../controllers/authController.js';
import {
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
} from '../controllers/twoFactorController.js';
import {
  listSessions,
  revokeSession,
  revokeOtherSessions,
} from '../controllers/sessionController.js';
import { protect, protectOrTwoFactorSetup } from '../middleware/authMiddleware.js';
import { authLimiter, refreshLimiter } from '../middleware/rateLimit.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  enableTwoFactorSchema,
  disableTwoFactorSchema,
} from '../schemas/authSchemas.js';

const router = express.Router();

// Public routes (rate-limited to slow credential stuffing / enumeration).
// Login is intentionally not schema-validated: the controller type-checks and
// returns a uniform "Invalid credentials" so operators can't be smuggled in and
// account existence isn't revealed.
router.post('/register', authLimiter, validate({ body: registerSchema }), registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/refresh', refreshLimiter, authLimiter, refreshSession);
router.post('/logout', logoutUser);
router.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), forgotPassword);
router.put('/reset-password/:token', authLimiter, validate(resetPasswordSchema), resetPassword);

// Protected routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, validate({ body: updateProfileSchema }), updateProfile);

// Two-factor authentication (TOTP). Setup/enable also accept the limited
// enrolment token issued when an admin is required to enable 2FA at login.
router.post('/2fa/setup', protectOrTwoFactorSetup, setupTwoFactor);
router.post('/2fa/enable', protectOrTwoFactorSetup, validate({ body: enableTwoFactorSchema }), enableTwoFactor);
router.post('/2fa/disable', protect, validate({ body: disableTwoFactorSchema }), disableTwoFactor);

// Active sessions
router.get('/sessions', protect, listSessions);
router.delete('/sessions', protect, revokeOtherSessions);
router.delete('/sessions/:id', protect, validateObjectId(), revokeSession);

export default router;
