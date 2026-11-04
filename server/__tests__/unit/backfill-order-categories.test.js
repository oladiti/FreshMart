import mongoose from 'mongoose';
import { startTestDB, stopTestDB } from '../testDB.js';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import { backfillMissingOrderCategories } from '../../backfill-order-categories.js';

const shipping = {
  street: '1 Main St',
  city: 'London',
  state: 'England',
  postalCode: 'E1 6AN',
  country: 'UK',
};

const order = (items) =>
  Order.create({
    items,
    total_amount: 1,
    customer_email: 'backfill@test.com',
    shipping_address: shipping,
  });

describe('backfillMissingOrderCategories', () => {
  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Product.deleteMany({});
  });

  it('fills missing categories by SKU first, then product name', async () => {
    const skuMatch = await Product.create({
      name: 'Now Renamed',
      price: 2,
      image: '/images/a.jpg',
      category: 'Pantry',
      sku: 'FM-PAN-1',
    });
    const nameMatch = await Product.create({
      name: 'Name Match',
      price: 3,
      image: '/images/b.jpg',
      category: 'Fruits',
    });

    const created = await order([
      {
        product: skuMatch._id,
        name: 'Old SKU Name',
        sku: 'FM-PAN-1',
        price: 2,
        quantity: 1,
      },
      {
        product: nameMatch._id,
        name: 'Name Match',
        price: 3,
        quantity: 2,
      },
    ]);

    const updated = await backfillMissingOrderCategories();

    expect(updated).toBe(1);
    const saved = await Order.findById(created._id);
    expect(saved.items[0].category).toBe('Pantry');
    expect(saved.items[1].category).toBe('Fruits');
  });

  it('leaves unmatched items uncategorised rather than guessing', async () => {
    const created = await order([
      {
        product: new mongoose.Types.ObjectId(),
        name: 'Deleted Product',
        price: 1,
        quantity: 1,
      },
    ]);

    const updated = await backfillMissingOrderCategories();

    expect(updated).toBe(0);
    const saved = await Order.findById(created._id);
    expect(saved.items[0].category).toBeUndefined();
  });

  it('does nothing when every item already has a category', async () => {
    await order([
      {
        product: new mongoose.Types.ObjectId(),
        name: 'Already Snapshot',
        category: 'Dairy',
        price: 1,
        quantity: 1,
      },
    ]);

    const updated = await backfillMissingOrderCategories();

    expect(updated).toBe(0);
  });
});
