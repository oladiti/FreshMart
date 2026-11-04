import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  seedProducts,
  seedUsers,
  getUserDoc,
} from './apiSetup.js';

describe('Stripe payments API', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  describe('POST /api/payments/stripe/create-payment-intent', () => {
    it('requires authentication', async () => {
      const res = await agent()
        .post('/api/payments/stripe/create-payment-intent')
        .send({});
      expect(res.status).toBe(401);
    });

    it('rejects an empty cart', async () => {
      await seedUsers();
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .post('/api/payments/stripe/create-payment-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({ cart: [], customer: { email: 'buyer@test.com' } });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cart is empty');
    });

    it('rejects a negative quantity', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const products = await seedProducts();
      const res = await agent()
        .post('/api/payments/stripe/create-payment-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cart: [{ id: products[0]._id, quantity: -1 }],
          customer: { email: 'buyer@test.com' },
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid quantity');
    });

    it('rejects a fractional quantity', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const products = await seedProducts();
      const res = await agent()
        .post('/api/payments/stripe/create-payment-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cart: [{ id: products[0]._id, quantity: 2.5 }],
          customer: { email: 'buyer@test.com' },
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid quantity');
    });

    it('rejects a split cart that oversells through duplicate lines', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const products = await seedProducts();
      const bread = products.find((p) => p.name === 'Brown Bread'); // stock 20
      const res = await agent()
        .post('/api/payments/stripe/create-payment-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cart: [
            { id: bread._id, quantity: 15 },
            { id: bread._id, quantity: 15 },
          ],
          customer: { email: 'buyer@test.com' },
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient stock');
    });

    it('creates a demo intent and aggregates duplicate lines within stock', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const products = await seedProducts();
      const bread = products.find((p) => p.name === 'Brown Bread'); // stock 20
      const res = await agent()
        .post('/api/payments/stripe/create-payment-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cart: [
            { id: bread._id, quantity: 3 },
            { id: bread._id, quantity: 2 },
          ],
          customer: { email: 'buyer@test.com' },
          shippingAddress: {
            street: '1 Test St',
            city: 'London',
            state: 'England',
            postalCode: 'SW1A 1AA',
            country: 'UK',
          },
        });
      expect(res.status).toBe(200);
      expect(res.body.demoMode).toBe(true);
      expect(res.body.amount).toBeCloseTo(bread.price * 5, 5);
    });
  });
});
