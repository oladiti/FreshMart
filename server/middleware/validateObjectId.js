// Reject malformed Mongo ObjectId params with a clean 400 instead of letting
// mongoose throw a CastError that surfaces as a 500.

import mongoose from 'mongoose';

/**
 * @param {string} [param] the route param name to validate (default "id")
 * @returns {import('express').RequestHandler}
 */
export const validateObjectId = (param = 'id') => (req, res, next) => {
  const value = req.params?.[param];
  if (!mongoose.isValidObjectId(value)) {
    return res.status(400).json({ message: `Invalid ${param}` });
  }
  return next();
};

export default validateObjectId;
