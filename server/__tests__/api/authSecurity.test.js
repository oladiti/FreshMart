import crypto from 'crypto';
import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  seedUsers,
  getUserDoc,
  regularUser,
} from './apiSetup.js';
import User from '../../models/User.js';
import { sendPasswordResetEmail } from '../../config/email.js';

// Keep email deterministic and offline: capture the links we generate instead
// of opening an SMTP connection.
jest.mock('../../config/email.js', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendNewLoginEmail: jest.fn().mockResolvedValue(true),
  sendOrderConfirmation: jest.fn().mockResolvedValue(true),
  sendMail: jest.fn().mockResolvedValue(true),
  isEmailConfigured: jest.fn().mockReturnValue(true),
}));

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Pull the value of a Set-Cookie entry (e.g. the access token cookie) out of a
// supertest response so it can be replayed as a Bearer token.
const cookieValue = (res, name) => {
  const entry = (res.headers['set-cookie'] || []).find((c) =>
    c.startsWith(`${name}=`)
  );
  return entry ? entry.split(';')[0].slice(name.length + 1) : null;
};

describe('Auth security', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('NoSQL injection defence', () => {
    it('rejects an operator object used as the login email', async () => {
      const res = await agent()
        .post('/api/auth/login')
        .send({ email: { $gt: '' }, password: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid credentials');
      expect(res.body.token).toBeUndefined();
    });

    it('rejects an operator object used as the register email', async () => {
      const res = await agent().post('/api/auth/register').send({
        name: 'Mallory',
        email: { $gt: '' },
        password: 'StrongPass123',
      });
      expect(res.status).toBe(400);
      expect(await User.countDocuments()).toBe(0);
    });
  });

  describe('password policy on register', () => {
    it.each([
      ['too short', 'abc1'],
      ['no number', 'abcdefghij'],
      ['no letter', '12345678901'],
      ['common password', 'password123'],
    ])('rejects a %s password with a 400', async (_label, password) => {
      const res = await agent().post('/api/auth/register').send({
        name: 'Weak',
        email: `${_label.replace(/\s+/g, '-')}@test.com`,
        password,
      });
      expect(res.status).toBe(400);
      expect(await User.countDocuments()).toBe(0);
    });

    it('accepts a strong password', async () => {
      const res = await agent().post('/api/auth/register').send({
        name: 'Strong',
        email: 'strong@test.com',
        password: 'FreshMart2024',
      });
      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/auth/profile password change', () => {
    beforeEach(async () => {
      await seedUsers();
    });

    const changePassword = async (body) => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      return agent()
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    };

    it('requires the current password to set a new one', async () => {
      const res = await changePassword({ password: 'FreshMart2024' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/current password is required/i);
    });

    it('rejects an incorrect current password', async () => {
      const res = await changePassword({
        currentPassword: 'not-my-password',
        password: 'FreshMart2024',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/incorrect/i);
    });

    it('applies the password policy to the new password', async () => {
      const res = await changePassword({
        currentPassword: regularUser.password,
        password: 'weak',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least/i);
    });

    it('changes the password when the current one is correct', async () => {
      const res = await changePassword({
        currentPassword: regularUser.password,
        password: 'FreshMart2024',
      });
      expect(res.status).toBe(200);

      const login = await agent()
        .post('/api/auth/login')
        .send({ email: regularUser.email, password: 'FreshMart2024' });
      expect(login.status).toBe(200);
      const loginCookies = login.headers['set-cookie'] || [];
      expect(loginCookies.some((c) => c.startsWith('fm_at='))).toBe(true);

      const old = await agent()
        .post('/api/auth/login')
        .send({ email: regularUser.email, password: regularUser.password });
      expect(old.status).toBe(400);
    });
  });



  describe('session revocation', () => {
    beforeEach(async () => {
      await seedUsers();
    });

    it('rejects a token issued before a profile password change', async () => {
      const user = await getUserDoc();
      const oldToken = generateToken(user._id, user.role);

      const before = await agent()
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${oldToken}`);
      expect(before.status).toBe(200);

      const changed = await agent()
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({
          currentPassword: regularUser.password,
          password: 'FreshMart2024',
        });
      expect(changed.status).toBe(200);
      // The current session is handed fresh cookies (no token in the body)...
      const freshToken = cookieValue(changed, 'fm_at');
      expect(freshToken).toBeTruthy();

      // ...but the old token is now stale.
      const stale = await agent()
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${oldToken}`);
      expect(stale.status).toBe(401);

      const fresh = await agent()
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${freshToken}`);
      expect(fresh.status).toBe(200);
    });

    it('rejects a token issued before a password reset', async () => {
      const user = await getUserDoc();
      const oldToken = generateToken(user._id, user.role);

      const raw = crypto.randomBytes(32).toString('hex');
      await User.updateOne(
        { _id: user._id },
        {
          resetPasswordToken: hash(raw),
          resetPasswordExpire: Date.now() + 3600 * 1000,
        }
      );

      const reset = await agent()
        .put(`/api/auth/reset-password/${raw}`)
        .send({ password: 'FreshMart2024' });
      expect(reset.status).toBe(200);

      const stale = await agent()
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${oldToken}`);
      expect(stale.status).toBe(401);
    });
  });

  describe('email links are built from CLIENT_URL', () => {
    beforeEach(async () => {
      await seedUsers();
      sendPasswordResetEmail.mockClear();
    });

    it('ignores a spoofed Host header when building reset links', async () => {
      const res = await agent()
        .post('/api/auth/forgot-password')
        .set('Host', 'evil.example.com')
        .send({ email: regularUser.email });

      expect(res.status).toBe(200);
      expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

      const [, resetUrl] = sendPasswordResetEmail.mock.calls[0];
      expect(resetUrl).toContain('/reset-password/');
      expect(resetUrl.startsWith(process.env.CLIENT_URL)).toBe(true);
      expect(resetUrl).not.toContain('evil.example.com');
    });
  });
});
