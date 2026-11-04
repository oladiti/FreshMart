// Recursively strip dangerous keys from request input.
//
// Mongo interprets keys beginning with `$` as query operators and `.` as path
// traversal, so input like { "email": { "$gt": "" } } can bypass equality
// checks. Prototype-pollution keys are removed for the same reason.
//
// This runs on both the parsed body and the query string. It is the primary
// defence against NoSQL injection for HTTP input; we deliberately do NOT enable
// mongoose's global `sanitizeFilter`, because that rewrites *every* filter -
// including the server's own operator queries ($gt, $regex, $gte, ...) - into
// `{ $eq: ... }` and breaks them. Controllers still validate their inputs.

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  // Inspect the prototype rather than `value.constructor`: an own `constructor`
  // property (which JSON.parse can produce) would otherwise mask the check and
  // let the whole object - operators included - pass through untouched.
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const stripKeys = (value) => {
  if (Array.isArray(value)) return value.map(stripKeys);
  if (!isPlainObject(value)) return value;

  const clean = {};
  for (const [key, val] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.') || FORBIDDEN_KEYS.has(key)) {
      continue;
    }
    clean[key] = stripKeys(val);
  }
  return clean;
};

export const sanitizeRequest = (req, _res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = stripKeys(req.body);
  }
  // Express parses the query string with `qs`, which can build nested objects
  // (e.g. ?filter[$ne]=x). Strip operators from those too.
  if (req.query && typeof req.query === 'object') {
    req.query = stripKeys(req.query);
  }
  next();
};

export default sanitizeRequest;
