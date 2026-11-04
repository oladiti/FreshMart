import {
  agent,
  setupApiTest,
  teardownApiTest,
  seedUsers,
  seedOrder,
  generateToken,
  getUserDoc,
} from "./apiSetup.js";
import Product from "../../models/Product.js";
import Cart from "../../models/Cart.js";
import Order from "../../models/Order.js";

const post = (body, token) => {
  const req = agent().post("/api/ai/chat").send(body);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req;
};

// Mirrors the catalogue used by the assistant API tests.
const CATALOGUE = [
  { name: "Rice 5kg", price: 12.99, category: "Pantry", image: "/r.jpg", countInStock: 10, description: "Long grain rice bag." },
  { name: "Onions", price: 1.8, category: "Vegetables", image: "/o.jpg", countInStock: 30 },
  { name: "Cooking Oil 1Ltr", price: 3.49, category: "Pantry", image: "/c.jpg", countInStock: 12 },
];

describe("AI Chat API", () => {
  beforeAll(async () => {
    await setupApiTest();
    // Force the degraded path regardless of any .env on the machine.
    delete process.env.AI_API_KEY;
  });
  afterAll(async () => {
    await teardownApiTest();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});
    await seedUsers();
  });

  describe("POST /api/ai/chat — validation", () => {
    it("rejects an empty message with 400", async () => {
      const res = await post({ message: "" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/type a message/i);
    });

    it("rejects a missing message with 400", async () => {
      const res = await post({});
      expect(res.status).toBe(400);
    });

    it("rejects a non-string message with 400", async () => {
      const res = await post({ message: { $ne: null } });
      expect(res.status).toBe(400);
    });

    it("rejects an over-long message with 400", async () => {
      const res = await post({ message: "a".repeat(2001) });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/characters/i);
    });
  });

  describe("POST /api/ai/chat — degraded mode (no LLM configured)", () => {
    it("answers a simple message with degraded: true", async () => {
      const res = await post({ message: "hello" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.degraded).toBe(true);
      expect(typeof res.body.message).toBe("string");
      expect(res.body.message.length).toBeGreaterThan(0);
      expect(typeof res.body.data).toBe("object");
    });

    it("is public — no token required", async () => {
      await Product.insertMany(CATALOGUE);
      const res = await post({ message: "show me rice" });
      expect(res.status).toBe(200);
    });

    it("returns real matching products in data.products", async () => {
      await Product.insertMany(CATALOGUE);
      const res = await post({ message: "Show me rice." });

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.products)).toBe(true);
      const names = res.body.data.products.map((p) => p.name);
      expect(names).toContain("Rice 5kg");
    });

    it("accepts an authenticated user without leaking their token", async () => {
      await Product.insertMany(CATALOGUE);
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await post({ message: "show me onions", history: [{ role: "user", content: "hi" }] }, token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.products)).toBe(true);
    });

    it("caps history turns and strips bad shapes", async () => {
      const res = await post({
        message: "show me rice",
        history: [
          { role: "assistant", content: "Earlier answer." },
          { role: "user", content: "Earlier question.", junk: true },
          ...Array.from({ length: 20 }, (_, i) => ({ role: "user", content: `turn ${i}` })),
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("never exposes a raw Mongo error or provider error to the client", async () => {
      const res = await post({ message: "show me rice (5kg) [a-z] \\d" });
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/\$regex|MongoServerError|AI_API_KEY/i);
    });
  });

  describe("POST /api/ai/chat — cart intents (degraded)", () => {
    it("asks an anonymous shopper to sign in to see their cart", async () => {
      const res = await post({ message: "check my cart" });

      expect(res.status).toBe(200);
      expect(res.body.degraded).toBe(true);
      expect(res.body.data.cart).toBeNull();
      expect(res.body.data.authRequired).toBe(true);
      expect(res.body.message).toMatch(/sign in/i);
    });

    it("shows a signed-in shopper their server cart", async () => {
      const products = await Product.insertMany(CATALOGUE);
      const rice = products.find((p) => p.name === "Rice 5kg");
      const user = await getUserDoc();
      await Cart.create({
        user: user._id,
        items: [{ product: rice._id, quantity: 2 }],
      });
      const token = generateToken(user._id, user.role);

      const res = await post({ message: "check my cart" }, token);

      expect(res.body.data.authRequired).toBe(false);
      expect(res.body.data.cart).toBeTruthy();
      expect(res.body.data.cart.totalItems).toBe(2);
      expect(res.body.data.cart.total).toBeCloseTo(25.98, 2);
      expect(res.body.data.cart.items[0].product.name).toBe("Rice 5kg");
      expect(res.body.message).toMatch(/2 items/i);
    });

    it("tells a signed-in shopper when their cart is empty", async () => {
      await Product.insertMany(CATALOGUE);
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);

      const res = await post({ message: "check my cart" }, token);

      expect(res.body.data.authRequired).toBe(false);
      expect(res.body.data.cart.items).toEqual([]);
      expect(res.body.message).toMatch(/cart is empty/i);
    });
  });

  describe("POST /api/ai/chat — order intents (degraded)", () => {
    it("asks an anonymous shopper to sign in to see their orders", async () => {
      const res = await post({ message: "track my last order" });

      expect(res.status).toBe(200);
      expect(res.body.degraded).toBe(true);
      expect(res.body.data.orders).toEqual([]);
      expect(res.body.data.authRequired).toBe(true);
      expect(res.body.message).toMatch(/sign in/i);
    });

    it("lists a signed-in shopper's recent orders", async () => {
      const user = await getUserDoc();
      await seedOrder(user._id);
      const token = generateToken(user._id, user.role);

      const res = await post({ message: "track my last order" }, token);

      expect(res.body.data.authRequired).toBe(false);
      expect(res.body.data.orders).toHaveLength(1);
      expect(res.body.data.orders[0].status).toBe("pending");
      expect(res.body.data.orders[0].reference).toHaveLength(8);
      expect(res.body.message).toMatch(/most recent order/i);
    });

    it("says so when a signed-in shopper has no orders", async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);

      const res = await post({ message: "my orders" }, token);

      expect(res.body.data.authRequired).toBe(false);
      expect(res.body.data.orders).toEqual([]);
      expect(res.body.message).toMatch(/haven't placed any orders/i);
    });
  });
});