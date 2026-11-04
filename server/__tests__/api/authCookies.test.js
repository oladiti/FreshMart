import request from 'supertest';
import crypto from 'crypto';
import { setupApiTest, teardownApiTest, getApp, seedUsers, regularUser } from './apiSetup.js';
import RefreshToken from '../../models/RefreshToken.js';

const app = getApp();

// Parse a named cookie value out of a supertest response's Set-Cookie header.
const cookieValue = (res, name) => {
  const entry = (res.headers['set-cookie'] || []).find((c) =>
    c.startsWith(`${name}=`)
  );
  return entry ? entry.split(';')[0].slice(name.length + 1) : null;
};

const cookieAttributes = (res, name) => {
  const entry = (res.headers['set-cookie'] || []).find((c) =>
    c.startsWith(`${name}=`)
  );
  return entry || '';
};

const login = async (agent) => {
  const res = await agent
    .post('/api/auth/login')
    .send({ email: regularUser.email, password: regularUser.password });
  return {
    res,
    access: cookieValue(res, 'fm_at'),
    refresh: cookieValue(res, 'fm_rt'),
    csrf: cookieValue(res, 'fm_csrf'),
  };
};

describe('Cookie-based auth', () => {
  beforeAll(async () => {
    await setupApiTest();
    await seedUsers();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  beforeEach(async () => {
    await RefreshToken.deleteMany({});
  });

  describe('login cookies', () => {
    it('sets HttpOnly access/refresh cookies and a readable CSRF cookie', async () => {
      const agent = request.agent(app);
      const { res, access, refresh, csrf } = await login(agent);

      expect(res.status).toBe(200);
      expect(access).toBeTruthy();
      expect(refresh).toBeTruthy();
      expect(csrf).toBeTruthy();

      expect(cookieAttributes(res, 'fm_at')).toMatch(/HttpOnly/i);
      expect(cookieAttributes(res, 'fm_rt')).toMatch(/HttpOnly/i);
      // CSRF cookie must be readable by the SPA.
      expect(cookieAttributes(res, 'fm_csrf')).not.toMatch(/HttpOnly/i);
    });

    it('authenticates a protected request using only the cookie', async () => {
      const agent = request.agent(app);
      await login(agent);

      const res = await agent.get('/api/auth/profile');
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(regularUser.email);
    });
  });

  describe('refresh rotation', () => {
    it('issues a new access token on refresh', async () => {
      const agent = request.agent(app);
      const { csrf } = await login(agent);

      const res = await agent
        .post('/api/auth/refresh')
        .set('X-CSRF-Token', csrf);
      expect(res.status).toBe(200);
      expect(cookieValue(res, 'fm_at')).toBeTruthy();
      expect(cookieValue(res, 'fm_rt')).toBeTruthy();
    });

    it('treats a replayed (already-rotated) refresh token as theft', async () => {
      const agent = request.agent(app);
      const { refresh, csrf } = await login(agent);

      // Rotate once legitimately; this revokes the original refresh token.
      const rotated = await agent
        .post('/api/auth/refresh')
        .set('X-CSRF-Token', csrf);
      expect(rotated.status).toBe(200);

      // Replaying the old token must be rejected...
      const replay = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `fm_rt=${refresh}; fm_csrf=csrfvalue`)
        .set('X-CSRF-Token', 'csrfvalue');
      expect(replay.status).toBe(401);

      // ...and the rotated token is revoked too (whole family invalidated).
      const rotatedToken = cookieValue(rotated, 'fm_rt');
      const after = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `fm_rt=${rotatedToken}; fm_csrf=csrfvalue`)
        .set('X-CSRF-Token', 'csrfvalue');
      expect(after.status).toBe(401);
    });
  });

  describe('logout', () => {
    it('clears the auth cookies and revokes the refresh token', async () => {
      const agent = request.agent(app);
      const { csrf, refresh } = await login(agent);

      const res = await agent
        .post('/api/auth/logout')
        .set('X-CSRF-Token', csrf);
      expect(res.status).toBe(200);

      // The refresh token row is revoked in the database.
      const stored = await RefreshToken.findOne({
        tokenHash: crypto.createHash('sha256').update(refresh).digest('hex'),
      });
      expect(stored).toBeTruthy();
      expect(stored.revokedAt).toBeTruthy();
    });
  });

  describe('CSRF protection', () => {
    it('rejects an authenticated unsafe request without the CSRF header', async () => {
      const agent = request.agent(app);
      await login(agent);

      const res = await agent.post('/api/auth/logout');
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/csrf/i);
    });

    it('allows the same request when the CSRF header matches the cookie', async () => {
      const agent = request.agent(app);
      const { csrf } = await login(agent);

      const res = await agent
        .post('/api/auth/logout')
        .set('X-CSRF-Token', csrf);
      expect(res.status).toBe(200);
    });

    it('does not require a CSRF token for anonymous requests', async () => {
      const res = await request(app)
        .post('/api/contact')
        .send({ name: 'Anon', email: 'anon@test.com', message: 'hi' });
      expect(res.status).not.toBe(403);
    });
  });
});
