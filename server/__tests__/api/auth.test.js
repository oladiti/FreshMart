import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  seedUsers,
  regularUser,
  adminUser,
  getUserDoc,
} from './apiSetup.js';

describe('Auth API', () => {
  beforeAll(async () => {
    await setupApiTest();
    await seedUsers();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user and sets auth cookies', async () => {
      const res = await agent()
        .post('/api/auth/register')
        .send({ name: 'New Person', email: 'newperson@test.com', password: 'StrongPass123' });
      expect(res.status).toBe(201);
      expect(res.body._id).toBeTruthy();
      expect(res.body.email).toBe('newperson@test.com');
      expect(res.body.token).toBeUndefined();
      const cookies = res.headers['set-cookie'] || [];
      expect(cookies.some((c) => c.startsWith('fm_at='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('fm_rt='))).toBe(true);
      expect(res.body.role).toBe('user');
    });

    it('returns 400 for a duplicate email', async () => {
      await agent().post('/api/auth/register').send({
        name: regularUser.name,
        email: regularUser.email,
        password: regularUser.password,
      });
      const res = await agent().post('/api/auth/register').send({
        name: 'Duplicate',
        email: regularUser.email,
        password: 'StrongPass123',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already exists');
    });

    it('falls back to 500 when required fields are missing', async () => {
      const res = await agent().post('/api/auth/register').send({});
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const res = await agent().post('/api/auth/login').send({
        email: regularUser.email,
        password: regularUser.password,
      });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(regularUser.email);
      expect(res.body.token).toBeUndefined();
      const cookies = res.headers['set-cookie'] || [];
      expect(cookies.some((c) => c.startsWith('fm_at='))).toBe(true);
    });

    it('returns 400 for a wrong password', async () => {
      const res = await agent().post('/api/auth/login').send({
        email: regularUser.email,
        password: 'wrongpass123',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('returns 400 for a non-existent user', async () => {
      const res = await agent().post('/api/auth/login').send({
        email: 'ghost@test.com',
        password: 'whatever123',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('returns the profile with a valid token', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(regularUser.email);
      expect(res.body.password).toBeUndefined();
    });

    it('returns 401 without a token', async () => {
      const res = await agent().get('/api/auth/profile');
      expect(res.status).toBe(401);
    });

    it('returns 401 with an invalid token', async () => {
      const res = await agent()
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('updates the profile name', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed User' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed User');
    });

    it('saves a compressed avatar and returns it from the profile', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const avatar = `data:image/jpeg;base64,${Buffer.from('avatar-bytes').toString('base64')}`;

      const res = await agent()
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ avatar });

      expect(res.status).toBe(200);
      expect(res.body.avatar).toBe(avatar);

      const profile = await agent()
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(profile.status).toBe(200);
      expect(profile.body.avatar).toBe(avatar);
    });

    it('clears an avatar with an empty string', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const avatar = `data:image/png;base64,${Buffer.from('avatar-bytes').toString('base64')}`;

      await agent()
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ avatar });

      const res = await agent()
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ avatar: '' });

      expect(res.status).toBe(200);
      expect(res.body.avatar).toBe('');
    });

    it('rejects malformed avatar data', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ avatar: 'not-an-image' });

      expect(res.status).toBe(400);
    });

    it('rejects avatars larger than the storage cap', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const avatar = `data:image/jpeg;base64,${'A'.repeat(700001)}`;
      const res = await agent()
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ avatar });

      expect(res.status).toBe(400);
    });

    it('returns 401 without a token', async () => {
      const res = await agent().put('/api/auth/profile').send({ name: 'X' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('returns a generic message for unknown email', async () => {
      const res = await agent()
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@test.com' });
      expect(res.status).toBe(200);
      expect(res.body.devResetLink).toBeUndefined();
    });

    it('returns 400 when email is missing', async () => {
      const res = await agent().post('/api/auth/forgot-password').send({});
      expect(res.status).toBe(400);
    });
  });
});
