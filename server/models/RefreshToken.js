import mongoose from 'mongoose';

// One row per issued refresh token. Only the SHA-256 hash of the raw token is
// stored, so a database leak cannot be replayed. Rotation revokes the old row
// and inserts a new one; a replayed (already-revoked) token is treated as theft
// and revokes every active row for that user (see authController.refreshSession).
const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    // Session metadata, surfaced in the "active sessions" view so a user can
    // spot unfamiliar logins.
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// MongoDB TTL index: documents are auto-deleted once expiresAt passes.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
