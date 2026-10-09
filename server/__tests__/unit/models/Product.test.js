import { startTestDB, stopTestDB } from '../../testDB.js';
import Product from '../../../models/Product.js';

describe('Product Model', () => {
  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  afterEach(async () => {
    await Product.deleteMany({});
  });

  describe('schema validation', () => {
    it('creates a product with valid fields', async () => {
      const product = await Product.create({
        name: 'Test Product',
        price: 5.99,
        image: '/images/test.jpg',
        category: 'Fruits',
      });
      expect(product.name).toBe('Test Product');
      expect(product.price).toBe(5.99);
      expect(product.isFeatured).toBe(false);
      expect(product.isWeeklyDeal).toBe(false);
      expect(product.isNewArrival).toBe(false);
      expect(product.countInStock).toBe(10);
    });

    it('requires a name', async () => {
      await expect(
        Product.create({ price: 2.0, image: '/images/a.jpg' })
      ).rejects.toThrow();
    });

    it('requires a price', async () => {
      await expect(
        Product.create({ name: 'NoPrice', image: '/images/a.jpg' })
      ).rejects.toThrow();
    });

    it('requires an image', async () => {
      await expect(
        Product.create({ name: 'NoImage', price: 2.0 })
      ).rejects.toThrow();
    });

    it('supports optional flags and fields', async () => {
      const product = await Product.create({
        name: 'Flagged',
        price: 10,
        image: '/images/f.jpg',
        isFeatured: true,
        isWeeklyDeal: true,
        isNewArrival: false,
        countInStock: 25,
      });
      expect(product.isFeatured).toBe(true);
      expect(product.isWeeklyDeal).toBe(true);
      expect(product.countInStock).toBe(25);
    });
  });

  describe('reviews subdocument', () => {
    it('adds a review to a product', async () => {
      const product = await Product.create({
        name: 'Reviewed',
        price: 3.0,
        image: '/images/r.jpg',
      });
      product.reviews.push({ user: null, rating: 4, comment: 'Good' });
      await product.save();
      expect(product.reviews.length).toBe(1);
      expect(product.reviews[0].rating).toBe(4);
    });

    it('rejects invalid rating outside 1-5 range', async () => {
      const product = await Product.create({
        name: 'BadRating',
        price: 3.0,
        image: '/images/r.jpg',
      });
      product.reviews.push({ user: null, rating: 6, comment: 'Invalid' });
      await expect(product.save()).rejects.toThrow();
    });
  });

  describe('related products', () => {
    it('stores related product references', async () => {
      const related = await Product.create({
        name: 'Related A',
        price: 1,
        image: '/images/a.jpg',
      });
      const product = await Product.create({
        name: 'Main',
        price: 2,
        image: '/images/m.jpg',
        related: [related._id],
      });
      expect(product.related.length).toBe(1);
      expect(String(product.related[0])).toBe(String(related._id));
    });
  });
});
