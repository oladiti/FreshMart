import {
  agent,
  setupApiTest,
  teardownApiTest,
  seedUsers,
  generateToken,
} from "./apiSetup.js";
import Product from "../../models/Product.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import { defaultCache } from "../../services/recommendations/computeRecommendations.js";

const get = (query, token) => {
  const req = agent().get(`/api/recommendations${query}`);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req;
};

const CATALOGUE = [
  { name: "Rice 5kg", price: 12.99, category: "Pantry", image: "/r.jpg", countInStock: 10, tags: ["basics"] },
  { name: "Onions", price: 1.8, category: "Vegetables", image: "/o.jpg", countInStock: 30, tags: ["fresh"] },
  { name: "Cooking Oil 1Ltr", price: 3.49, category: "Pantry", image: "/c.jpg", countInStock: 12, tags: ["basics"] },
];

const orderFor = async (userId, itemNames, opts = {}) => {
  const products = await Product.find({ name: { $in: itemNames } });
  const items = products.map((product) => ({
    product: product._id,
    name: product.name,
    price: product.price,
    image: product.image,
    quantity: opts.quantity || 1,
  }));
  const order = new Order({
    user: userId,
    items,
    total_amount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    status: "delivered",
    customer_email: "shopper@test.com",
    shipping_address: {
      street: "1 Test St",
      city: "London",
      state: "England",
      postalCode: "SW1A 1AA",
      country: "UK",
    },
    payment_info: { method: "card" },
  });
  return order.save();
};

describe("GET /api/recommendations", () => {
  beforeAll(async () => {
    await setupApiTest();
  });
  afterAll(async () => {
    await teardownApiTest();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
    await Order.deleteMany({});
    await seedUsers();
    await Product.insertMany(CATALOGUE);
    // A guest order gives the store a popularity signal so guest responses are
    // genuinely non-empty (and the exclude filter below has something to drop).
    await orderFor(null, ["Rice 5kg", "Cooking Oil 1Ltr"]);
    // The service caches rankings for a few minutes; reset so each test ranks
    // the freshly-seeded catalogue rather than the previous test's products.
    defaultCache.clear();
  });

  it("is public and returns a well-formed popular list for guests", async () => {
    const res = await get("");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.personalized).toBe(false);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    for (const entry of res.body.recommendations) {
      expect(entry.product).toBeTruthy();
      expect(typeof entry.product._id).toBe("string");
      expect(typeof entry.reason).toBe("string");
    }
  });

  it("personalises for signed-in shoppers and never repeats their own items", async () => {
    const userA = await User.create({
      name: "Shopper A",
      email: `a-${Date.now()}-${Math.random()}@test.com`,
      password: "pass12345",
    });
    const userB = await User.create({
      name: "Shopper B",
      email: `b-${Date.now()}-${Math.random()}@test.com`,
      password: "pass12345",
    });

    await orderFor(userA._id, ["Rice 5kg"]);
    await orderFor(userB._id, ["Rice 5kg", "Onions"]);

    const token = generateToken(userA._id, "user");
    const res = await get("", token);

    expect(res.status).toBe(200);
    expect(res.body.personalized).toBe(true);
    const names = res.body.recommendations.map((r) => r.product.name);
    expect(names).not.toContain("Rice 5kg");
    expect(names).toContain("Onions");
    expect(res.body.recommendations[0].product._id).toMatch(/^[0-9a-f]{24}$/i);
  });

  it("honours the limit query parameter", async () => {
    const res = await get("?limit=1");
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeLessThanOrEqual(1);
  });

  it("honours the exclude query parameter", async () => {
    const oil = await Product.findOne({ name: "Cooking Oil 1Ltr" });
    const res = await get(`?exclude=${String(oil._id)}`);

    expect(res.status).toBe(200);
    const names = res.body.recommendations.map((r) => r.product.name);
    expect(names).not.toContain("Cooking Oil 1Ltr");
  });

  it("ignores junk query parameters safely", async () => {
    const res = await get("?bogus=1&limit=abc");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
  });
});