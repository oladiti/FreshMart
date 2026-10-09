import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  seedProducts,
  seedUsers,
  getAdminDoc,
  getUserDoc,
  sampleProducts,
} from './apiSetup.js';
import Product from '../../models/Product.js';
import User from '../../models/User.js';
import { backfillMissingSlugs, backfillMissingSkus } from '../../backfill-slugs.js';
import { makeSku } from '../../models/Product.js';

describe('Products API', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
    await User.deleteMany({});
    await seedUsers();
  });

  describe('GET /api/products', () => {
    it('returns a paginated list of products', async () => {
      await seedProducts();
      const res = await agent().get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.total).toBe(sampleProducts.length);
    });

    it('returns an empty list when no products exist', async () => {
      const res = await agent().get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body.products).toEqual([]);
    });
  });

  describe('GET /api/products/:slug', () => {
    it('returns a product by slug', async () => {
      const products = await seedProducts();
      const product = products[0];
      const res = await agent().get(`/api/products/${product.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(product.name);
    });

    it('returns 404 for a non-existent product slug', async () => {
      const res = await agent().get('/api/products/this-product-does-not-exist');
      expect(res.status).toBe(404);
    });

    it('redirects an id-based URL to the canonical slug', async () => {
      const products = await seedProducts();
      const product = products[0];
      const res = await agent().get(`/api/products/${product._id}`).redirects(0);
      expect(res.status).toBe(301);
      expect(res.headers.location).toBe(`/api/products/${product.slug}`);
    });

    it('backfills a slug for products inserted without one', async () => {
      await Product.updateOne(
        { name: 'Slugless Item' },
        {
          $setOnInsert: {
            name: 'Slugless Item',
            price: 1.0,
            image: '/images/x.jpg',
            category: 'Snacks',
            countInStock: 5,
          },
        },
        { upsert: true }
      );
      const bare = await Product.findOne({ name: 'Slugless Item' });
      expect(bare.slug).toBeUndefined();

      const updated = await backfillMissingSlugs();
      expect(updated).toBeGreaterThanOrEqual(1);

      const withSlug = await Product.findOne({ name: 'Slugless Item' });
      expect(withSlug.slug).toBe('slugless-item');

      const res = await agent().get(`/api/products/${withSlug.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Slugless Item');
    });
  });

  describe('GET /api/products/featured', () => {
    it('returns only featured products', async () => {
      await Product.deleteMany({});
      await seedProducts();
      const res = await agent().get('/api/products/featured');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((p) => expect(p.isFeatured).toBe(true));
    });
  });

  describe('POST /api/products', () => {
    it('creates a product as an admin', async () => {
      await seedUsers();
      const admin = await getAdminDoc();
      const token = generateToken(admin._id, admin.role);
      const res = await agent()
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Item', price: 9.99, image: '/images/new.jpg', category: 'Snacks' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Item');
      expect(res.body.price).toBe(9.99);
    });

    it('returns 403 when a non-admin tries to create', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Denied', price: 1, image: '/images/x.jpg' });
      expect(res.status).toBe(403);
    });

    it('returns 401 without a token', async () => {
      const res = await agent()
        .post('/api/products')
        .send({ name: 'NoAuth', price: 1, image: '/images/x.jpg' });
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/products/:id', () => {
    it('updates a product as an admin', async () => {
      const products = await seedProducts();
      const product = products[0];
      const admin = await getAdminDoc();
      const token = generateToken(admin._id, admin.role);
      const res = await agent()
        .put(`/api/products/${product._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 12.5 });
      expect(res.status).toBe(200);
      expect(Number(res.body.price)).toBe(12.5);
    });

    it('returns 404 when updating a non-existent product', async () => {
      const admin = await getAdminDoc();
      const token = generateToken(admin._id, admin.role);
      const res = await agent()
        .put('/api/products/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 5 });
      expect(res.status).toBe(404);
    });
  });

  describe('SKU / Product Codes', () => {
    it('auto-generates a unique SKU when one is not provided', async () => {
      const res = await agent()
        .post('/api/products')
        .set('Authorization', `Bearer ${generateToken((await getAdminDoc())._id, 'admin')}`)
        .send({ name: 'No Code Item', price: 1.5, image: '/images/x.jpg', category: 'Snacks' });
      expect(res.status).toBe(201);
      expect(res.body.sku).toMatch(/^FM-SNA-[A-Z2-9]{4}$/);
    });

    it('persists an admin-supplied SKU and normalizes it to uppercase', async () => {
      const res = await agent()
        .post('/api/products')
        .set('Authorization', `Bearer ${generateToken((await getAdminDoc())._id, 'admin')}`)
        .send({ name: 'Coded Item', price: 2.0, image: '/images/x.jpg', sku: 'fm-abc-1234' });
      expect(res.status).toBe(201);
      expect(res.body.sku).toBe('FM-ABC-1234');
    });

    it('rejects a duplicate SKU with a 409', async () => {
      const res1 = await agent()
        .post('/api/products')
        .set('Authorization', `Bearer ${generateToken((await getAdminDoc())._id, 'admin')}`)
        .send({ name: 'Coded Item A', price: 2.0, image: '/images/x.jpg', sku: 'FM-DUP-0001' });
      expect(res1.status).toBe(201);

      const res2 = await agent()
        .post('/api/products')
        .set('Authorization', `Bearer ${generateToken((await getAdminDoc())._id, 'admin')}`)
        .send({ name: 'Coded Item B', price: 2.0, image: '/images/x.jpg', sku: 'FM-DUP-0001' });
      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('already in use');
    });

    it('finds products by SKU via search', async () => {
      await Product.create({
        name: 'Searchable Coded Item',
        price: 1.25,
        image: '/images/x.jpg',
        sku: 'FM-SRCH-9999',
      });
      const res = await agent().get('/api/products?search=FM-SRCH-9999');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.products.some((p) => p.sku === 'FM-SRCH-9999')).toBe(true);
    });

    it('backfills SKUs for products inserted without one', async () => {
      await Product.updateOne(
        { name: 'Sku-less Item' },
        {
          $setOnInsert: {
            name: 'Sku-less Item',
            price: 1.0,
            image: '/images/x.jpg',
            category: 'Snacks',
            countInStock: 5,
          },
        },
        { upsert: true }
      );
      const bare = await Product.findOne({ name: 'Sku-less Item' });
      expect(bare.sku).toBeUndefined();

      const updated = await backfillMissingSkus();
      expect(updated).toBeGreaterThanOrEqual(1);

      const withSku = await Product.findOne({ name: 'Sku-less Item' });
      expect(withSku.sku).toMatch(/^FM-SNA-[A-Z2-9]{4}$/);
    });

    it('round-trips SKU through admin create and update', async () => {
      const token = `Bearer ${generateToken((await getAdminDoc())._id, 'admin')}`;
      const created = await agent()
        .post('/api/admin/products')
        .set('Authorization', token)
        .send({ name: 'Admin Coded Item', price: 3.0, image: '/images/x.jpg', sku: 'FM-ADM-0011' });
      expect(created.status).toBe(201);
      expect(created.body.sku).toBe('FM-ADM-0011');
      expect(makeSku).toBeDefined();

      const updated = await agent()
        .put(`/api/admin/products/${created.body._id}`)
        .set('Authorization', token)
        .send({ sku: 'FM-ADM-0022' });
      expect(updated.status).toBe(200);
      expect(updated.body.sku).toBe('FM-ADM-0022');
    });
  });

  describe('POST /api/products/:id/reviews', () => {
    const postReview = (id, body, token) => {
      const req = agent().post(`/api/products/${id}/reviews`).send(body);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    };

    it('returns 401 without a token', async () => {
      const products = await seedProducts();
      const res = await postReview(products[0]._id, { rating: 5, comment: 'Great' });
      expect(res.status).toBe(401);
    });

    it('returns 404 for a non-existent product', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await postReview(
        '507f1f77bcf86cd799439011',
        { rating: 5, comment: 'Great' },
        token
      );
      expect(res.status).toBe(404);
    });

    it.each([
      ['missing rating', { comment: 'Great' }],
      ['rating of 0', { rating: 0, comment: 'Great' }],
      ['rating of 6', { rating: 6, comment: 'Great' }],
      ['non-integer rating', { rating: 3.5, comment: 'Great' }],
      ['non-numeric rating', { rating: 'five', comment: 'Great' }],
    ])('rejects an invalid rating (%s) with a 400', async (_label, body) => {
      const products = await seedProducts();
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await postReview(products[0]._id, body, token);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/rating/i);
    });

    it('rejects a blank comment with a 400', async () => {
      const products = await seedProducts();
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await postReview(products[0]._id, { rating: 4, comment: '   ' }, token);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/review/i);
    });

    it('creates a review that is then returned by the product endpoint', async () => {
      const products = await seedProducts();
      const product = products[0];
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);

      const created = await postReview(
        product._id,
        { rating: 5, comment: 'Brilliant apples' },
        token
      );
      expect(created.status).toBe(201);
      expect(created.body.review.rating).toBe(5);
      expect(created.body.review.comment).toBe('Brilliant apples');
      expect(created.body.review.user.name).toBe(user.name);
      expect(created.body.review.createdAt).toBeTruthy();

      const fetched = await agent().get(`/api/products/${product.slug}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body.reviews).toHaveLength(1);
      expect(fetched.body.reviews[0].comment).toBe('Brilliant apples');
      expect(fetched.body.reviews[0]._id).toBeTruthy();
      expect(fetched.body.reviews[0].user.name).toBe(user.name);
    });

    it('edits the existing review instead of adding a duplicate', async () => {
      const products = await seedProducts();
      const product = products[0];
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);

      const first = await postReview(product._id, { rating: 2, comment: 'Understated' }, token);
      expect(first.status).toBe(201);

      const second = await postReview(
        product._id,
        { rating: 5, comment: 'Changed my mind' },
        token
      );
      expect(second.status).toBe(200);
      expect(second.body.message).toMatch(/updated/i);
      expect(second.body.reviews).toHaveLength(1);
      expect(second.body.reviews[0].rating).toBe(5);
      expect(second.body.reviews[0].comment).toBe('Changed my mind');

      const stored = await Product.findById(product._id);
      expect(stored.reviews).toHaveLength(1);
      expect(stored.reviews[0].rating).toBe(5);
    });

    it('lets a different user add their own review', async () => {
      const products = await seedProducts();
      const product = products[0];
      const user = await getUserDoc();
      const admin = await getAdminDoc();

      await postReview(
        product._id,
        { rating: 4, comment: 'Pretty good' },
        generateToken(user._id, user.role)
      );
      const second = await postReview(
        product._id,
        { rating: 2, comment: 'Not for me' },
        generateToken(admin._id, admin.role)
      );

      expect(second.status).toBe(201);
      expect(second.body.reviews).toHaveLength(2);
      const names = second.body.reviews.map((r) => r.user.name);
      expect(names).toContain(user.name);
      expect(names).toContain(admin.name);
    });

    it('trims whitespace from the stored comment', async () => {
      const products = await seedProducts();
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);

      const res = await postReview(
        products[0]._id,
        { rating: 5, comment: '  Tidy shopper  ' },
        token
      );
      expect(res.status).toBe(201);
      expect(res.body.review.comment).toBe('Tidy shopper');
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('deletes a product as an admin', async () => {
      const products = await seedProducts();
      const product = products[0];
      const admin = await getAdminDoc();
      const token = generateToken(admin._id, admin.role);
      const res = await agent()
        .delete(`/api/products/${product._id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
      const gone = await Product.findById(product._id);
      expect(gone).toBeNull();
    });

    it('returns 404 when deleting a non-existent product', async () => {
      const admin = await getAdminDoc();
      const token = generateToken(admin._id, admin.role);
      const res = await agent()
        .delete('/api/products/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
