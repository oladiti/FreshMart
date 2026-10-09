// Tiny in-memory sliding-window rate limiter for the AI chat endpoint.
//
// Kept deliberately simple: a Map of key -> timestamps. Keys are the user id
// when authenticated, otherwise the remote IP. The window is bounded and the
// map is pruned when it grows, so it cannot leak memory in a long-lived
// process. A per-process limiter is acceptable here; if this ever needs to run
// across multiple instances it should move to the database or Redis.

import getAiConfig from "./config.js";

const WINDOW_MS = 60 * 1000;
const PRUNE_THRESHOLD = 10_000;

const buckets = new Map();

/**
 * @param {string} key identity to throttle ("user:<id>" or "ip:<addr>")
 * @returns {boolean} true if the request is allowed
 */
export function checkRateLimit(key) {
  const { rateLimitPerMin } = getAiConfig();
  const now = Date.now();

  if (buckets.size > PRUNE_THRESHOLD) prune(now);

  const bucket = (buckets.get(key) || []).filter(
    (timestamp) => now - timestamp < WINDOW_MS
  );

  if (bucket.length >= rateLimitPerMin) {
    buckets.set(key, bucket);
    return false;
  }

  bucket.push(now);
  buckets.set(key, bucket);
  return true;
}

function prune(now) {
  for (const [key, bucket] of buckets) {
    const fresh = bucket.filter((timestamp) => now - timestamp < WINDOW_MS);
    if (!fresh.length) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

export function resetRateLimiter() {
  buckets.clear();
}

export default checkRateLimit;