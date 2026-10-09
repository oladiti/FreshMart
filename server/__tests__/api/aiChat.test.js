import {
  agent,
  setupApiTest,
  teardownApiTest,
  seedUsers,
  generateToken,
  getUserDoc,
} from "./apiSetup.js";
import Product from "../../models/Product.js";

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
});