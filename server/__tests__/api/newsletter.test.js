import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  seedUsers,
  getAdminDoc,
  getUserDoc,
} from './apiSetup.js';
import Subscriber from '../../models/Subscriber.js';

describe('Newsletter API', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  beforeEach(async () => {
    await Subscriber.deleteMany({});
    await seedUsers();
  });

  describe('POST /api/newsletter', () => {
    it('stores a subscriber', async () => {
      const res = await agent()
        .post('/api/newsletter')
        .send({ email: 'shopper@example.com', source: 'home' });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Thanks for subscribing');
      expect(res.body.alreadySubscribed).toBe(false);

      const saved = await Subscriber.findOne({ email: 'shopper@example.com' });
      expect(saved).not.toBeNull();
      expect(saved.source).toBe('home');
    });

    it('does not require authentication', async () => {
      const res = await agent()
        .post('/api/newsletter')
        .send({ email: 'anon@example.com' });
      expect(res.status).toBe(201);
      expect(await Subscriber.countDocuments()).toBe(1);
    });

    it('normalizes case and surrounding whitespace', async () => {
      const res = await agent()
        .post('/api/newsletter')
        .send({ email: '  MixedCase@Example.COM  ' });

      expect(res.status).toBe(201);
      const saved = await Subscriber.findOne({});
      expect(saved.email).toBe('mixedcase@example.com');
      expect(await Subscriber.countDocuments()).toBe(1);
    });

    it('defaults the source to home and only accepts known sources', async () => {
      await agent().post('/api/newsletter').send({ email: 'a@example.com' });
      await agent()
        .post('/api/newsletter')
        .send({ email: 'b@example.com', source: 'footer' });
      await agent()
        .post('/api/newsletter')
        .send({ email: 'c@example.com', source: 'not-a-real-source' });

      const sources = (await Subscriber.find().lean()).map((s) => s.source).sort();
      expect(sources).toEqual(['footer', 'home', 'home']);
    });

    it('treats a repeat signup as success without creating a duplicate', async () => {
      const first = await agent()
        .post('/api/newsletter')
        .send({ email: 'repeat@example.com' });
      expect(first.status).toBe(201);

      const second = await agent()
        .post('/api/newsletter')
        .send({ email: 'repeat@example.com' });

      expect(second.status).toBe(200);
      expect(second.body.alreadySubscribed).toBe(true);
      expect(second.body.message).toMatch(/already subscribed/i);
      expect(await Subscriber.countDocuments({ email: 'repeat@example.com' })).toBe(1);
    });

    it('treats a differently-cased repeat as the same subscriber', async () => {
      await agent().post('/api/newsletter').send({ email: 'same@example.com' });
      const second = await agent()
        .post('/api/newsletter')
        .send({ email: 'SAME@example.com' });

      expect(second.status).toBe(200);
      expect(second.body.alreadySubscribed).toBe(true);
      expect(await Subscriber.countDocuments()).toBe(1);
    });

    it.each([
      ['no email', {}],
      ['empty email', { email: '' }],
      ['whitespace-only email', { email: '   ' }],
      ['non-string email', { email: 42 }],
      ['email without an @', { email: 'not-an-email' }],
      ['email without a domain', { email: 'user@' }],
    ])('rejects an invalid address (%s) with a 400', async (_label, body) => {
      const res = await agent().post('/api/newsletter').send(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/email/i);
      expect(await Subscriber.countDocuments()).toBe(0);
    });

    it('does not leak a stack trace on success', async () => {
      const res = await agent()
        .post('/api/newsletter')
        .send({ email: 'clean@example.com' });
      expect(res.body).not.toHaveProperty('stack');
    });
  });

  describe('GET /api/newsletter', () => {
    beforeEach(async () => {
      await Subscriber.create([
        { email: 'first@example.com', source: 'home' },
        { email: 'second@example.com', source: 'footer' },
      ]);
    });

    it('returns subscribers for an admin, newest first', async () => {
      const admin = await getAdminDoc();
      const token = generateToken(admin._id, admin.role);
      const res = await agent()
        .get('/api/newsletter')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(2);
      expect(res.body.subscribers).toHaveLength(2);
      expect(res.body.subscribers[0].email).toBe('second@example.com');
    });

    it('breaks a createdAt tie deterministically', async () => {
      // Both rows are seeded in the same millisecond, so `createdAt` alone
      // cannot order them - the `_id` tiebreak has to. Repeated reads must also
      // agree with each other, or the admin list reshuffles on every poll.
      const admin = await getAdminDoc();
      const token = generateToken(admin._id, admin.role);
      const read = () =>
        agent()
          .get('/api/newsletter')
          .set('Authorization', `Bearer ${token}`);

      const first = await read();
      const second = await read();

      const emails = first.body.subscribers.map((s) => s.email);
      expect(emails).toEqual(['second@example.com', 'first@example.com']);
      expect(second.body.subscribers.map((s) => s.email)).toEqual(emails);
    });

    it('forbids non-admins', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .get('/api/newsletter')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('requires authentication', async () => {
      const res = await agent().get('/api/newsletter');
      expect(res.status).toBe(401);
    });
  });
});