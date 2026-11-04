// Shared rate limiters.
//
// Disabled under NODE_ENV=test so the suite can hammer endpoints freely; the
// behaviour is exercised explicitly in __tests__/api/rateLimit.test.js, which
// constructs limiters via createLimiter and toggles NODE_ENV off "test".

import rateLimit from 'express-rate-limit';
import { MongoRateLimitStore } from '../utils/mongoRateLimitStore.js';

const skipInTests = () => process.env.NODE_ENV === 'test';

const tooMany = (message) => ({ message });

// Common configuration. `limit` is the v8 name for the request ceiling (`max`
// is deprecated). Exported so tests can build small, isolated limiters.
export const createLimiter = (overrides = {}) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTests,
    ...overrides,
  });

// Broad ceiling across the whole API to blunt scraping / brute force.
export const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: tooMany('Too many requests, please try again later.'),
});

// Tight limit on credential endpoints. Successful requests are exempt so only
// actual failures (wrong passwords, enumeration) count toward the ceiling.
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  // Shared, durable counter so the limit holds across restarts/instances.
  store: new MongoRateLimitStore({ prefix: 'rl:auth:' }),
  message: tooMany('Too many attempts. Please try again later.'),
});

// Public forms (contact / newsletter) get a moderate per-IP limit.
export const formLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  message: tooMany('Too many submissions. Please try again later.'),
});

// Dedicated limit for token refresh to blunt abuse.
export const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  store: new MongoRateLimitStore({ prefix: 'rl:refresh:' }),
  message: tooMany('Too many attempts. Please try again later.'),
});

export default { createLimiter, globalLimiter, authLimiter, formLimiter, refreshLimiter };
