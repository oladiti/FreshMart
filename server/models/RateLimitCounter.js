import mongoose from 'mongoose';

// Persistent counters backing the express-rate-limit store so limits hold
// across restarts and multiple app instances. Rows self-expire via a TTL index.
const rateLimitCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false }
);

rateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimitCounter = mongoose.model('RateLimitCounter', rateLimitCounterSchema);

export default RateLimitCounter;
