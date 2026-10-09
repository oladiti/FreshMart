import { INTENTS, parseQuery, tokenize } from "../../../services/assistant/parseQuery.js";
import { SORT } from "../../../services/assistant/tools/searchProducts.js";

describe("tokenize", () => {
  it("lowercases and drops punctuation so 'rice.' equals 'rice'", () => {
    expect(tokenize("Show me Rice.")).toEqual(["show", "me", "rice"]);
  });

  it("never throws on non-string input", () => {
    expect(tokenize(null)).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
    expect(tokenize(42)).toEqual(["42"]);
  });
});

describe("parseQuery - intents", () => {
  it("reads a plain product search with a confidence the controller trusts", () => {
    const { intent, slots, confidence } = parseQuery("Show me rice.");

    expect(intent).toBe(INTENTS.PRODUCT_SEARCH);
    expect(slots.query).toBe("rice");
    expect(confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("detects stock questions", () => {
    const { intent, slots } = parseQuery("Do you have rice in stock?");

    expect(intent).toBe(INTENTS.AVAILABILITY);
    expect(slots.inStock).toBe(true);
    expect(slots.query).toBe("rice");
  });

  it("keeps 'sold out' out of the in-stock list", () => {
    const { intent, slots } = parseQuery("sold out rice");

    expect(intent).toBe(INTENTS.AVAILABILITY);
    expect(slots.inStock).toBe(false);
  });

  it("routes bargain hunting to value_find on the cheapest sort", () => {
    const { intent, slots } = parseQuery("Find cheap cooking oil");

    expect(intent).toBe(INTENTS.VALUE_FIND);
    expect(slots.sort).toBe(SORT.PRICE_ASC);
    expect(slots.query).toBe("cooking oil");
    expect(slots.categories).toContain("Cooking Oil");
  });

  it("routes 'most expensive' to the dearest sort", () => {
    const { intent, slots } = parseQuery("most expensive tea");

    expect(intent).toBe(INTENTS.VALUE_FIND);
    expect(slots.sort).toBe(SORT.PRICE_DESC);
    expect(slots.query).toBe("tea");
  });

  it("reads a budget amount", () => {
    const { intent, slots } = parseQuery("What can I buy with £15?");

    expect(intent).toBe(INTENTS.BUDGET_BASKET);
    expect(slots.budget).toBe(15);
  });

  it("asks for a number when only the word budget is given", () => {
    const { intent, slots } = parseQuery("Snacks under my budget");

    expect(intent).toBe(INTENTS.BUDGET_BASKET);
    expect(slots.budget).toBeNull();
    expect(slots.query).toBe("snacks");
  });

  it("routes recipe phrasing and exposes the dish on recipeQuery", () => {
    const { intent, slots } = parseQuery("Ingredients for jollof rice");

    expect(intent).toBe(INTENTS.RECIPE_INGREDIENTS);
    expect(slots.recipeQuery).toBe("jollof rice");
    expect(slots.query).toBe("jollof rice");
  });

  it("gives an occasion for a party so the reply never says 'undefined'", () => {
    const { intent, slots } = parseQuery("snacks for a party");

    expect(intent).toBe(INTENTS.BUNDLE);
    expect(slots.occasion).toBe("a party");
    expect(slots.query).toBe("snacks");
  });

  it("reads the guest count as the occasion", () => {
    const { intent, slots } = parseQuery("Party snacks for 6 people");

    expect(intent).toBe(INTENTS.BUNDLE);
    expect(slots.occasion).toContain("6 people");
  });

  it("treats a product modifier as a search, not an occasion", () => {
    const { intent, slots } = parseQuery("Show me birthday cake");

    expect(intent).toBe(INTENTS.PRODUCT_SEARCH);
    expect(slots.occasion).toBeNull();
    expect(slots.query).toBe("birthday cake");
  });

  it("returns unclear for anything it cannot read", () => {
    const { intent, slots, confidence } = parseQuery("hello");

    expect(intent).toBe(INTENTS.UNCLEAR);
    expect(confidence).toBeLessThan(0.5);
    expect(slots.query).toBe("");
    expect(slots.categories).toEqual([]);
  });

  it("never throws, whatever it is handed", () => {
    for (const input of [null, undefined, 42, {}, [], "", "!!!"]) {
      const { intent, slots } = parseQuery(input);
      expect(Object.values(INTENTS)).toContain(intent);
      expect(Array.isArray(slots.categories)).toBe(true);
    }
  });
});

describe("parseQuery - price slots", () => {
  it("reads a range as both bounds", () => {
    const { slots } = parseQuery("Rice between £5 and £15");

    expect(slots.minPrice).toBe(5);
    expect(slots.maxPrice).toBe(15);
    expect(slots.query).toBe("rice");
  });

  it("reads 'under' as a ceiling only", () => {
    const { slots } = parseQuery("rice under £10");

    expect(slots.minPrice).toBeNull();
    expect(slots.maxPrice).toBe(10);
  });

  it("reads 'over' as a floor only", () => {
    const { slots } = parseQuery("rice over £5");

    expect(slots.minPrice).toBe(5);
    expect(slots.maxPrice).toBeNull();
  });

  it("never mistakes people counts for money", () => {
    const { slots } = parseQuery("snacks for 6 people");

    expect(slots.minPrice).toBeNull();
    expect(slots.maxPrice).toBeNull();
    expect(slots.budget).toBeNull();
  });

  it("ignores numbers without a currency marker", () => {
    const { intent, slots } = parseQuery("between 5 and 10");

    expect(slots.minPrice).toBeNull();
    expect(slots.maxPrice).toBeNull();
    expect(slots.query).toBe("");
    expect(intent).toBe(INTENTS.UNCLEAR);
  });

  it("keeps sizes like 5kg in the keyword", () => {
    const { slots } = parseQuery("show me 5kg rice");

    expect(slots.query).toBe("5kg rice");
  });

  it("counts a quantity without letting it into the keyword", () => {
    const { slots } = parseQuery("2 bags of rice please");

    expect(slots.quantity).toBe(2);
    expect(slots.query).toBe("rice");
  });
});

describe("parseQuery - slot contract", () => {
  it("always returns categories as an array of canonical names", () => {
    expect(parseQuery("show me veg").slots.categories).toEqual(["Vegetables"]);
    expect(parseQuery("show me snacks").slots.categories).toEqual(["Snacks"]);
    expect(parseQuery("hello").slots.categories).toEqual([]);
  });

  it("only ever emits sorts the searchProducts tool accepts", () => {
    const messages = [
      "Show me rice.",
      "Find cheap cooking oil",
      "most expensive tea",
      "Do you have rice in stock?",
      "What can I buy with £15?",
      "hello",
      "",
    ];

    for (const message of messages) {
      const { slots } = parseQuery(message);
      expect(Object.values(SORT)).toContain(slots.sort);
    }
  });

  it("keeps the keyword inside the tool's 120 character limit", () => {
    const word = "tomato ";
    const { slots } = parseQuery(`show me ${word.repeat(80)}`);

    expect(slots.query.length).toBeLessThanOrEqual(120);
    expect(slots.query.split(" ").every((token) => token === "tomato")).toBe(true);
  });

  it("defaults every slot the controller echoes back", () => {
    const { slots } = parseQuery("");

    expect(slots).toEqual({
      query: "",
      categories: [],
      occasion: null,
      minPrice: null,
      maxPrice: null,
      budget: null,
      quantity: null,
      inStock: false,
      sort: SORT.RELEVANCE,
      recipeQuery: null,
    });
  });
});
