// Optional authentication.
//
// Like `protect`, but never rejects: if a valid Bearer token is present the
// user is attached to the request; otherwise the request continues as
// anonymous. The AI chat is public (product and recipe questions must work for
// visitors) while cart/order tools enforce auth at the tool level.

import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const optionalAuth = async (req, _res, next) => {
  const header = req.headers.authorization || "";

  if (header.startsWith("Bearer ")) {
    try {
      const token = header.slice("Bearer ".length);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (user) req.user = user;
    } catch (error) {
      // Invalid/expired token: keep going anonymously rather than blocking the
      // public assistant surface.
    }
  }

  next();
};

export default optionalAuth;