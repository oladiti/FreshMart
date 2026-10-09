// Integration tests for the searchProducts tool against a real Product
// collection. The point of these is the grounding guarantee: every value the
// tool returns must be readable in Mongo, and nothing may be invented when a
// search finds nothing.

import { startTestDB, stopTestDB, clearTestDB } from "../testDB.js";
import Product from "../../models/Product.js";
import {
  searchProducts,
  validateSearchArgs,
  TOOL_NAME,
  AVAILABILITY,
  SORT,
} from "../../services/assistant/tools/index.js";
import { runTool, listToolDefinitions, getToolDefinition } from "../../services/assistant/tools/index.js";

const CATALOGUE = [
  { name: "Rice 5kg", price: 12.99, category: "Pantry", image: "/r.jpg", countInStock: 10, description: "Long grain rice bag.", brand: "Saco" },
  { name: "Basmati Rice 5kg", price: 15.99, category: "Pantry", image: "/r.jpg", countInStock: 8 },
  { name: "Ofada Rice 5kg", price: 19.99, category: "Ethnic Food", image: "/r.jpg", countInStock: 4 },
  { name: "Tomatoes", price: 2.5, category: "Vegetables", image: "/t.jpg", countInStock: 20 },
  { name: "Onions", price: 1.8, category: "Vegetables", image: "/o.jpg", countInStock: 30 },
  { name: "Cooking Oil 1Ltr", price: 3.49, category: "Pantry", image: "/c.jpg", countInStock: 12, description: "Vegetable cooking oil." },
  { name: "Palm Oil 1L", price: 6.49, category: "Cooking Oil", image: "/p.jpg", countInStock: 6 },
  { name: "Olive Oil 1L", price: 7.99, category: "Cooking Oil", image: "/ol.jpg", countInStock: 3 },
  { name: "Lobster Tail (each)", price: 9.99, category: "Fish", image: "/l.jpg", countInStock: 0 },
  // Deliberately has no category at all, to prove null is not invented.
  { name: "Mystery Jar", price: 4, image: "/m.jpg", countInStock: 2, category: null },
];

const names = (result) => result.results.map((p) => p.name);

