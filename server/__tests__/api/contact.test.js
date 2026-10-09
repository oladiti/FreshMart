import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  seedUsers,
  getAdminDoc,
  getUserDoc,
} from './apiSetup.js';
import ContactMessage from '../../models/ContactMessage.js';

describe('Contact API', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  beforeEach(async () => {
    await ContactMessage.deleteMany({});
    await seedUsers();
  });

  describe('POST /api/contact', () => {
    it('stores a contact message', async () => {
      const res = await agent().post('/api/contact').send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Order enquiry',
        message: 'When will my order arrive?',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const saved = await ContactMessage.findOne({ email: 'jane@example.com' });
      expect(saved).not.toBeNull();
      expect(saved.name).toBe('Jane Doe');
      expect(saved.subject).toBe('Order enquiry');
      expect(saved.message).toBe('When will my order arrive?');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await agent().post('/api/contact').send({
        name: 'No Message',
        email: 'nope@example.com',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/contact', () => {
    it('returns messages for an admin', async () => {
      await ContactMessage.create({
        name: 'Jane Doe',
        email: 'jane@example.com',
        message: 'Hello',
      });

      const admin = await getAdminDoc();
      const token = generateToken(admin._id, admin.role);
      const res = await agent()
        .get('/api/contact')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
    });

    it('forbids non-admins', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .get('/api/contact')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('requires authentication', async () => {
      const res = await agent().get('/api/contact');
      expect(res.status).toBe(401);
    });
  });
});