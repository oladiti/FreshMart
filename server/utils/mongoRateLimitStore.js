// A MongoDB-backed store for express-rate-limit.
//
// The default in-memory store is per-process, so limits are reset on restart
// and are not shared across instances. Auth/refresh endpoints benefit from a
// shared, durable counter. Counters live in `RateLimitCounter` with a TTL index.

import RateLimitCounter from '../models/RateLimitCounter.js';

export class MongoRateLimitStore {
  constructor({ prefix = 'rl:', windowMs = 60_000 } = {}) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  // express-rate-limit calls this once with the limiter options.
  init(options = {}) {
    if (options.windowMs) this.windowMs = options.windowMs;
    if (options.prefix) this.prefix = options.prefix;
  }

  key(clientKey) {
    return `${this.prefix}${clientKey}`;
  }

  async increment(clientKey) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.windowMs);
    const key = this.key(clientKey);

    // Single atomic pipeline update: start (or restart, when the window has
    // expired) the counter at 1, otherwise increment within the same window.
    const doc = await RateLimitCounter.findOneAndUpdate(
      { key },
      [
        {
          $set: {
            count: {
              $cond: [{ $gt: ['$expiresAt', now] }, { $add: ['$count', 1] }, 1],
            },
            expiresAt: {
              $cond: [{ $gt: ['$expiresAt', now] }, '$expiresAt', expiresAt],
            },
          },
        },
      ],
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return { totalHits: doc.count, resetTime: doc.expiresAt };
  }

  async decrement(clientKey) {
    await RateLimitCounter.updateOne(
      { key: this.key(clientKey), count: { $gt: 0 } },
      { $inc: { count: -1 } }
    );
  }

  async resetKey(clientKey) {
    await RateLimitCounter.deleteOne({ key: this.key(clientKey) });
  }

  async resetAll() {
    await RateLimitCounter.deleteMany({
      key: { $regex: `^${this.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` },
    });
  }
}

export default MongoRateLimitStore;
