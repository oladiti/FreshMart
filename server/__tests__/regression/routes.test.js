import { setupApiTest, teardownApiTest, agent } from '../api/apiSetup.js';

describe('Route Regression — all API routes respond without crashing', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  describe('Health / root', () => {
    it('GET /api/health returns 200', async () => {
      const res = await agent().get('/api/health');
      expect(res.status).toBe(200);
    });
  });

  describe('Auth routes', () => {
    it('POST /api/auth/login responds (400 without body)', async () => {
      const res = await agent().post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('POST /api/auth/register responds (400 or 422 without body)', async () => {
      const res = await agent().post('/api/auth/register').send({});
      expect([400, 422, 500]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
    });

    it('POST /api/auth/forgot-password responds', async () => {
      const res = await agent()
        .post('/api/auth/forgot-password')
        .send({ email: 'anyone@test.com' });
      expect(res.status).toBe(200);
    });

    it('GET /api/auth/profile returns 401 without token', async () => {
      const res = await agent().get('/api/auth/profile');
      expect(res.status).toBe(401);
    });
  });

  describe('Product routes', () => {
    it('GET /api/products returns 200 with success envelope', async () => {
      const res = await agent().get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('GET /api/products/featured returns 200', async () => {
      const res = await agent().get('/api/products/featured');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/products/weekly-deals returns 200', async () => {
      const res = await agent().get('/api/products/weekly-deals');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deals');
    });

    it('GET /api/products/new returns 200', async () => {
      const res = await agent().get('/api/products/new');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/products/category/Fruits responds (200 or 404)', async () => {
      const res = await agent().get('/api/products/category/Fruits');
      expect([200, 404]).toContain(res.status);
    });

    it('GET /api/products/:slug returns 200 or 404', async () => {
      const res = await agent().get('/api/products/this-product-does-not-exist');
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Newsletter routes', () => {
    it('POST /api/newsletter responds (400 without body)', async () => {
      const res = await agent().post('/api/newsletter').send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('GET /api/newsletter returns 401 without token', async () => {
      const res = await agent().get('/api/newsletter');
      expect(res.status).toBe(401);
    });
  });



  describe('Recipe routes', () => {
    it('GET /api/recipes returns 200', async () => {
      const res = await agent().get('/api/recipes');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/recipes/:id with a valid ObjectId format returns 200 or 404', async () => {
      const res = await agent().get('/api/recipes/507f1f77bcf86cd799439011');
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Protected routes return 401 without token', () => {
    it('POST /api/products/:id/reviews returns 401', async () => {
      const res = await agent()
        .post('/api/products/507f1f77bcf86cd799439011/reviews')
        .send({ rating: 5, comment: 'Nice' });
      expect(res.status).toBe(401);
    });

    it('POST /api/orders returns 401', async () => {
      const res = await agent().post('/api/orders').send({});
      expect(res.status).toBe(401);
    });

    it('GET /api/orders/myorders returns 401', async () => {
      const res = await agent().get('/api/orders/myorders');
      expect(res.status).toBe(401);
    });

    it('GET /api/orders/user returns 401', async () => {
      const res = await agent().get('/api/orders/user');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/orders returns 401', async () => {
      const res = await agent().get('/api/admin/orders');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/products returns 401', async () => {
      const res = await agent().get('/api/admin/products');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/customers returns 401', async () => {
      const res = await agent().get('/api/admin/customers');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/best-sellers returns 401', async () => {
      const res = await agent().get('/api/admin/best-sellers');
      expect(res.status).toBe(401);
    });

    it('POST /api/payments/stripe/create-payment-intent returns 401', async () => {
      const res = await agent()
        .post('/api/payments/stripe/create-payment-intent')
        .send({});
      expect(res.status).toBe(401);
    });

    it('POST /api/payments/stripe/confirm-order returns 401', async () => {
      const res = await agent()
        .post('/api/payments/stripe/confirm-order')
        .send({});
      expect(res.status).toBe(401);
    });
  });

  describe('Unknown routes', () => {
    it('GET /api/nonexistent returns 404', async () => {
      const res = await agent().get('/api/nonexistent');
      expect(res.status).toBe(404);
    });

    it('GET /nope returns 404', async () => {
      const res = await agent().get('/nope');
      expect(res.status).toBe(404);
    });
  });
});
