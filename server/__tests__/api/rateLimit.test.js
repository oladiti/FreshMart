import express from 'express';
import request from 'supertest';
import { createLimiter } from '../../middleware/rateLimit.js';

// These tests exercise the limiter directly through a tiny throwaway app. The
// shared limiters skip when NODE_ENV === 'test', so we flip it off for the
// duration of each case and restore it afterwards.
describe('rate limiter behaviour', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  const buildApp = (limiter) => {
    const app = express();
    app.set('trust proxy', false);
    app.get('/ping', limiter, (_req, res) => res.json({ ok: true }));
    return app;
  };

  it('allows requests up to the limit and blocks the rest with 429', async () => {
    process.env.NODE_ENV = 'production';
    const limiter = createLimiter({
      windowMs: 60 * 1000,
      limit: 3,
      keyGenerator: () => 'fixed-key',
      message: { message: 'Too many requests, slow down.' },
    });
    const app = buildApp(limiter);

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get('/ping');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many/i);

    const headers = Object.keys(blocked.headers);
    expect(
      headers.some((h) => h === 'ratelimit-limit' || h === 'x-ratelimit-limit')
    ).toBe(true);
  });

  it('resetKey clears the counter for a client', async () => {
    process.env.NODE_ENV = 'production';
    const limiter = createLimiter({
      windowMs: 60 * 1000,
      limit: 1,
      keyGenerator: () => 'reset-key',
    });
    const app = buildApp(limiter);

    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(429);

    limiter.resetKey('reset-key');

    expect((await request(app).get('/ping')).status).toBe(200);
  });

  it('is skipped while NODE_ENV === "test"', async () => {
    process.env.NODE_ENV = 'test';
    const limiter = createLimiter({
      windowMs: 60 * 1000,
      limit: 1,
      keyGenerator: () => 'skipped-key',
    });
    const app = buildApp(limiter);

    expect((await request(app).get('/ping')).status).toBe(200);
    // Would be 429 if the limiter were active.
    expect((await request(app).get('/ping')).status).toBe(200);
  });
});
