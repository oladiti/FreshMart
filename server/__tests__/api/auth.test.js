import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  regularUser,
  adminUser,
  getUserDoc,
} from './apiSetup.js';

describe('Auth API', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user and returns a token', async () => {
      const res = await agent()
        .post('/api/auth/register')
        .send({ name: 'New Person', email: 'newperson@test.com', password: 'password123' });
      expect(res.status).toBe(201);
      expect(res.body._id).toBeTruthy();
      expect(res.body.email).toBe('newperson@test.com');
      expect(res.body.token).toBeTruthy();
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
        password: 'password123',
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
      expect(res.body.token).toBeTruthy();
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
