import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken.js';
import { REFRESH_COOKIE, readCookie } from '../utils/authCookies.js';
import { auditLog } from "../utils/audit.js";

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// ðŸ“Œ List the signed-in user's active sessions (never exposes the token hash).
export const listSessions = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const raw = readCookie(req, REFRESH_COOKIE);
    const currentHash = raw ? hashToken(raw) : null;

    const sessions = await RefreshToken.find({
      user: userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastUsedAt: -1 })
      .lean();

    res.json(
      sessions.map((s) => ({
        id: s._id,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        current: currentHash ? s.tokenHash === currentHash : false,
      }))
    );
  } catch (err) {
    next(err);
  }
};

// ðŸ“Œ Revoke a single session by id (only if it belongs to the caller).
export const revokeSession = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const session = await RefreshToken.findOneAndUpdate(
      { _id: req.params.id, user: userId, revokedAt: null },
      { revokedAt: new Date() }
    );

    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
};

// ðŸ“Œ Revoke every session except the current one ("sign out everywhere else").
export const revokeOtherSessions = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const raw = readCookie(req, REFRESH_COOKIE);
    const currentHash = raw ? hashToken(raw) : null;

    const filter = { user: userId, revokedAt: null };
    if (currentHash) filter.tokenHash = { $ne: currentHash };

    const result = await RefreshToken.updateMany(filter, { revokedAt: new Date() });
    res.json({
      message: 'Other sessions revoked',
      revoked: result.modifiedCount || 0,
    });
  } catch (err) {
    next(err);
  }
};

export default { listSessions, revokeSession, revokeOtherSessions };

