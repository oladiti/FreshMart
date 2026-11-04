// Centralised JWT helpers.
//
// Signing and verifying go through here so the algorithm is pinned in one
// place. `jwt.verify` without an `algorithms` allow-list is vulnerable to
// algorithm-confusion attacks, so callers must not call it directly.

import jwt from 'jsonwebtoken';

export const JWT_ALGORITHM = 'HS256';

/**
 * Sign a short-lived access token.
 * @param {object} payload claims to embed (id, role, tv, ...)
 * @param {string} [expiresIn] jsonwebtoken lifetime string
 */
export function signAccessToken(payload, expiresIn) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    ...(expiresIn ? { expiresIn } : {}),
  });
}

/**
 * Verify an access token, pinning the accepted algorithm.
 * Throws on invalid/expired tokens (callers handle as 401/anonymous).
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
  });
}

export default { JWT_ALGORITHM, signAccessToken, verifyAccessToken };
