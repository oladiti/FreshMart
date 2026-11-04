// HaveIBeenPwned password screening (k-anonymity).
//
// The password is SHA-1 hashed locally; only the first 5 hex characters (the
// "prefix") are sent to the Pwned Passwords range API. The API returns every
// suffix sharing that prefix, and the match is decided locally - the full
// password (or even its full hash) never leaves the server.
//
// Fails OPEN: if the API is unreachable or slow we allow the password rather
// than blocking sign-ups during an outage. Disabled under NODE_ENV=test so the
// suite never depends on the network.

import crypto from 'crypto';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const REQUEST_TIMEOUT_MS = 2500;

// prefix -> { at, suffixes:Set<string> }
const cache = new Map();

export function isBreachCheckEnabled() {
  if (process.env.NODE_ENV === 'test') return false;
  const flag = process.env.BREACH_CHECK_ENABLED;
  if (flag === undefined || flag === '') return true;
  return !(flag === '0' || String(flag).toLowerCase() === 'false');
}

async function fetchRange(prefix) {
  const cached = cache.get(prefix);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.suffixes;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: {
        'Add-Padding': 'true',
        'User-Agent': 'FreshMart-Password-Check',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HIBP responded ${res.status}`);

    const text = await res.text();
    const suffixes = new Set();
    for (const line of text.split('\n')) {
      const suffix = line.split(':')[0]?.trim().toUpperCase();
      if (suffix) suffixes.add(suffix);
    }

    cache.set(prefix, { at: Date.now(), suffixes });
    // Bound the cache; Map preserves insertion order, so the first key is oldest.
    if (cache.size > MAX_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value);
    }
    return suffixes;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {unknown} password
 * @returns {Promise<boolean>} true when the password appears in a known breach
 */
export async function isPasswordBreached(password) {
  if (!isBreachCheckEnabled()) return false;
  if (typeof password !== 'string' || !password) return false;

  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const suffixes = await fetchRange(prefix);
    let found = false;
    for (const candidate of suffixes) {
      if (candidate === suffix) found = true;
    }
    return found;
  } catch (err) {
    console.warn('Password breach check failed (failing open):', err.message);
    return false;
  }
}

export function resetBreachCache() {
  cache.clear();
}

export default isPasswordBreached;
