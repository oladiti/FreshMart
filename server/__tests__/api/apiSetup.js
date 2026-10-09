import request from 'supertest';
import jwt from 'jsonwebtoken';
import { startTestDB, stopTestDB, clearTestDB } from '../testDB.js';
import app from '../../app.js';
import User from '../../models/User.js';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';
import Recipe from '../../models/Recipe.js';
import { adminUser, regularUser, sampleProducts } from '../fixtures/testData.js';

export const getApp = () => app;

export function generateToken(id, role = 'user') {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export const agent = () => request(app);

export async function setupApiTest() {
  await startTestDB();
  return () => clearTestDB();
}

export async function teardownApiTest() {
  await stopTestDB();
}

export async function seedUsers() {
  const existing = await User.findOne({ email: adminUser.email });
  if (existing) return;
  await User.create(adminUser);
  await User.create(regularUser);
}

export async function getAdminDoc() {
  return User.findOne({ email: adminUser.email });
}

export async function getUserDoc() {
  return User.findOne({ email: regularUser.email });
}

export async function seedProducts() {
  return Product.create(sampleProducts);
}

export async function seedOrder(userId) {
  const products = await seedProducts();
  const product = products[0];
  const order = new Order({
    user: userId,
    items: [
      {
        product: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 2,
      },
    ],
    total_amount: product.price * 2,
    status: 'pending',
    customer_email: regularUser.email,
    shipping_address: {
      street: '1 Test St',
      city: 'London',
      state: 'England',
      postalCode: 'SW1A 1AA',
      country: 'UK',
    },
    payment_info: { method: 'card' },
  });
  return order.save();
}

export async function seedRecipe(userId) {
  return Recipe.create({
    title: 'Test Jollof',
    description: 'A tasty rice dish',
    ingredients: ['Rice', 'Tomato'],
    steps: ['Boil', 'Serve'],
    category: 'Main',
    diet: 'none',
    createdBy: userId,
  });
}

export {
  adminUser,
  regularUser,
  sampleProducts,
};
