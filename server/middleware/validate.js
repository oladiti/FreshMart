// Request validation middleware (zod).
//
// Validates and coerces route input against explicit schemas before a
// controller runs. This is defence-in-depth on top of the controllers' own
// guards: it rejects wrong types, oversized strings and missing fields early
// with a predictable 400, and strips unknown keys.
//
// Usage:
//   router.post('/login', validate({ body: loginSchema }), loginUser)

import { ZodError } from 'zod';

const formatIssues = (error) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

/**
 * @param {{ body?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny }} schemas
 */
export function validate(schemas = {}) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      if (schemas.query) req.query = schemas.query.parse(req.query ?? {});
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          message: 'Invalid request',
          errors: formatIssues(err),
        });
      }
      return next(err);
    }
  };
}

export default validate;
