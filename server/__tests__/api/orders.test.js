import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  seedProducts,
  seedUsers,
  seedOrder,
  getAdminDoc,
  getUserDoc,
} from './apiSetup.js';
import Product from '../../models/Product.js';
import User from '../../models/User.js';

describe('Orders API', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  const shipping = {
    street: '1 Test St',
    city: 'London',
    state: 'England',
    postalCode: 'SW1A 1AA',
    country: 'UK',
  };

  describe('POST /api/orders', () => {
    it('creates an order for an authenticated user', async () => {
      await seedUsers();
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const products = await seedProducts();
      const product = products[0];
      const res = await agent()
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: product._id, quantity: 2 }],
          shippingAddress: shipping,
          paymentMethod: 'card',
        });
      expect(res.status).toBe(201);
      expect(res.body.total_amount).toBe(product.price * 2);
      expect(res.body.status).toBe('pending');
      expect(res.body.items[0]).toMatchObject({
        name: product.name,
        sku: product.sku,
        quantity: 2,
      });
    });

    it('returns 400 when the cart is empty', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [], shippingAddress: shipping });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cart is empty');
    });

    it('returns 400 when shipping address is missing', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const products = await seedProducts();
      const product = products[0];
      const res = await agent()
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ productId: product._id, quantity: 1 }] });
      expect(res.status).toBe(400);
    });

    it('returns 400 with MISSING_PRODUCTS when a product does not exist', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: '507f1f77bcf86cd799439011', quantity: 1 }],
          shippingAddress: shipping,
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_PRODUCTS');
      expect(res.body.missingItems).toHaveLength(1);
    });

    it('returns 400 for insufficient stock', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const products = await seedProducts();
      const product = products[0];
      const res = await agent()
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: product._id, quantity: 9999 }],
          shippingAddress: shipping,
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient stock');
    });

    it('returns 401 without a token', async () => {
      const res = await agent()
        .post('/api/orders')
        .send({ items: [], shippingAddress: shipping });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/orders/myorders', () => {
    it("returns the logged-in user's orders", async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      await seedOrder(user._id);
      const res = await agent()
        .get('/api/orders/myorders')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('allows the owner to view their order', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const order = await seedOrder(user._id);
      const res = await agent()
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(String(res.body._id)).toBe(String(order._id));
    });

    it('blocks a non-owner from viewing the order (403)', async () => {
      await seedUsers();
      const user1 = await getUserDoc();
      const order = await seedOrder(user1._id);
      // Create a third user who doesn't own the order
      const other = await User.create({
        name: 'Other User',
        email: 'other@test.com',
        password: 'password123',
      });
      const otherToken = generateToken(other._id, 'user');
      const res = await agent()
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 404 for a non-existent order', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .get('/api/orders/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/orders/:id (admin status update)', () => {
    it('allows an admin to update the order status', async () => {
      const user = await getUserDoc();
      const order = await seedOrder(user._id);
      const admin = await getAdminDoc();
      const token = generateToken(admin._id, admin.role);
      const res = await agent()
        .put(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'shipped' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('shipped');
    });

    it('returns 403 for a non-admin', async () => {
      const user = await getUserDoc();
      const order = await seedOrder(user._id);
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .put(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'shipped' });
      expect(res.status).toBe(403);
    });
  });
});
