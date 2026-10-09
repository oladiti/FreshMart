import {
  createMatcher,
  matchIngredient,
  matchRecipe,
} from "../../../services/assistant/recipeMatch.js";

const catalogue = [
  {
    _id: "p1",
    name: "Rice 5kg",
    price: 12.99,
    category: "Pantry",
    brand: "Tropical",
    description: "Long grain rice bag.",
  },
  { _id: "p2", name: "Onions", price: 1.8, category: "Vegetables" },
  {
    _id: "p3",
    name: "Chopped Tomatoes",
    price: 0.9,
    category: "Pantry",
    description: "Tinned tomatoes for stews.",
  },
  { _id: "p4", name: "Plum Tomatoes", price: 1.1, category: "Pantry" },
  { _id: "p5", name: "Cooking Oil 1Ltr", price: 3.49, category: "Cooking Oil" },
];

const context = createMatcher(catalogue).context;

const isFromCatalogue = (product) => catalogue.some((entry) => entry === product);

describe("createMatcher", () => {
  it("builds a context both match functions can share", () => {
    expect(context).toBeTruthy();

    const found = matchIngredient("rice", catalogue, context);
    expect(found.matches[0].product).toBe(catalogue[0]);
  });

  it("still matches when no context is supplied", () => {
    const found = matchIngredient("onions", catalogue, undefined);
    expect(found.matches[0].product).toBe(catalogue[1]);
  });

  it("tolerates an empty catalogue", () => {
    const { context: empty } = createMatcher([]);
    expect(matchRecipe({ ingredients: ["rice"] }, [], empty).matched).toEqual([]);
    expect(createMatcher(null).products).toEqual([]);
  });
});

describe("matchIngredient", () => {
  it("matches an exact product name with high confidence", () => {
    const { matches } = matchIngredient("onions", catalogue, context);

    expect(matches).toHaveLength(1);
    expect(matches[0].product).toBe(catalogue[1]);
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(matches[0].ambiguous).toBe(false);
  });

  it("strips quantities and units before matching", () => {
    const { matches, ignored } = matchIngredient("2 cups of long grain rice", catalogue, context);

    expect(matches[0].product).toBe(catalogue[0]);
    expect(ignored).toEqual(expect.arrayContaining(["2", "cups", "of"]));
  });

  it("reports nothing rather than guessing when nothing clears the floor", () => {
    const { matches } = matchIngredient("Unobtainium", catalogue, context);
    expect(matches).toEqual([]);
  });

  it("never returns a product the caller did not pass in", () => {
    const inputs = ["rice", "tomato", "oil", "salt", "2 onions"];
    for (const input of inputs) {
      const { matches } = matchIngredient(input, catalogue, context);
      for (const match of matches) {
        expect(isFromCatalogue(match.product)).toBe(true);
      }
    }
  });

  it("flags ambiguity when two catalogue rows are effectively tied", () => {
    const { matches } = matchIngredient("tomato", catalogue, context);

    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches[0].ambiguous).toBe(true);
    expect(matches[1].ambiguous).toBe(true);
    expect(matches[0].product).not.toBe(matches[1].product);
  });

  it("ranks a name hit above a description mention", () => {
    const { matches } = matchIngredient("tinned tomatoes", catalogue, context);
    expect(matches[0].product).toBe(catalogue[2]);
  });

  it("returns an empty match set for a line that is only filler", () => {
    const { matches, ignored } = matchIngredient("2 cups", catalogue, context);
    expect(matches).toEqual([]);
    expect(ignored.length).toBeGreaterThan(0);
  });

  it("never throws on odd ingredient input", () => {
    for (const input of [null, undefined, 12, {}, []]) {
      expect(() => matchIngredient(input, catalogue, context)).not.toThrow();
    }
  });
});

describe("matchRecipe", () => {
  const recipe = {
    title: "Test Jollof",
    ingredients: ["Rice", "Onions", "Tinned tomatoes", "Unobtainium"],
  };

  it("splits ingredients into matched and unmatched lines", () => {
    const result = matchRecipe(recipe, catalogue, context);

    expect(result.recipe).toBe(recipe);
    expect(result.matched).toHaveLength(3);
    expect(result.unmatched).toEqual([{ ingredient: "Unobtainium" }]);
    expect(result.duplicates).toEqual([]);
  });

  it("keeps every matched product as the caller's own document", () => {
    const result = matchRecipe(recipe, catalogue, context);

    for (const line of result.matched) {
      expect(isFromCatalogue(line.matches[0].product)).toBe(true);
    }
    for (const product of result.products) {
      expect(isFromCatalogue(product)).toBe(true);
    }
  });

  it("reports a repeat ingredient as a duplicate instead of counting it twice", () => {
    const result = matchRecipe(
      { title: "Soup", ingredients: ["Rice", "Onions", "rice"] },
      catalogue,
      context
    );

    expect(result.matched).toHaveLength(2);
    expect(result.duplicates).toEqual([
      { ingredient: "rice", duplicateOf: "Rice" },
    ]);
    expect(result.products).toHaveLength(2);
  });

  it("collects alternatives beside the primary match", () => {
    const result = matchRecipe({ title: "Soup", ingredients: ["tomato"] }, catalogue, context);

    expect(result.products).toHaveLength(1);
    expect(result.allProducts.length).toBeGreaterThan(result.products.length);
    // The primary comes first, and every entry is still a real document.
    expect(result.allProducts[0]).toBe(result.matched[0].matches[0].product);
    for (const product of result.allProducts) {
      expect(isFromCatalogue(product)).toBe(true);
    }
  });

  it("never lists one product twice in the basket view", () => {
    const result = matchRecipe(
      { title: "Soup", ingredients: ["Rice", "long grain rice", "Onions"] },
      catalogue,
      context
    );

    const ids = result.products.map((product) => String(product._id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.duplicates).toHaveLength(1);
  });

  it("returns empty shapes for a recipe with no usable ingredients", () => {
    for (const recipeInput of [{}, { ingredients: null }, { ingredients: ["  ", 7] }]) {
      const result = matchRecipe(recipeInput, catalogue, context);
      expect(result.matched).toEqual([]);
      expect(result.unmatched).toEqual([]);
      expect(result.duplicates).toEqual([]);
      expect(result.products).toEqual([]);
      expect(result.allProducts).toEqual([]);
    }
  });

  it("never throws when handed a catalogue without a matcher context", () => {
    expect(() => matchRecipe(recipe, catalogue, undefined)).not.toThrow();
    expect(() => matchRecipe(recipe, [])).not.toThrow();
  });
});
