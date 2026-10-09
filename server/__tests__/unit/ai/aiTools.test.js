import { startTestDB, stopTestDB, clearTestDB } from "../../testDB.js";
import User from "../../../models/User.js";
import Product from "../../../models/Product.js";
import Order from "../../../models/Order.js";
import Cart from "../../../models/Cart.js";
import { runAITool, toolDefinitionsFor, listToolsFor } from "../../../services/ai/tools/registry.js";

const makeUser = async (role = "user") =>
  User.create({
    name: role === "admin" ? "Admin" : "User",
    email: `${role}${Date.now() + Math.random()}@test.com`,
    password: "pass12345",
    role,
  });

const makeProduct = async (over = {}) =>
  Product.create({
    name: `Rice ${Date.now() + Math.random()}`,
    price: 8.99,
    category: "Pantry",
    image: "/rice.jpg",
    countInStock: 10,
    ...over,
  });

const ctxFor = (user, role = "user") => ({ user: { _id: user._id, role } });

describe("AI tool registry", () => {
  let admin;
  let customer;

  beforeAll(async () => {
    await startTestDB();
    admin = await makeUser("admin");
    customer = await makeUser("user");
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe("tool surface filtering", () => {
    it("omits auth-requiring tools for anonymous users", () => {
      const names = toolDefinitionsFor({ user: null }).map((tool) => tool.function.name);
      expect(names).toContain("searchProducts");
      expect(names).not.toContain("getCart");
      expect(names).not.toContain("getLowStockProducts");
    });

    it("exposes auth tools but hides admin tools for customers", () => {
      const names = toolDefinitionsFor({ user: { _id: "x", role: "user" } }).map(
        (tool) => tool.function.name
      );
      expect(names).toContain("getCart");
      expect(names).toContain("addToCart");
      expect(names).not.toContain("getLowStockProducts");
      expect(names).not.toContain("getSalesSummary");
    });

    it("exposes admin tools for admins", () => {
      const names = toolDefinitionsFor({ user: { _id: "x", role: "admin" } }).map(
        (tool) => tool.function.name
      );
      expect(names).toContain("getSalesSummary");
      expect(names).toContain("getLowStockProducts");
    });
  });

  describe("authorization gates", () => {
    it("rejects an unknown tool with unknown_tool", async () => {
      const result = await runAITool("deleteEverything", {}, { user: admin });
      expect(result.status).toBe("unknown_tool");
      expect(result.ok).toBe(false);
    });

    it("requires auth for cart tools", async () => {
      const result = await runAITool("getCart", {}, { user: null });
      expect(result.status).toBe("auth_required");
    });

    it("forbids admin tools for non-admins even when asked directly", async () => {
      const result = await runAITool(
        "getLowStockProducts",
        { threshold: 5 },
        ctxFor(customer)
      );
      expect(result.status).toBe("forbidden");
    });

    it("allows admin tools for admins", async () => {
      await makeProduct({ countInStock: 1 });
      await makeProduct({ countInStock: 9 });
      await makeProduct({ countInStock: 20 });

      const result = await runAITool(
        "getLowStockProducts",
        { threshold: 10 },
        ctxFor(admin, "admin")
      );

      expect(result.status).toBe("ok");
      expect(result.ok).toBe(true);
      expect(result.admin).toBeTruthy();
      expect(result.admin.products.length).toBe(2);
    });
  });

  describe("product tools", () => {
    it("searchProducts returns grounded results", async () => {
      const product = await makeProduct({ name: "Saco Rice 5kg" });
      await makeProduct({ name: "Olive Oil 1L", category: "Cooking Oil" });

      const result = await runAITool(
        "searchProducts",
        { keyword: "rice", pageSize: 10 },
        { user: null }
      );

      expect(result.ok).toBe(true);
      expect(result.status).toBe("ok");
      expect(result.results.length).toBe(1);
      expect(result.results[0].name).toBe("Saco Rice 5kg");
      expect(result.results[0]._id).toBe(String(product._id));
    });

    it("findRelatedProducts never returns the target product", async () => {
      const target = await makeProduct({ name: "Basmati Rice 5kg" });
      await makeProduct({ name: "Saco Rice 5kg" });
      await makeProduct({ name: "Long Grain Rice 5kg" });
      await makeProduct({ name: "Olive Oil", category: "Cooking Oil" });

      const result = await runAITool(
        "findRelatedProducts",
        { productId: String(target._id) },
        { user: null }
      );

      expect(result.status).toBe("ok");
      const ids = result.results.map((p) => p._id);
      expect(ids).not.toContain(String(target._id));
      expect(result.results.length).toBe(2);
    });

    it("findCheaperAlternative only returns products priced below the target", async () => {
      const target = await makeProduct({ name: "Premium Oil 1L", price: 10 });
      await makeProduct({ name: "Cheap Oil 1L", price: 3, category: "Cooking Oil" });
      await makeProduct({ name: "Mid Oil 1L", price: 7, category: "Cooking Oil" });
      await makeProduct({ name: "Pricier Oil 1L", price: 12, category: "Cooking Oil" });

      const result = await runAITool(
        "findCheaperAlternative",
        { productId: String(target._id), category: "Cooking Oil", limit: 10 },
        { user: null }
      );

      expect(result.status).toBe("ok");
      result.results.forEach((p) => expect(p.price).toBeLessThan(10));
      expect(result.results.map((p) => p.name)).toEqual(
        expect.arrayContaining(["Cheap Oil 1L", "Mid Oil 1L"])
      );
    });

    it("findCheaperAlternative reports no_results when nothing is cheaper", async () => {
      const target = await makeProduct({ name: "Budget Oil", price: 2 });
      await makeProduct({ name: "Dear Oil", price: 6, category: "Cooking Oil" });

      const result = await runAITool(
        "findCheaperAlternative",
        { productId: String(target._id), category: "Cooking Oil" },
        { user: null }
      );

      expect(result.status).toBe("no_results");
    });

    it("rejects invalid arguments without touching the database", async () => {
      const result = await runAITool(
        "searchProducts",
        { keyword: "rice", nope: 1 },
        { user: null }
      );
      expect(result.ok).toBe(false);
      expect(result.status).toBe("invalid_arguments");
    });
  });

  describe("cart tools", () => {
    let product;
    let rc;

    beforeEach(async () => {
      rc = ctxFor(customer);
      product = await makeProduct({ name: "Saco Rice 5kg", price: 8.99 });
    });

    it("rejects a non-existent product", async () => {
      const result = await runAITool(
        "addToCart",
        { productId: "000000000000000000000000", quantity: 1 },
        rc
      );
      expect(result.status).toBe("not_found");
    });

    it("won't add a sold-out product", async () => {
      await Product.updateOne({ _id: product._id }, { countInStock: 0 });
      const result = await runAITool(
        "addToCart",
        { productId: String(product._id), quantity: 1 },
        rc
      );
      expect(result.status).toBe("sold_out");
    });

    it("caps quantity at real stock", async () => {
      await Product.updateOne({ _id: product._id }, { countInStock: 3 });
      const result = await runAITool(
        "addToCart",
        { productId: String(product._id), quantity: 5, confirmed: true },
        rc
      );
      expect(result.status).toBe("insufficient_stock");
      expect(result.available).toBe(3);
    });

    it("adds a product and returns the real cart view", async () => {
      const result = await runAITool(
        "addToCart",
        { productId: String(product._id), quantity: 2 },
        rc
      );

      expect(result.status).toBe("ok");
      expect(result.cart.totalItems).toBe(2);
      expect(result.cart.total).toBeCloseTo(17.98, 2);
      expect(result.cart.items[0].product.name).toBe("Saco Rice 5kg");

      const saved = await Cart.findOne({ user: customer._id });
      expect(saved.items.length).toBe(1);
      expect(saved.items[0].quantity).toBe(2);
    });

    it("asks for confirmation before a large quantity", async () => {
      const result = await runAITool(
        "addToCart",
        { productId: String(product._id), quantity: 6 },
        rc
      );
      expect(result.status).toBe("needs_confirmation");

      const confirmed = await runAITool(
        "addToCart",
        { productId: String(product._id), quantity: 6, confirmed: true },
        rc
      );
      expect(confirmed.status).toBe("ok");
      expect(confirmed.cart.totalItems).toBe(6);
    });

    it("asks for confirmation before clearing the cart, then clears it", async () => {
      await runAITool("addToCart", { productId: String(product._id), quantity: 1 }, rc);

      const unconfirmed = await runAITool("clearCart", {}, rc);
      expect(unconfirmed.status).toBe("needs_confirmation");
      expect(unconfirmed.summary.reason).toBe("clear_cart");
      expect((await Cart.findOne({ user: customer._id })).items.length).toBe(1);

      const done = await runAITool("clearCart", { confirmed: true }, rc);
      expect(done.status).toBe("ok");
      expect(done.cart.items).toEqual([]);
    });

    it("removes a product line", async () => {
      await runAITool("addToCart", { productId: String(product._id), quantity: 1 }, rc);
      const result = await runAITool(
        "removeFromCart",
        { productId: String(product._id) },
        rc
      );
      expect(result.status).toBe("ok");
      expect(result.cart.items).toEqual([]);
    });

    it("calculates the current total", async () => {
      await runAITool("addToCart", { productId: String(product._id), quantity: 3 }, rc);
      const result = await runAITool("calculateCartTotal", {}, rc);
      expect(result.cartTotal).toBeCloseTo(26.97, 2);
    });
  });

  describe("order tools — cross-user isolation", () => {
    it("refuses to reveal another account's order", async () => {
      const other = await makeUser("user");
      const product = await makeProduct();

      const order = await Order.create({
        user: other._id,
        items: [
          {
            product: product._id,
            name: product.name,
            price: product.price,
            quantity: 1,
          },
        ],
        total_amount: product.price,
        status: "pending",
        customer_email: "other@test.com",
        shipping_address: {
          street: "1 Test St",
          city: "London",
          state: "England",
          postalCode: "SW1A 1AA",
          country: "UK",
        },
      });

      const snoop = await runAITool(
        "getOrderById",
        { orderId: String(order._id) },
        ctxFor(customer)
      );
      expect(snoop.status).toBe("not_found");

      const owner = await runAITool(
        "getOrderById",
        { orderId: String(order._id) },
        ctxFor(other)
      );
      expect(owner.status).toBe("ok");
      expect(owner.order._id).toBe(String(order._id));
    });

    it("lists only the shopper's own orders", async () => {
      const product = await makeProduct();
      const other = await makeUser("user");

      const mk = (owner) =>
        Order.create({
          user: owner._id,
          items: [{ product: product._id, name: product.name, price: product.price, quantity: 1 }],
          total_amount: product.price,
          status: "paid",
          customer_email: "owner@test.com",
          shipping_address: { street: "1", city: "L", state: "E", postalCode: "A", country: "UK" },
        });
      await mk(customer);
      await mk(other);

      const result = await runAITool("getMyOrders", { limit: 20 }, ctxFor(customer));
      expect(result.orders.length).toBe(1);
    });
  });

  describe("recommendProducts tool", () => {
    const mkOrder = (owner, products) =>
      Order.create({
        user: owner?._id,
        items: products.map((p) => ({
          product: p._id,
          name: p.name,
          price: p.price,
          quantity: 1,
        })),
        total_amount: products.reduce((sum, p) => sum + p.price, 0),
        status: "delivered",
        customer_email: "owner@test.com",
        shipping_address: { street: "1", city: "L", state: "E", postalCode: "A", country: "UK" },
      });

    it("is available to anonymous visitors (no personal data)", () => {
      const names = toolDefinitionsFor({ user: null }).map((tool) => tool.function.name);
      expect(names).toContain("recommendProducts");
    });

    it("returns popular picks for guests with a human reason", async () => {
      const product = await makeProduct({ name: "Guest Pick", price: 9.99 });
      await mkOrder(null, [product]);

      const result = await runAITool("recommendProducts", { limit: 5 }, { user: null });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("ok");
      expect(result.personalized).toBe(false);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations[0].product._id).toBe(String(product._id));
      expect(typeof result.recommendations[0].reason).toBe("string");
      expect(result.recommendations[0].reason.length).toBeGreaterThan(0);
    });

    it("personalises for signed-in shoppers and never repeats their own items", async () => {
      const shopper = await makeUser("user");
      const bystander = await makeUser("user");
      const rice = await makeProduct({ name: "Rice", category: "Pantry", tags: ["basics"] });
      const onions = await makeProduct({ name: "Onions", category: "Vegetables", tags: ["fresh"] });

      await mkOrder(shopper, [rice]);
      await mkOrder(bystander, [rice, onions]);

      const result = await runAITool("recommendProducts", { limit: 5 }, ctxFor(shopper));

      expect(result.ok).toBe(true);
      expect(result.personalized).toBe(true);
      const names = result.recommendations.map((r) => r.product.name);
      expect(names).not.toContain("Rice");
      expect(names).toContain("Onions");
    });

    it("clamps out-of-range limits instead of failing", async () => {
      const product = await makeProduct();
      await mkOrder(null, [product]);

      const result = await runAITool("recommendProducts", { limit: 99 }, { user: null });

      expect(result.ok).toBe(true);
      expect(result.recommendations.length).toBeLessThanOrEqual(10);
    });
  });

  describe("shopping tools", () => {
    describe("buildBudgetBasket", () => {
      it("is available to anonymous visitors", () => {
        const names = toolDefinitionsFor({ user: null }).map((tool) => tool.function.name);
        expect(names).toContain("buildBudgetBasket");
        expect(names).toContain("findSubstitutes");
        expect(names).not.toContain("buildReorderList");
      });

      it("fills a grounded basket without exceeding the budget", async () => {
        await makeProduct({ name: "Rice 5kg", price: 3, category: "Pantry" });
        await makeProduct({ name: "Beans", price: 2, category: "Pantry" });
        await makeProduct({ name: "Oil", price: 5, category: "Cooking Oil" });
        await makeProduct({ name: "Milk", price: 4, category: "Dairy" });

        const result = await runAITool("buildBudgetBasket", { budget: 10 }, { user: null });

        expect(result.ok).toBe(true);
        expect(result.status).toBe("ok");
        expect(result.basket.total).toBeLessThanOrEqual(10);
        expect(result.basket.remaining).toBeCloseTo(10 - result.basket.total, 2);
        expect(result.basket.items.length).toBeGreaterThan(0);
        result.basket.items.forEach((item) => {
          expect(item._id).toBeTruthy();
          expect(typeof item.price).toBe("number");
        });
      });

      it("respects the per-category cap", async () => {
        for (let i = 0; i < 4; i += 1) {
          await makeProduct({ name: `Pantry ${i}`, price: 1, category: "Pantry" });
        }

        const result = await runAITool("buildBudgetBasket", { budget: 20, maxPerCategory: 2 }, { user: null });

        expect(result.basket.items.filter((item) => item.category === "Pantry")).toHaveLength(2);
      });

      it("reports no_results when nothing fits the budget", async () => {
        await makeProduct({ name: "Pricey", price: 50, category: "Pantry" });

        const result = await runAITool("buildBudgetBasket", { budget: 1 }, { user: null });

        expect(result.status).toBe("no_results");
        expect(result.basket.items).toEqual([]);
        expect(result.basket.remaining).toBe(1);
      });

      it("rejects a missing or invalid budget", async () => {
        expect((await runAITool("buildBudgetBasket", {}, { user: null })).status).toBe("invalid_arguments");
        expect((await runAITool("buildBudgetBasket", { budget: -5 }, { user: null })).status).toBe("invalid_arguments");
      });
    });

    describe("findSubstitutes", () => {
      it("returns same-aisle in-stock alternatives with a real price difference", async () => {
        const target = await makeProduct({ name: "Premium Oil", price: 10, category: "Cooking Oil" });
        await makeProduct({ name: "Cheap Oil", price: 4, category: "Cooking Oil" });
        const sold = await makeProduct({ name: "Sold Oil", price: 2, category: "Cooking Oil", countInStock: 0 });

        const result = await runAITool("findSubstitutes", { productId: String(target._id) }, { user: null });

        expect(result.status).toBe("ok");
        const ids = result.recommendations.map((entry) => entry.product._id);
        expect(ids).not.toContain(String(target._id));
        expect(ids).not.toContain(String(sold._id));

        const cheap = result.recommendations.find((entry) => entry.product.name === "Cheap Oil");
        expect(cheap.priceDelta).toBe(-6);
        expect(cheap.reason).toMatch(/cheaper/);
      });

      it("reports not_found for a real but unknown product id", async () => {
        const result = await runAITool(
          "findSubstitutes",
          { productId: "000000000000000000000000" },
          { user: null }
        );
        expect(result.status).toBe("not_found");
      });
    });

    describe("buildReorderList", () => {
      const shipping = { street: "1 Test St", city: "London", state: "England", postalCode: "SW1A 1AA", country: "UK" };

      const mkOrder = (owner, items, over = {}) =>
        Order.create({
          user: owner?._id,
          items,
          total_amount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
          status: "delivered",
          customer_email: "owner@test.com",
          shipping_address: shipping,
          ...over,
        });

      it("requires a signed-in shopper", async () => {
        const result = await runAITool("buildReorderList", {}, { user: null });
        expect(result.status).toBe("auth_required");
      });

      it("proposes the shopper's most recent order using real products", async () => {
        const product = await makeProduct({ name: "Saco Rice 5kg", price: 8.99 });
        await mkOrder(customer, [
          { product: product._id, name: product.name, price: 8.99, quantity: 2 },
        ]);

        const result = await runAITool("buildReorderList", {}, ctxFor(customer));

        expect(result.status).toBe("ok");
        expect(result.basket.kind).toBe("reorder");
        expect(result.basket.items).toHaveLength(1);
        expect(result.basket.items[0]._id).toBe(String(product._id));
        expect(result.basket.items[0].quantity).toBe(2);
        expect(result.basket.total).toBeCloseTo(17.98, 2);
      });

      it("reports items we no longer stock", async () => {
        const ghost = await makeProduct({ name: "Temporary" });
        await mkOrder(customer, [
          { product: ghost._id, name: "Ghost Item", price: 1, quantity: 1 },
        ]);
        await Product.deleteOne({ _id: ghost._id });

        const result = await runAITool("buildReorderList", {}, ctxFor(customer));

        expect(result.basket.items).toEqual([]);
        expect(result.basket.missing).toEqual([{ name: "Ghost Item", quantity: 1 }]);
      });

      it("never reveals another shopper's order", async () => {
        const other = await makeUser("user");
        const product = await makeProduct({ name: "Secret Rice", price: 5 });
        const order = await mkOrder(other, [
          { product: product._id, name: product.name, price: 5, quantity: 1 },
        ]);

        const result = await runAITool(
          "buildReorderList",
          { orderId: String(order._id) },
          ctxFor(customer)
        );

        expect(result.status).toBe("not_found");
        expect(result.basket.items).toEqual([]);
      });
    });
  });
});
