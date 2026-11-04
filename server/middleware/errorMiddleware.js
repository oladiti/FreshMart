// middleware/errorMiddleware.js

// Not Found Middleware
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Error Handler Middleware
export const errorHandler = (err, req, res, next) => {
  // If a response is already streaming, we can't send another one.
  if (res.headersSent) return next(err);

  // Map MongoDB unique-index violations (e.g. duplicate SKU) to a 409 instead
  // of a generic 500 so clients get a precise, actionable message.
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    const label =
      field === "sku" ? "Product code" : field.charAt(0).toUpperCase() + field.slice(1);
    return res.status(409).json({ message: `${label} already in use` });
  }

  // A malformed ObjectId/slug in a route param or a schema validation failure is
  // a client error, not a server fault. Surface it as 400 so it isn't reported
  // as an internal error (and so the 5xx message-hiding branch above is skipped).
  if (err && err.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${err.path || "value"}` });
  }
  if (err && err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }

  // `res.statusCode` defaults to 200 on a fresh response, so it must never be
  // used as a fallback for errors that carry no explicit status: a ValidationError
  // would otherwise be reported to the client as a 200 success.
  const statusCode =
    err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const isProduction = process.env.NODE_ENV === 'production';

  // Log unexpected server errors server-side so we keep the diagnostic detail
  // without leaking internal messages (DB/driver errors, stack frames) to the
  // client in production.
  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  }

  const message =
    statusCode >= 500 && isProduction ? 'Something went wrong' : err.message;

  res.status(statusCode).json({
    message,
    stack: isProduction ? null : err.stack,
  });
};
