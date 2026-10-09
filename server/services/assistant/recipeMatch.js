// Ingredient -> product matching for the assistant.
//
// Recipes store free-text ingredient lines ("2 cups long grain rice") while the
// catalogue stores Product documents, so something has to bridge the two. This
// module scores every candidate against a line and reports the result honestly:
// a confidence between 0 and 1, an ambiguity flag when two catalogue rows are
// effectively tied, and no match at all when nothing clears the floor.
//
// It never invents a product, never mutates the documents it is given, and
// never returns anything that is not a document the caller passed in - callers
// run every result through the grounding layer before quoting it.

const MATCH_FLOOR = 0.5;
const AMBIGUITY_MARGIN = 0.06;
const MAX_MATCHES = 6;

/** Words that carry no product meaning on their own. */
const INGREDIENT_STOP = new Set([
  "of", "and", "or", "a", "an", "the", "to", "taste", "plus", "for", "in",
  "with", "as", "is", "it", "some", "fresh",
]);

/** Measurements stripped before matching; they describe amounts, not goods. */
const UNITS = new Set([
  "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon",
  "teaspoons", "pinch", "pinches", "gram", "grams", "kilo", "kilos",
  "kilogram", "kilograms", "litre", "litres", "liter", "liters", "ltr",
  "ltrs", "can", "cans", "tin", "tins", "pack", "packs", "packet",
  "packets", "bag", "bags", "bottle", "bottles", "box", "boxes", "piece",
  "pieces", "unit", "units", "loaf", "loaves", "carton", "cartons", "tub",
  "tubs", "punnet", "punnets", "portion", "portions", "slice", "slices",
  "dozen", "clove", "cloves", "bunch", "bunches", "handful", "handfuls",
]);

/**
 * Naive singular form, applied to *both* sides of a comparison so "tomatoes"
 * and "tomato" meet in the middle. It only has to be consistent, never
 * linguistically correct.
 */
const singular = (word) => {
  const value = String(word).toLowerCase();
  if (value.length > 4 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 4 && value.endsWith("es")) return value.slice(0, -2);
  if (value.length > 3 && value.endsWith("s")) return value.slice(0, -1);
  return value;
};

/** Lowercase alphanumeric words in their singular form. */
function words(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular);
}

const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const round2 = (value) => Math.round(value * 100) / 100;

/** Precomputed search keys for one product document. */
function indexProduct(product) {
  return {
    product,
    name: words(product?.name),
    brand: words(product?.brand),
    category: words(product?.category),
    description: words(product?.description),
  };
}

