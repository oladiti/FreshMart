// server/e2e-seed.js
// Idempotent E2E seed: ensures the test data used by Playwright UI tests exists
// in the database pointed to by MONGO_URI (your Atlas DB). Safe to re-run.
//
//   - Seeds a small, stable set of products so /shop renders product cards.
//   - Seeds the E2E user (e2e@test.com) used by the login test.
//
// This script deliberately does NOT create an admin. The single canonical admin
// account is created by seeder.js ("npm run seed") and its credentials are
// overridable via ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME. Keeping one admin
// avoids a second admin account with a divergent password on the live database.
//
// Unlike seeder.js, this never deletes existing documents.

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product, { slugify, makeSku } from './models/Product.js';
import User from './models/User.js';
import connectDB from './config/db.js';

dotenv.config();

const E2E_USER = {
  name: 'E2E User',
  email: 'e2e@test.com',
  password: 'password123',
};

const E2E_PRODUCTS = [
  { name: 'Organic Apples', description: 'Fresh organic apples, crisp and juicy.', price: 3.99, category: 'Fruits', countInStock: 50, image: '/images/apples.png' },
  { name: 'Bananas', description: 'Sweet ripe bananas, perfect for smoothies.', price: 1.29, category: 'Fruits', countInStock: 80, image: '/images/banana.jpeg' },
  { name: 'Whole Milk 1L', description: 'Fresh full cream milk.', price: 1.29, category: 'Dairy', countInStock: 60, image: '/images/milk.jpeg' },
  { name: 'Cheddar Cheese 200g', description: 'Mature cheddar cheese block.', price: 3.99, category: 'Dairy', countInStock: 40, image: '/images/cheddar.jpeg' },
  { name: 'Tomatoes', description: 'Fresh juicy tomatoes.', price: 2.49, category: 'Vegetables', countInStock: 70, image: '/images/tomatoes.jpg' },
];

// Idempotently upsert each product (never deletes existing data).
// Don't use updateOne+upsert alone: it skips Mongoose document middleware,
// so we set the slug explicitly to guarantee product URLs never expose _id.
const seedProducts = async () => {
  let inserted = 0;
  const usedSlugs = new Set();

  const makeSlug = (name) => {
    const base = slugify(name) || 'product';
    let slug = base;
    let suffix = 1;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${suffix++}`;
    }
    usedSlugs.add(slug);
    return slug;
  };

  for (const p of E2E_PRODUCTS) {
    const result = await Product.updateOne(
      { name: p.name },
      { $setOnInsert: { ...p, slug: makeSlug(p.name), sku: makeSku(p.category, p.name) } },
      { upsert: true }
    );
    if (result.upsertedCount > 0) inserted++;
  }
  return inserted;
};

// Idempotently create the E2E user if it does not already exist
const seedUser = async () => {
  const existing = await User.findOne({ email: E2E_USER.email });
  if (existing) return false;
  await User.create(E2E_USER);
  return true;
};

const run = async () => {
  try {
    await connectDB();
    const productsCreated = await seedProducts();
    const userCreated = await seedUser();

    const productCount = await Product.countDocuments({
      name: { $in: E2E_PRODUCTS.map((p) => p.name) },
    });

    console.log(`✅ E2E seed complete: ${productsCreated} new products upserted, ${userCreated ? 'user created' : 'E2E user already exists'}.`);
    console.log(`✅ E2E product docs present: ${productCount}`);
    console.log(`ℹ️  Admin account is owned by seeder.js (npm run seed); run it if admin UI tests need access.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ E2E seed error:', error);
    process.exit(1);
  }
};

run();