describe("searchProducts tool (integration)", () => {
  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    await Product.insertMany(CATALOGUE);
  });

  describe("tool registry", () => {
    it("lists searchProducts as the available tool", () => {
      expect(listToolDefinitions().map((t) => t.name)).toEqual([TOOL_NAME]);
      expect(getToolDefinition(TOOL_NAME).name).toBe(TOOL_NAME);
      expect(getToolDefinition("nope")).toBeNull();
    });

    it("returns an error envelope for an unknown tool instead of throwing", async () => {
      const result = await runTool("deleteEverything", {});
      expect(result.status).toBe("unknown_tool");
      expect(result.ok).toBe(false);
    });

    it("dispatches through runTool by name", async () => {
      const result = await runTool(TOOL_NAME, { keyword: "rice" });
      expect(result.status).toBe("ok");
      expect(names(result)).toContain("Rice 5kg");
    });
  });

  describe("keyword", () => {
    it("matches on name and description", async () => {
      const result = await searchProducts({ keyword: "rice" });
      expect(result.status).toBe("ok");
      expect(names(result)).toEqual(
        expect.arrayContaining(["Rice 5kg", "Basmati Rice 5kg", "Ofada Rice 5kg"])
      );
    });

    it("finds a product by a word that only appears in its description", async () => {
      const result = await searchProducts({ keyword: "vegetable" });
      expect(names(result)).toContain("Cooking Oil 1Ltr");
    });

    it("finds a product by brand", async () => {
      const result = await searchProducts({ keyword: "saco" });
      expect(names(result)).toEqual(["Rice 5kg"]);
    });

    it("ranks an exact name match first", async () => {
      const result = await searchProducts({ keyword: "Rice 5kg" });
      expect(names(result)[0]).toBe("Rice 5kg");
    });

    it("treats a regex metacharacter as literal text", async () => {
      // Would throw or match-everything if it reached Mongo unescaped.
      const result = await searchProducts({ keyword: ".*" });
      expect(result.status).toBe("no_results");
      expect(result.results).toEqual([]);
    });

    it("does not match an injection attempt", async () => {
      const result = await searchProducts({ keyword: 'rice" || {} || "' });
      expect(result.results.every((p) => typeof p.name === "string")).toBe(true);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe("category", () => {
    it("filters by a real category name", async () => {
      const result = await searchProducts({ category: "Vegetables" });
      expect(names(result).sort()).toEqual(["Onions", "Tomatoes"]);
    });

    it("resolves an alias onto the canonical category", async () => {
      const result = await searchProducts({ category: "veggies" });
      expect(names(result).sort()).toEqual(["Onions", "Tomatoes"]);
    });

    it("accepts an array of categories", async () => {
      const result = await searchProducts({ category: ["Vegetables", "Fish"] });
      expect(names(result).sort()).toEqual(["Lobster Tail (each)", "Onions", "Tomatoes"]);
    });

    it("does not match a product whose category is null", async () => {
      const result = await searchProducts({ category: "Pantry" });
      expect(names(result)).not.toContain("Mystery Jar");
    });

    it("returns null for a product with no category rather than guessing one", async () => {
      const result = await searchProducts({ keyword: "mystery" });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].category).toBeNull();
    });

    it("returns nothing and hands back real categories for a category that does not exist", async () => {
      const result = await searchProducts({ category: "Underwater Basket" });
      expect(result.status).toBe("no_results");
      expect(result.results).toEqual([]);
      expect(result.availableCategories).toEqual(
        expect.arrayContaining(["Pantry", "Vegetables", "Fish"])
      );
      // Never invents the category the caller asked for.
      expect(result.availableCategories).not.toContain("Underwater Basket");
    });

    it("flags a category it could not verify", async () => {
      const result = await searchProducts({ category: "Mystery Goods" });
      expect(result.notes).toContain("category-unverified");
      // An unverifiable category still cannot match anything, and the real list
      // comes back so the caller can correct itself.
      expect(result.status).toBe("no_results");
      expect(result.availableCategories).toContain("Pantry");
    });

    it("omits availableCategories on a normal successful search", async () => {
      const result = await searchProducts({ keyword: "rice" });
      expect(result.availableCategories).toBeUndefined();
    });
  });

  describe("minimum and maximum price", () => {
    it("applies an inclusive minimum", async () => {
      const result = await searchProducts({ keyword: "", minPrice: 6.49, availability: "all" });
      expect(names(result).sort()).toEqual(
        [
          "Basmati Rice 5kg",
          "Lobster Tail (each)",
          "Ofada Rice 5kg",
          "Olive Oil 1L",
          "Palm Oil 1L",
          "Rice 5kg",
        ].sort()
      );
    });

    it("applies an inclusive maximum", async () => {
      const result = await searchProducts({ maxPrice: 2.5 });
      expect(names(result).sort()).toEqual(["Onions", "Tomatoes"].sort());
    });

    it("applies both bounds together", async () => {
      const result = await searchProducts({ minPrice: 3, maxPrice: 7 });
      expect(names(result).sort()).toEqual(
        ["Cooking Oil 1Ltr", "Mystery Jar", "Palm Oil 1L"].sort()
      );
    });

    it("returns nothing when the range excludes the whole catalogue", async () => {
      const result = await searchProducts({ minPrice: 100, maxPrice: 200 });
      expect(result.status).toBe("no_results");
      expect(result.pagination.total).toBe(0);
    });

    it("combines price bounds with a category", async () => {
      const result = await searchProducts({ category: "Pantry", maxPrice: 5 });
      expect(names(result)).toEqual(["Cooking Oil 1Ltr"]);
    });
  });

  describe("availability", () => {
    it("returns only items that can be bought", async () => {
      const result = await searchProducts({ keyword: "", availability: AVAILABILITY.IN_STOCK, category: "Fish" });
      expect(names(result)).not.toContain("Lobster Tail (each)");
    });

    it("excludes sold-out items from an in-stock search", async () => {
      const result = await searchProducts({ keyword: "oil", availability: AVAILABILITY.IN_STOCK });
      expect(names(result)).toEqual(
        expect.arrayContaining(["Cooking Oil 1Ltr", "Palm Oil 1L", "Olive Oil 1L"])
      );
      expect(result.results.every((p) => p.countInStock > 0)).toBe(true);
    });

    it("returns only sold-out items when asked", async () => {
      const result = await searchProducts({ availability: AVAILABILITY.OUT_OF_STOCK });
      expect(names(result)).toEqual(["Lobster Tail (each)"]);
    });

    it("reports real stock counts, including zero", async () => {
      const result = await searchProducts({ keyword: "lobster" });
      expect(result.results[0].countInStock).toBe(0);
    });

    it("includes sold-out items when availability is all", async () => {
      const result = await searchProducts({ category: "Fish" });
      expect(names(result)).toEqual(["Lobster Tail (each)"]);
    });
  });

  describe("sorting", () => {
    it("sorts by ascending price", async () => {
      const result = await searchProducts({ category: "Cooking Oil", sort: SORT.PRICE_ASC });
      expect(names(result)).toEqual(["Palm Oil 1L", "Olive Oil 1L"]);
    });

    it("sorts by descending price", async () => {
      const result = await searchProducts({ category: "Cooking Oil", sort: SORT.PRICE_DESC });
      expect(names(result)).toEqual(["Olive Oil 1L", "Palm Oil 1L"]);
    });

    it("sorts by name", async () => {
      const asc = await searchProducts({ category: "Vegetables", sort: SORT.NAME_ASC });
      expect(names(asc)).toEqual(["Onions", "Tomatoes"]);
      const desc = await searchProducts({ category: "Vegetables", sort: SORT.NAME_DESC });
      expect(names(desc)).toEqual(["Tomatoes", "Onions"]);
    });

    it("returns identical pages when the same sort is repeated", async () => {
      const a = await searchProducts({ category: "Cooking Oil", sort: SORT.PRICE_ASC });
      const b = await searchProducts({ category: "Cooking Oil", sort: SORT.PRICE_ASC });
      expect(names(a)).toEqual(names(b));
    });
  });

  describe("pagination", () => {
    const all = { keyword: "oil", sort: SORT.PRICE_ASC, pageSize: 1 };

    it("reports totals and page count", async () => {
      const result = await searchProducts({ ...all });
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 1,
        total: 3,
        totalPages: 3,
        hasMore: true,
      });
    });

    it("walks pages without repeating or skipping a result", async () => {
      const seen = [];
      for (let page = 1; page <= 3; page += 1) {
        const result = await searchProducts({ ...all, page });
        seen.push(...names(result));
      }
      expect(seen).toEqual(["Cooking Oil 1Ltr", "Palm Oil 1L", "Olive Oil 1L"]);
    });

    it("reports hasMore false on the last page", async () => {
      const result = await searchProducts({ ...all, page: 3 });
      expect(result.pagination.hasMore).toBe(false);
    });

    it("returns an empty page past the end without inventing results", async () => {
      const result = await searchProducts({ ...all, page: 99 });
      expect(result.status).toBe("no_results");
      expect(result.results).toEqual([]);
      expect(result.pagination.total).toBe(3);
    });

    it("keeps relevance paging consistent with page 1", async () => {
      const page1 = await searchProducts({ keyword: "rice", sort: SORT.RELEVANCE, pageSize: 1 });
      const page2 = await searchProducts({ keyword: "rice", sort: SORT.RELEVANCE, pageSize: 1, page: 2 });
      expect(page1.results[0]._id).not.toBe(page2.results[0]._id);
      expect(page1.pagination.total).toBe(3);
    });
  });

  describe("invalid arguments", () => {
    it("returns an invalid_arguments envelope rather than throwing", async () => {
      const result = await searchProducts({ keyword: "rice", bogus: true });
      expect(result.ok).toBe(false);
      expect(result.status).toBe("invalid_arguments");
      expect(result.results).toEqual([]);
      expect(result.errors[0].message).toMatch(/Unknown parameter/);
    });

    it("refuses an empty argument bag", async () => {
      const result = await searchProducts({});
      expect(result.status).toBe("invalid_arguments");
    });

    it("reports every problem at once", async () => {
      const result = await searchProducts({ minPrice: 10, maxPrice: 1, sort: "sideways" });
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("agrees with validateSearchArgs on what is acceptable", async () => {
      const bad = { keyword: "rice", page: 0 };
      expect(validateSearchArgs(bad).ok).toBe(false);
      expect((await searchProducts(bad)).status).toBe("invalid_arguments");
    });
  });

  describe("grounding guarantee", () => {
    it("returns only values that exist in Mongo", async () => {
      const result = await searchProducts({ keyword: "rice", pageSize: 50 });
      const docs = await Product.find({ _id: { $in: result.results.map((p) => p._id) } }).lean();
      expect(docs).toHaveLength(result.results.length);

      for (const product of result.results) {
        const doc = docs.find((d) => String(d._id) === product._id);
        expect(product.name).toBe(doc.name);
        expect(product.price).toBe(doc.price);
        expect(product.countInStock).toBe(doc.countInStock);
        expect(product.category ?? null).toBe(doc.category ?? null);
        expect(product.sku).toBe(doc.sku);
      }
    });

    it("returns real ids that resolve to documents", async () => {
      const result = await searchProducts({ keyword: "rice" });
      for (const product of result.results) {
        await expect(Product.findById(product._id)).resolves.toBeTruthy();
      }
    });

    it("reports catalog stats read from the collection", async () => {
      const result = await searchProducts({ keyword: "rice" });
      expect(result.catalog).toEqual({ minPrice: 1.8, maxPrice: 19.99, productCount: 10 });
    });

    it("never returns a name that is not in the catalogue", async () => {
      const result = await searchProducts({ keyword: "sushi" });
      const real = await Product.distinct("name");
      for (const product of result.results) expect(real).toContain(product.name);
      expect(result.results).toEqual([]);
    });

    it("returns an empty result set rather than a substitute for a miss", async () => {
      const result = await searchProducts({ keyword: "sushi" });
      expect(result.results).toEqual([]);
      expect(result.status).toBe("no_results");
    });

    it("does not query Mongo at all when arguments are invalid", async () => {
      const spy = jest.spyOn(Product, "find");
      await searchProducts({ keyword: "rice", page: -1 });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("refuses to return results when verification cannot confirm them", async () => {
      // The tool's own injection seam: the first find() is the search, the
      // second is the grounding re-read. Tamper with only the re-read.
      let findCalls = 0;
      const TamperingModel = {
        countDocuments: (...args) => Product.countDocuments(...args),
        findOne: (...args) => Product.findOne(...args),
        distinct: (...args) => Product.distinct(...args),
        find: (...args) => {
          findCalls += 1;
          const query = Product.find(...args);
          const lean = () => query.lean();
          const chain = {
            lean: async () =>
              findCalls === 1
                ? lean()
                : (await lean()).map((d) => ({ ...d, price: d.price + 100 })),
            sort: () => chain,
            skip: () => chain,
            limit: () => chain,
          };
          return chain;
        },
      };

      await expect(
        searchProducts({ keyword: "rice" }, { Product: TamperingModel })
      ).rejects.toThrow(/ungrounded/i);
    });

    it("does not query Mongo at all when verification is skipped", async () => {
      const spy = jest.spyOn(Product, "find");
      await searchProducts({ keyword: "rice" }, { verify: false });
      // One find for the search, none for the grounding re-read.
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it("skips verification when explicitly disabled", async () => {
      const result = await searchProducts({ keyword: "rice" }, { verify: false });
      expect(result.status).toBe("ok");
      expect(result.results.length).toBe(3);
    });
  });
});
