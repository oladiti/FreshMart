import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  seedUsers,
  seedProducts,
  seedOrder,
  getAdminDoc,
  getUserDoc,
  sampleProducts,
} from './apiSetup.js';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';

describe('Admin API', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  const adminAuth = async () => {
    await seedUsers();
    const admin = await getAdminDoc();
    return generateToken(admin._id, admin.role);
  };

  const userAuth = async () => {
    await seedUsers();
    const user = await getUserDoc();
    return generateToken(user._id, user.role);
  };

  describe('GET /api/admin/orders', () => {
    it('returns all orders for an admin', async () => {
      const token = await adminAuth();
      const user = await getUserDoc();
      await seedOrder(user._id);
      const res = await agent()
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/admin/products', () => {
    beforeEach(async () => {
      await Product.deleteMany({});
    });

    it('returns paginated products for an admin', async () => {
      const token = await adminAuth();
      await seedProducts();
      const res = await agent()
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.total).toBe(sampleProducts.length);
      expect(res.body.totalPages).toBe(1);
    });

    it('respects limit and page params', async () => {
      const token = await adminAuth();
      await seedProducts();
      const res = await agent()
        .get('/api/admin/products?limit=2&page=1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(2);
      expect(res.body.total).toBe(sampleProducts.length);
      expect(res.body.totalPages).toBe(Math.ceil(sampleProducts.length / 2));
    });

    it('searches products by name, category or sku', async () => {
      const token = await adminAuth();
      await seedProducts();
      const res = await agent()
        .get(`/api/admin/products?search=${encodeURIComponent('Fruits')}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].category).toContain('Fruits');
      expect(res.body.total).toBe(1);
    });
  });

  describe('GET /api/admin/customers', () => {
    it('returns only users with role user', async () => {
      const token = await adminAuth();
      const res = await agent()
        .get('/api/admin/customers')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((c) => expect(c.role).toBe('user'));
      expect(res.body.some((c) => c.role === 'admin')).toBe(false);
    });
  });

  describe('GET /api/admin/best-sellers', () => {
    it('returns ranked best sellers for an admin', async () => {
      const token = await adminAuth();
      const user = await getUserDoc();
      await seedOrder(user._id);
      const res = await agent()
        .get('/api/admin/best-sellers')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('unitsSold');
        expect(res.body[0]).toHaveProperty('revenue');
      }
    });
  });

  describe('GET /api/admin/analytics', () => {
    it('returns summary, series and breakdowns for an admin', async () => {
      const token = await adminAuth();
      const user = await getUserDoc();
      await seedOrder(user._id);
      const res = await agent()
        .get('/api/admin/analytics?days=14')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.summary).toHaveProperty('totalRevenue');
      expect(res.body.summary).toHaveProperty('totalOrders');
      expect(res.body.summary).toHaveProperty('averageOrderValue');
      expect(res.body.summary).toHaveProperty('activeCustomers');
      expect(Array.isArray(res.body.series)).toBe(true);
      expect(res.body.series.length).toBe(14);
      expect(Array.isArray(res.body.topCategories)).toBe(true);
      expect(Array.isArray(res.body.topCustomers)).toBe(true);
      expect(Array.isArray(res.body.statusCounts)).toBe(true);
    });

    it('uses the item category snapshot when the product is deleted', async () => {
      const token = await adminAuth();
      const user = await getUserDoc();
      const product = await Product.create({
        name: 'Ghost Snack',
        price: 5,
        image: '/images/ghost.jpg',
        category: 'Snacks',
        countInStock: 10,
      });
      await Order.create({
        user: user._id,
        items: [
          {
            product: product._id,
            name: product.name,
            price: product.price,
            image: product.image,
            category: product.category,
            quantity: 3,
          },
        ],
        total_amount: 15,
        status: 'paid',
        customer_email: 'ghost@test.com',
        shipping_address: {
          street: '1 Test St',
          city: 'London',
          state: 'England',
          postalCode: 'SW1A 1AA',
          country: 'UK',
        },
      });
      await Product.deleteOne({ _id: product._id });

      const res = await agent()
        .get('/api/admin/analytics?days=30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const snacks = res.body.topCategories.find(
        (c) => c.category === 'Snacks'
      );
      expect(snacks).toBeDefined();
      expect(snacks.units).toBe(3);
      expect(snacks.revenue).toBe(15);
      expect(res.body.topCategories.some((c) => c.category === 'Unknown')).toBe(
        false
      );
    });

    it('clamps the days query parameter to a supported range', async () => {
      const token = await adminAuth();
      const res = await agent()
        .get('/api/admin/analytics?days=99999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.series.length).toBeLessThanOrEqual(90);
    });
  });

  describe('GET /api/admin/settings', () => {
    it('returns defaults when no settings exist yet', async () => {
      const token = await adminAuth();
      const res = await agent()
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.storeName).toBe('FreshMart');
      expect(res.body).toHaveProperty('currencySymbol');
      expect(res.body).toHaveProperty('lowStockThreshold');
    });
  });

  describe('PUT /api/admin/settings', () => {
    it('persists provided settings and keeps defaults for the rest', async () => {
      const token = await adminAuth();
      const res = await agent()
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ storeName: 'FreshCo', lowStockThreshold: 5, announcement: 'Fresh stock daily' });
      expect(res.status).toBe(200);
      expect(res.body.storeName).toBe('FreshCo');
      expect(res.body.lowStockThreshold).toBe(5);
      expect(res.body.announcement).toBe('Fresh stock daily');
      expect(res.body.currencySymbol).toBe('£');

      const fetched = await agent()
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`);
      expect(fetched.body.storeName).toBe('FreshCo');
    });

    it('rejects non-numeric values for numeric settings', async () => {
      const token = await adminAuth();
      const res = await agent()
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ lowStockThreshold: 'lots' });
      expect(res.status).toBe(400);
    });
  });

  describe('product write field allow-list (mass assignment)', () => {
    it('ignores server-managed fields on create', async () => {
      const token = await adminAuth();
      const res = await agent()
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Allowlist Create',
          price: 4.5,
          image: '/images/x.jpg',
          slug: 'forced-slug',
          reviews: [{ rating: 5, comment: 'self-posted' }],
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Allowlist Create');
      expect(res.body.slug).not.toBe('forced-slug');
      expect((res.body.reviews || []).length).toBe(0);
    });

    it('ignores server-managed fields on update', async () => {
      const token = await adminAuth();
      const created = await Product.create({
        name: 'Allowlist Update',
        price: 5,
        image: '/images/y.jpg',
        category: 'Snacks',
      });
      const originalSlug = created.slug;

      const res = await agent()
        .put(`/api/admin/products/${created._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          price: 6.5,
          slug: 'hacked-slug',
          reviews: [{ rating: 1, comment: 'self-posted' }],
        });

      expect(res.status).toBe(200);
      expect(Number(res.body.price)).toBe(6.5);
      expect(res.body.slug).toBe(originalSlug);
      expect((res.body.reviews || []).length).toBe(0);
    });
  });

  describe('authorization guards', () => {
    it('rejects a regular user with 403', async () => {
      const token = await userAuth();
      const res = await agent()
        .get('/api/admin/best-sellers')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('rejects a request with no token with 401 for best-sellers', async () => {
      const res = await agent().get('/api/admin/best-sellers');
      expect(res.status).toBe(401);
    });

    it('rejects a regular user with 403', async () => {
      const token = await userAuth();
      const res = await agent()
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('rejects a request with no token with 401', async () => {
      const res = await agent().get('/api/admin/orders');
      expect(res.status).toBe(401);
    });
  });
});
