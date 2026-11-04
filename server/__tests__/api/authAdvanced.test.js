import request from 'supertest';
import { authenticator } from 'otplib';
import { setupApiTest, teardownApiTest, getApp } from './apiSetup.js';
import User from '../../models/User.js';

const app = getApp();

// Created directly through the model, so the (stricter) registration password
// policy does not apply here.
const PASSWORD = 'user123';

const cookieValue = (res, name) => {
  const entry = (res.headers['set-cookie'] || []).find((c) =>
    c.startsWith(`${name}=`)
  );
  return entry ? entry.split(';')[0].slice(name.length + 1) : null;
};

const makeUser = (email, extra = {}) =>
  User.create({ name: 'Adv User', email, password: PASSWORD, ...extra });

const login = (agent, email, body = {}) =>
  agent.post('/api/auth/login').send({ email, password: PASSWORD, ...body });

describe('Advanced auth', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  describe('account lockout', () => {
    const email = 'lock@test.com';

    beforeAll(async () => {
      await makeUser(email);
    });

    it('locks the account after 5 failed attempts and rejects the correct password', async () => {
      for (let i = 0; i < 5; i += 1) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email, password: 'wrongpass' });
        expect(res.status).toBe(400);
      }

      const locked = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD });
      expect(locked.status).toBe(423);
      expect(locked.body.lockedUntil).toBeTruthy();
    });
  });

  describe('two-factor authentication', () => {
    const email = 'twofa@test.com';

    beforeAll(async () => {
      await makeUser(email);
    });

    it('sets up, enables, enforces at login, and accepts then consumes a recovery code', async () => {
      const agent = request.agent(app);
      const initial = await login(agent, email);
      expect(initial.status).toBe(200);
      const csrf = cookieValue(initial, 'fm_csrf');

      const setup = await agent
        .post('/api/auth/2fa/setup')
        .set('X-CSRF-Token', csrf);
      expect(setup.status).toBe(200);
      expect(setup.body.secret).toBeTruthy();
      const { secret } = setup.body;

      const enable = await agent
        .post('/api/auth/2fa/enable')
        .set('X-CSRF-Token', csrf)
        .send({ code: authenticator.generate(secret) });
      expect(enable.status).toBe(200);
      expect(enable.body.twoFactorEnabled).toBe(true);
      expect(enable.body.recoveryCodes).toHaveLength(10);
      const recoveryCode = enable.body.recoveryCodes[0];

      // Password alone is no longer sufficient.
      const noCode = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD });
      expect(noCode.status).toBe(401);
      expect(noCode.body.twoFactorRequired).toBe(true);

      // A wrong code is rejected.
      const badCode = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD, twoFactorCode: '000000' });
      expect(badCode.status).toBe(400);

      // A valid TOTP code succeeds.
      const good = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD, twoFactorCode: authenticator.generate(secret) });
      expect(good.status).toBe(200);

      // A recovery code works once, then is consumed.
      const withRecovery = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD, twoFactorCode: recoveryCode });
      expect(withRecovery.status).toBe(200);

      const reused = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD, twoFactorCode: recoveryCode });
      expect(reused.status).toBe(400);
    });
  });

  describe('active sessions', () => {
    const email = 'sessions@test.com';

    beforeAll(async () => {
      await makeUser(email);
    });

    it('lists sessions, flags the current one, and revokes another', async () => {
      const agent1 = request.agent(app);
      const res1 = await login(agent1, email);
      const csrf1 = cookieValue(res1, 'fm_csrf');

      const agent2 = request.agent(app);
      await login(agent2, email);

      const list = await agent1.get('/api/auth/sessions');
      expect(list.status).toBe(200);
      expect(list.body.length).toBeGreaterThanOrEqual(2);

      const current = list.body.find((s) => s.current);
      const other = list.body.find((s) => !s.current);
      expect(current).toBeTruthy();
      expect(other).toBeTruthy();

      const revoke = await agent1
        .delete(`/api/auth/sessions/${other.id}`)
        .set('X-CSRF-Token', csrf1);
      expect(revoke.status).toBe(200);

      const after = await agent1.get('/api/auth/sessions');
      expect(after.body.find((s) => s.id === other.id)).toBeUndefined();
    });
  });
});