function parseIngredient(line) {
  const raw = String(line ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const ignored = [];
  const content = [];
  for (const word of raw) {
    if (/^\d/.test(word) || UNITS.has(word) || INGREDIENT_STOP.has(word)) {
      ignored.push(word);
      continue;
    }
    content.push(singular(word));
  }

  return { content, ignored, raw };
}

/**
 * How much of the ingredient a token list accounts for. A partial token match
 * ("pepper" inside "peppercorns") counts half, so a near miss still clears the
 * floor without ever outranking a real name hit.
 */
function tokenCoverage(contentTokens, targetTokens) {
  if (!contentTokens.length || !targetTokens.length) return 0;

  const target = new Set(targetTokens);
  let hit = 0;
  for (const token of contentTokens) {
    if (target.has(token)) {
      hit += 1;
      continue;
    }
    for (const other of target) {
      const prefix =
        (token.length >= 4 && other.startsWith(token)) ||
        (other.length >= 4 && token.startsWith(other));
      if (prefix) {
        hit += 0.5;
        break;
      }
    }
  }
  return hit / contentTokens.length;
}

/** Score one product against one parsed ingredient line. */
function scoreProduct(contentTokens, entry) {
  if (!contentTokens.length) return { score: 0, matchedOn: null };

  const nameText = entry.name.join(" ");
  const phrase = contentTokens.join(" ");
  let best = 0;
  let matchedOn = null;

  if (nameText === phrase) return { score: 1, matchedOn: "name" };

  // Whole-phrase inside the name ("long grain rice" in "Long Grain Rice 5kg").
  if (nameText && new RegExp(`\\b${escapeRegExp(phrase)}\\b`).test(nameText)) {
    best = 0.97;
    matchedOn = "name";
  }

  const channels = [
    { key: "name", coverage: tokenCoverage(contentTokens, entry.name), base: 0.55, span: 0.35 },
    { key: "brand", coverage: tokenCoverage(contentTokens, entry.brand), base: 0.5, span: 0.2 },
    { key: "category", coverage: tokenCoverage(contentTokens, entry.category), base: 0.15, span: 0.5 },
    { key: "description", coverage: tokenCoverage(contentTokens, entry.description), base: 0.15, span: 0.4 },
  ];

  for (const channel of channels) {
    if (!channel.coverage) continue;
    const score = channel.base + channel.span * Math.min(1, channel.coverage);
    if (score > best) {
      best = score;
      matchedOn = channel.key;
    }
  }

  return { score: Math.min(best, 0.99), matchedOn };
}

function compareMatches(a, b) {
  return (
    b.confidence - a.confidence ||
    String(a.product?.name ?? "").localeCompare(String(b.product?.name ?? "")) ||
    String(a.product?._id ?? "").localeCompare(String(b.product?._id ?? ""))
  );
}

/**
 * Reuse the precomputed index when the caller passes back the same catalogue
 * it built the matcher from; otherwise index on the spot. Either way the
 * scores are always computed against the catalogue handed to this call.
 */
function entryFor(product, context) {
  const key =
    product && product._id !== undefined && product._id !== null
      ? String(product._id)
      : null;
  const cached = key ? context?.byId?.get(key) : null;
  if (cached && cached.product === product) return cached;
  return indexProduct(product);
}

/**
 * Precompute an index over a catalogue.
 *
 * @param {Array<object>} products lean Product documents
 * @returns {{context: object, products: Array<object>}}
 */
export function createMatcher(products) {
  const catalogue = Array.isArray(products) ? products : [];
  const byId = new Map();

  for (const product of catalogue) {
    if (!product || typeof product !== "object") continue;
    if (product._id === undefined || product._id === null) continue;
    byId.set(String(product._id), indexProduct(product));
  }

  return { context: { byId }, products: catalogue };
}

/**
 * Match one free-text ingredient line against a catalogue.
 *
 * @param {string} ingredient e.g. "2 cups long grain rice"
 * @param {Array<object>} catalogue lean Product documents
 * @param {{byId?: Map<string, object>}} [context] from createMatcher()
 * @returns {{matches: Array<{product: object, confidence: number, ambiguous: boolean, matchedOn: string|null}>, ignored: string[]}}
 */
export function matchIngredient(ingredient, catalogue, context) {
  const products = Array.isArray(catalogue) ? catalogue : [];
  const line =
    typeof ingredient === "string" ? ingredient : ingredient == null ? "" : String(ingredient);

  const { content, ignored, raw } = parseIngredient(line);
  if (!content.length) {
    // Nothing but quantities and filler - say so instead of guessing a product.
    return { matches: [], ignored: ignored.length ? ignored : raw };
  }

  const scored = [];
  for (const product of products) {
    if (!product || typeof product !== "object") continue;
    const { score, matchedOn } = scoreProduct(content, entryFor(product, context));
    if (score < MATCH_FLOOR) continue;
    scored.push({ product, confidence: round2(score), matchedOn, ambiguous: false });
  }

  scored.sort(compareMatches);
  const matches = scored.slice(0, MAX_MATCHES);

  if (matches.length > 1) {
    const cutoff = matches[0].confidence - AMBIGUITY_MARGIN;
    const tied = matches.filter((match) => match.confidence >= cutoff);
    if (tied.length > 1) {
      for (const match of tied) match.ambiguous = true;
    }
  }

  return { matches, ignored };
}

/**
 * Match a whole recipe against a catalogue.
 *
 * Each ingredient line resolves to at most one primary product. When two lines
 * land on the same product the later one is reported as a duplicate rather
 * than silently counted twice, so a basket total never double-charges.
 *
 * @param {{ingredients?: string[]}} recipe
 * @param {Array<object>} candidates lean Product documents
 * @param {{byId?: Map<string, object>}} [context] from createMatcher()
 * @returns {{recipe: object, matched: object[], unmatched: object[], duplicates: object[], products: object[], allProducts: object[]}}
 */
export function matchRecipe(recipe, candidates, context) {
  const catalogue = Array.isArray(candidates) ? candidates : [];
  const lines = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients.filter((entry) => typeof entry === "string" && entry.trim())
    : [];

  const matched = [];
  const unmatched = [];
  const duplicates = [];
  const products = [];

  const primaryByProduct = new Set();
  const primaryIngredient = new Map();
  const seenAll = new Set();
  const allProducts = [];

  const addAll = (product) => {
    if (seenAll.has(product)) return;
    seenAll.add(product);
    allProducts.push(product);
  };

  for (const line of lines) {
    const found = matchIngredient(line, catalogue, context);

    if (!found.matches.length) {
      unmatched.push({ ingredient: line });
      continue;
    }

    const primary = found.matches[0];
    if (primaryByProduct.has(primary.product)) {
      duplicates.push({
        ingredient: line,
        duplicateOf: primaryIngredient.get(primary.product) ?? line,
      });
      continue;
    }

    primaryByProduct.add(primary.product);
    primaryIngredient.set(primary.product, line);
    products.push(primary.product);
    addAll(primary.product);
    for (const alternative of found.matches.slice(1)) addAll(alternative.product);

    matched.push({
      ingredient: line,
      matches: found.matches,
      ignored: found.ignored,
    });
  }

  return {
    recipe,
    matched,
    unmatched,
    duplicates,
    products,
    allProducts,
  };
}

export default matchRecipe;
