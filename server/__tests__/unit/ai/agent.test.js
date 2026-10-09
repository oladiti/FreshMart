// The structured `data` payload is what the React widget renders, so the
// contract matters more than the model's prose: a tool result that never
// reaches `data` is invisible to the shopper no matter what the reply says.

import { startTestDB, stopTestDB, clearTestDB } from "../../testDB.js";
import Product from "../../../models/Product.js";
import { defaultCache } from "../../../services/recommendations/computeRecommendations.js";

jest.mock("../../../services/ai/client.js", () => ({
  createChatCompletion: jest.fn(),
}));

import { createChatCompletion } from "../../../services/ai/client.js";
import { runAgent } from "../../../services/ai/agent.js";

const toolTurn = (name, args) => ({
  content: "",
  toolCalls: [
    { id: `call-${name}`, function: { name, arguments: JSON.stringify(args) } },
  ],
});

const finalTurn = (content) => ({ content, toolCalls: [] });

const makeDealProduct = () =>
  Product.create({
    name: "Weekly Deal Oil",
    price: 3.5,
    category: "Cooking Oil",
    image: "/o.jpg",
    countInStock: 8,
    isWeeklyDeal: true,
  });

describe("runAgent", () => {
  beforeAll(startTestDB);
  afterAll(stopTestDB);

  beforeEach(async () => {
    await clearTestDB();
    defaultCache.clear();
    createChatCompletion.mockReset();
  });

  it("carries recommendProducts output through to data.recommendations", async () => {
    const product = await makeDealProduct();

    createChatCompletion
      .mockResolvedValueOnce(toolTurn("recommendProducts", { limit: 3 }))
      .mockResolvedValueOnce(finalTurn("Here are a few picks."));

    const result = await runAgent({ message: "what should I buy today?" });

    expect(result.message).toBe("Here are a few picks.");
    expect(result.degraded).toBe(false);
    expect(result.data.personalized).toBe(false);
    expect(result.data.recommendations).toHaveLength(1);

    const [entry] = result.data.recommendations;
    expect(entry.product._id).toBe(String(product._id));
    expect(typeof entry.reason).toBe("string");
    expect(entry.reason.length).toBeGreaterThan(0);

    // Recommendations are their own block, not extra search hits.
    expect(result.data.products).toEqual([]);
  });

  it("keeps an empty recommendations block when no recommend tool ran", async () => {
    createChatCompletion.mockResolvedValueOnce(finalTurn("Hello!"));

    const result = await runAgent({ message: "hi" });

    expect(result.data.recommendations).toEqual([]);
    expect(result.data.personalized).toBe(false);
    expect(result.data.products).toEqual([]);
  });

  it("answers with the model prose even when a tool-only turn produced none", async () => {
    await makeDealProduct();

    createChatCompletion
      .mockResolvedValueOnce(toolTurn("recommendProducts", { limit: 3 }))
      .mockResolvedValueOnce(finalTurn(""));

    const result = await runAgent({ message: "recommend something" });

    expect(result.message).toBe(
      "Here's what I found for you. Anything else I can help with?"
    );
    expect(result.data.recommendations.length).toBeGreaterThan(0);
  });

  it("carries a shopping basket through to data.basket", async () => {
    await Product.create({
      name: "Budget Rice",
      price: 3,
      category: "Pantry",
      image: "/r.jpg",
      countInStock: 10,
    });

    createChatCompletion
      .mockResolvedValueOnce(toolTurn("buildBudgetBasket", { budget: 5 }))
      .mockResolvedValueOnce(finalTurn("Here's a basket for £5."));

    const result = await runAgent({ message: "what can I get for £5?" });

    expect(result.data.basket).toBeTruthy();
    expect(result.data.basket.kind).toBe("budget");
    expect(result.data.basket.items.length).toBeGreaterThan(0);
    expect(result.data.basket.total).toBeLessThanOrEqual(5);
  });
});
