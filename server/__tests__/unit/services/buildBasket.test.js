import { buildBasket } from "../../../services/assistant/buildBasket.js";

const product = (over = {}) => ({
  _id: over._id || Math.random().toString(36).slice(2),
  name: over.name || "Item",
  price: over.price ?? 1,
  category: over.category || "Pantry",
  averageRating: over.averageRating ?? null,
  ...over,
});

describe("buildBasket", () => {
  it("never spends more than the budget", () => {
    const products = [
      product({ price: 4 }),
      product({ price: 3 }),
      product({ price: 5 }),
      product({ price: 2 }),
    ];

    const basket = buildBasket(products, 6);

    expect(basket.total).toBeLessThanOrEqual(6);
    expect(basket.budget).toBe(6);
    expect(basket.remaining).toBeCloseTo(6 - basket.total, 2);
  });

  it("caps how many items come from one category", () => {
    const products = [
      product({ name: "a", price: 1, category: "Pantry" }),
      product({ name: "b", price: 1, category: "Pantry" }),
      product({ name: "c", price: 1, category: "Pantry" }),
      product({ name: "d", price: 1, category: "Pantry" }),
    ];

    const basket = buildBasket(products, 20, { maxPerCategory: 2 });

    expect(basket.items.filter((item) => item.category === "Pantry")).toHaveLength(2);
    expect(basket.total).toBe(2);
  });

  it("caps the total number of items", () => {
    const products = ["a", "b", "c", "d", "e"].map((name, index) =>
      product({ name, price: 1, category: `Cat${index}` })
    );

    const basket = buildBasket(products, 50, { maxItems: 3 });

    expect(basket.items).toHaveLength(3);
  });

  it("prefers better-rated items first", () => {
    const products = [
      product({ name: "Low", price: 1, category: "A", averageRating: 2 }),
      product({ name: "High", price: 1, category: "B", averageRating: 4.5 }),
    ];

    const basket = buildBasket(products, 1);

    expect(basket.items[0].name).toBe("High");
  });

  it("applies the caller's item projection", () => {
    const products = [product({ name: "Rice", price: 2 })];

    const basket = buildBasket(products, 5, { mapItem: (p) => ({ _id: p._id, name: p.name }) });

    expect(basket.items[0]).toMatchObject({ name: "Rice", lineTotal: 2 });
    expect(basket.items[0].price).toBeUndefined();
  });

  it("returns an empty basket when nothing fits", () => {
    const basket = buildBasket([product({ price: 50 })], 5);

    expect(basket.items).toEqual([]);
    expect(basket.total).toBe(0);
    expect(basket.remaining).toBe(5);
  });
});
