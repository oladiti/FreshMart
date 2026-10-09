import mongoose from 'mongoose';
import { startTestDB, stopTestDB } from '../../testDB.js';
import Order from '../../../models/Order.js';
import Product from '../../../models/Product.js';
import User from '../../../models/User.js';

const validShipping = {
  street: '1 Main St',
  city: 'London',
  state: 'England',
  postalCode: 'E1 6AN',
  country: 'UK',
};

// items in the schema require a `product` ObjectId reference
const productId = new mongoose.Types.ObjectId();

const item = (extra = {}) => ({
  product: String(productId),
  name: 'Milk',
  price: 2,
  quantity: 1,
  ...extra,
});

describe('Order Model', () => {
  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
  });

  describe('schema validation', () => {
    it('creates an order with valid fields', async () => {
      const order = new Order({
        items: [item()],
        total_amount: 2,
        customer_email: 'buyer@test.com',
        shipping_address: validShipping,
      });
      const saved = await order.save();
      expect(saved.status).toBe('pending');
      expect(saved.payment_info.method).toBe('card');
      expect(saved.customer_email).toBe('buyer@test.com');
    });

    it('defaults status to pending', async () => {
      const order = new Order({
        items: [item()],
        total_amount: 1,
        customer_email: 'b@test.com',
        shipping_address: validShipping,
      });
      const saved = await order.save();
      expect(saved.status).toBe('pending');
    });

    it('rejects invalid order status', async () => {
      const order = new Order({
        items: [item()],
        total_amount: 1,
        status: 'not-a-status',
        customer_email: 'b@test.com',
        shipping_address: validShipping,
      });
      await expect(order.save()).rejects.toThrow();
    });

    it('rejects invalid customer email', async () => {
      const order = new Order({
        items: [item()],
        total_amount: 1,
        customer_email: 'not-an-email',
        shipping_address: validShipping,
      });
      await expect(order.save()).rejects.toThrow();
    });

    it('requires shipping address fields', async () => {
      const order = new Order({
        items: [item()],
        total_amount: 1,
        customer_email: 'b@test.com',
        shipping_address: { street: '1 St' },
      });
      await expect(order.save()).rejects.toThrow();
    });

    it('rejects an item without a product reference', async () => {
      const order = new Order({
        items: [{ name: 'No Prod', price: 1, quantity: 1 }],
        total_amount: 1,
        customer_email: 'b@test.com',
        shipping_address: validShipping,
      });
      await expect(order.save()).rejects.toThrow();
    });
  });

  describe('calculateTotal method', () => {
    it('computes the sum of item prices times quantities', async () => {
      const order = new Order({
        items: [item({ price: 2, quantity: 3 }), item({ price: 1.5, quantity: 2 })],
        customer_email: 'b@test.com',
        shipping_address: validShipping,
      });
      const total = order.calculateTotal();
      expect(total).toBe(6 + 3);
      expect(order.total_amount).toBe(9);
    });

    it('returns 0 for empty items', async () => {
      const order = new Order({
        items: [],
        customer_email: 'b@test.com',
        shipping_address: validShipping,
      });
      expect(order.calculateTotal()).toBe(0);
    });
  });

  describe('createFromCart static method', () => {
    it('creates an order from a cart with product snapshots', async () => {
      const product = await Product.create({
        name: 'Apple',
        price: 2,
        image: '/images/apple.jpg',
      });
      const user = await User.create({
        name: 'Buyer',
        email: 'buyer2@test.com',
        password: 'password123',
      });
      const cart = {
        items: [{ product, quantity: 4 }],
      };
      const order = await Order.createFromCart(cart, user._id, 'buyer2@test.com', validShipping);
      expect(order.items.length).toBe(1);
      expect(order.items[0].name).toBe('Apple');
      expect(order.items[0].quantity).toBe(4);
      expect(order.total_amount).toBe(8);
      // autopopulate turns the user ref into an object
      const userRef = order.user && order.user._id ? order.user._id : order.user;
      expect(String(userRef)).toBe(String(user._id));
    });

    it('throws when cart is empty', async () => {
      await expect(
        Order.createFromCart({ items: [] }, null, 'b@test.com', validShipping)
      ).rejects.toThrow('Cart is empty');
    });

    it('throws when cart is null', async () => {
      await expect(
        Order.createFromCart(null, null, 'b@test.com', validShipping)
      ).rejects.toThrow('Cart is empty');
    });
  });
});
