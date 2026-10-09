import { startTestDB, stopTestDB, clearTestDB } from "../../testDB.js";
import User from "../../../models/User.js";
import Product from "../../../models/Product.js";
import Order from "../../../models/Order.js";
import {
  computeRecommendations,
  createCache,
  REASONS,
} from "../../../services/recommendations/computeRecommendations.js";

const makeUser = async (role = "user") =>
  User.create({
    name: role,
    email: `${role}-${Date.now()}-${Math.random()}@test.com`,
    password: "pass12345",
    role,
  });

const makeProduct = async (over = {}) =>
  Product.create({
    name: `Product ${Date.now()}-${Math.random()}`,
    price: 2,
    category: "Pantry",
    image: "/p.jpg",
    countInStock: 10,
    tags: [],
    ...over,
  });

const makeOrder = async (user, items, status = "delivered") => {
  const order = new Order({
    user: user?._id,
    items,
    total_amount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    status,
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

const item = (product, quantity = 1, price = 2) => ({
  product: product._id,
  name: product.name,
  price,
  quantity,
});

describe("computeRecommendations", () => {
  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(clearTestDB);

  // A cache that is always "expired" so every call recomputes fresh.
  const freshCache = () => createCache(1);

  it("returns an empty list for an empty store", async () => {
    const result = await computeRecommendations({ user: null, cache: freshCache() });
    expect(result.personalized).toBe(false);
    expect(result.recommendations).toEqual([]);
  });

  it("returns the store's popular items for anonymous visitors", async () => {
    const popular = await makeProduct({ name: "Popular Oil", category: "Cooking Oil" });
    const niche = await makeProduct({ name: "Niche Spice", category: "Spices" });
    await makeOrder(null, [item(popular, 5), item(niche, 1)]);

    const result = await computeRecommendations({ user: null, cache: freshCache() });

    expect(result.personalized).toBe(false);
    const names = result.recommendations.map((r) => r.product.name);
    expect(names[0]).toBe("Popular Oil");
    expect(result.recommendations[0].reason).toBe(REASONS.POPULAR);
  });

  it("never recommends a sold-out product", async () => {
    const inStock = await makeProduct({ name: "In Stock", countInStock: 10 });
    const gone = await makeProduct({ name: "Gone", countInStock: 0 });
    await makeOrder(null, [item(inStock, 6), item(gone, 6)]);

    const result = await computeRecommendations({ user: null, cache: freshCache() });
    const names = result.recommendations.map((r) => r.product.name);

    expect(names).toContain("In Stock");
    expect(names).not.toContain("Gone");
  });

  it("personalises from the shopper's orders and never re-recommends them", async () => {
    const user = await makeUser();
    const other = await makeUser();
    const rice = await makeProduct({ name: "Rice 5kg", category: "Pantry", tags: ["basics"] });
    const onions = await makeProduct({ name: "Onions", category: "Vegetables", tags: ["fresh"] });
    const oil = await makeProduct({ name: "Cooking Oil", category: "Pantry", tags: ["basics"] });
    const popcorn = await makeProduct({ name: "Popcorn", category: "Snacks", tags: ["fun"] });

    await makeOrder(user, [item(rice)]);
    await makeOrder(other, [item(rice), item(onions, 2)]);
    await makeOrder(other, [item(oil)]);

    const result = await computeRecommendations({
      user: { _id: user._id },
      cache: freshCache(),
    });

    expect(result.personalized).toBe(true);
    const names = result.recommendations.map((r) => r.product.name);
    expect(names).not.toContain("Rice 5kg");
    expect(names).toContain("Onions"); // co-purchased with rice by another shopper
    expect(names).toContain("Cooking Oil"); // same category + tags as rice
    expect(names).not.toContain("Popcorn");

    const onion = result.recommendations.find((r) => r.product.name === "Onions");
    expect(onion.reason).toBe(REASONS.CO_PURCHASE);
  });

  it("labels same-category picks with the similar reason", async () => {
    const user = await makeUser();
    const oil = await makeProduct({ name: "Oil", category: "Pantry", tags: ["basics"] });
    const oil2 = await makeProduct({ name: "Another Oil", category: "Pantry", tags: ["basics"] });
    await makeOrder(user, [item(oil)]);

    const result = await computeRecommendations({
      user: { _id: user._id },
      cache: freshCache(),
    });

    const pick = result.recommendations.find((r) => r.product.name === "Another Oil");
    expect(pick).toBeTruthy();
    expect(pick.reason).toBe(REASONS.SIMILAR);
  });

  it("honours the limit and the exclude list", async () => {
    const user = await makeUser();
    const a = await makeProduct({ name: "A", category: "Pantry", tags: ["x"] });
    const b = await makeProduct({ name: "B", category: "Pantry", tags: ["x"] });
    const c = await makeProduct({ name: "C", category: "Pantry", tags: ["x"] });
    await makeOrder(user, [item(a)]);

    const result = await computeRecommendations({
      user: { _id: user._id },
      limit: 1,
      excludedIds: [String(b._id)],
      cache: freshCache(),
    });

    expect(result.recommendations.length).toBe(1);
    expect(result.recommendations[0].product._id).toBe(String(c._id));
  });

  it("dedupes candidates across signals", async () => {
    const user = await makeUser();
    const other = await makeUser();
    const rice = await makeProduct({ name: "Rice", category: "Pantry", tags: ["basics"] });
    const onions = await makeProduct({ name: "Onions", category: "Vegetables", tags: ["basics"] });
    await makeOrder(user, [item(rice)]);
    await makeOrder(other, [item(rice), item(onions)]);

    const result = await computeRecommendations({
      user: { _id: user._id },
      cache: freshCache(),
    });

    const count = result.recommendations.filter((r) => r.product.name === "Onions").length;
    expect(count).toBe(1);
  });

  it("surfaces weekly deals even before they are popular", async () => {
    const deal = await makeProduct({ name: "New Deal Oil", category: "Pantry", isWeeklyDeal: true });
    const commodity = await makeProduct({ name: "Commodity Rice", category: "Pantry" });
    await makeOrder(null, [item(commodity, 3)]);

    const result = await computeRecommendations({ user: null, cache: freshCache() });
    const pick = result.recommendations.find((r) => r.product.name === "New Deal Oil");

    expect(pick).toBeTruthy();
    expect(pick.reason).toBe(REASONS.DEAL);
  });

  it("supports an explicit seed product (product-page variant)", async () => {
    const target = await makeProduct({ name: "Target", category: "Pantry", tags: ["basics"] });
    const related = await makeProduct({ name: "Related", category: "Pantry", tags: ["basics"] });
    await makeOrder(null, [item(target)]);

    const result = await computeRecommendations({
      user: null,
      seedProductId: String(target._id),
      cache: freshCache(),
    });

    const names = result.recommendations.map((r) => r.product.name);
    expect(names).not.toContain("Target");
    expect(names).toContain("Related");
  });

  it("returns grounded product shapes only", async () => {
    const popular = await makeProduct({ name: "Grounded", category: "Pantry" });
    await makeOrder(null, [item(popular, 2)]);

    const result = await computeRecommendations({ user: null, cache: freshCache() });
    const product = result.recommendations[0].product;

    expect(product._id).toBe(String(popular._id));
    expect(product.name).toBe("Grounded");
    expect(product.price).toBe(2);
    expect(product.countInStock).toBe(10);
    expect(product).not.toHaveProperty("reviews");
    expect(product).not.toHaveProperty("tags");
  });
});