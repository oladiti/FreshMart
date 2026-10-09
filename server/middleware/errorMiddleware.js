// middleware/errorMiddleware.js

// Not Found Middleware
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Error Handler Middleware
export const errorHandler = (err, req, res, next) => {
  // Map MongoDB unique-index violations (e.g. duplicate SKU) to a 409 instead
  // of a generic 500 so clients get a precise, actionable message.
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    const label =
      field === "sku" ? "Product code" : field.charAt(0).toUpperCase() + field.slice(1);
    return res.status(409).json({ message: `${label} already in use` });
  }

  const statusCode = err.statusCode || res.statusCode || 500;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
