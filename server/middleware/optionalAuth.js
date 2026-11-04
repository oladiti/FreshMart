// Optional authentication.
//
// Like `protect`, but never rejects: if a valid token is present (in the
// HttpOnly access cookie or a Bearer header) the user is attached to the
// request; otherwise the request continues as anonymous. The AI chat is public
// (product and recipe questions must work for visitors) while cart/order tools
// enforce auth at the tool level.

import User from "../models/User.js";
import { ACCESS_COOKIE, readCookie } from "../utils/authCookies.js";
import { verifyAccessToken } from "../utils/jwt.js";

export const optionalAuth = async (req, _res, next) => {
  let token = readCookie(req, ACCESS_COOKIE) || null;

  if (!token) {
    const header = req.headers.authorization || "";
    if (header.startsWith("Bearer ")) {
      token = header.slice("Bearer ".length);
    }
  }

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select("-password");
      // Ignore tokens issued before the last password change/reset so a stale
      // session can't silently act as its owner.
      if (user && (decoded.tv ?? 0) === (user.tokenVersion ?? 0)) {
        req.user = user;
      }
    } catch (error) {
      // Invalid/expired token: keep going anonymously rather than blocking the
      // public assistant surface.
    }
  }

  next();
};

export default optionalAuth;