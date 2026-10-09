// The searchProducts tool.
//
// Contract, in order:
//   1. Validate the argument bag before anything touches Mongo. Unknown
//      parameters, bad types and impossible ranges are refused outright.
//   2. Build the filter here, from a whitelist of fields, with every shopper
//      word escaped so a regex metacharacter stays literal text.
//   3. Return only grounded projections, re-read from Mongo before they are
//      handed back, so a reply can never quote a product the catalogue does
//      not contain.
//
// A category is only ever filtered on after it has been checked against the
// real distinct list; a category nobody can verify is reported back as a note
// together with the categories that do exist.

import ProductModel from "../../../models/Product.js";
import { groundProduct, verifyGroundedProducts, assertGrounded } from "./grounding.js";

export const TOOL_NAME = "searchProducts";

export const AVAILABILITY = Object.freeze({
  ALL: "all",
  IN_STOCK: "in_stock",
  OUT_OF_STOCK: "out_of_stock",
});

export const SORT = Object.freeze({
  RELEVANCE: "relevance",
  PRICE_ASC: "price_asc",
  PRICE_DESC: "price_desc",
  NAME_ASC: "name_asc",
  NAME_DESC: "name_desc",
});

const ALLOWED_PARAMS = [
  "keyword",
  "category",
  "minPrice",
  "maxPrice",
  "availability",
  "sort",
  "page",
  "pageSize",
];

const MAX_KEYWORD_LENGTH = 120;
const MAX_CATEGORY_LENGTH = 60;
const MAX_CATEGORIES = 10;
const MAX_PAGE = 1000;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 24;

// Shoppers type the aisle name they would use out loud ("veggies", "oil");
// the catalogue stores the merchant's own spelling. Aliases are expanded
// before verification, so an alias can only ever land on a real category.
const CATEGORY_ALIASES = Object.freeze({
  veg: "Vegetables",
  veggie: "Vegetables",
  veggies: "Vegetables",
  vegetable: "Vegetables",
  vegetables: "Vegetables",
  fruit: "Fruits",
  fruits: "Fruits",
  greens: "Vegetables",
  milk: "Dairy",
  dairy: "Dairy",
  chicken: "Poultry",
  poultry: "Poultry",
  beef: "Meat",
  pork: "Meat",
  lamb: "Meat",
  meat: "Meat",
  seafood: "Fish",
  fish: "Fish",
  snack: "Snacks",
  snacks: "Snacks",
  crisps: "Snacks",
  chips: "Snacks",
  drink: "Beverages",
  drinks: "Beverages",
  beverages: "Beverages",
  oil: "Cooking Oil",
  oils: "Cooking Oil",
  "cooking oil": "Cooking Oil",
  spice: "Spices",
  spices: "Spices",
  herbs: "Spices",
  bread: "Bakery",
  bakery: "Bakery",
  grocery: "Pantry",
  groceries: "Pantry",
  pantry: "Pantry",
  staples: "Pantry",
  household: "Household",
  cleaning: "Household",
  dessert: "Dessert",
  sweets: "Dessert",
  soup: "Soup",
});

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const tokenPattern = (token) => new RegExp(escapeRegex(token), "i");

/**
 * Split a keyword into searchable tokens on whitespace only. Punctuation stays
 * attached to its token, so `rice" || {}` keeps its metacharacters and is
 * escaped as literal text instead of being silently discarded.
 */
function keywordTokens(keyword) {
  return String(keyword)
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * Validate a raw argument bag without touching the database.
 *
 * @param {unknown} rawArgs
 * @returns {{ok: boolean, errors: Array<{field: string, message: string}>, value: object|null}}
 */
export function validateSearchArgs(rawArgs) {
  const errors = [];

  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    return {
      ok: false,
      errors: [{ field: "(root)", message: "Arguments must be an object." }],
      value: null,
    };
  }

  const keys = Object.keys(rawArgs);
  if (!keys.length) {
    errors.push({
      field: "(root)",
      message: "Provide at least one search parameter: keyword, category, price or availability.",
    });
    return { ok: false, errors, value: null };
  }

  for (const key of keys) {
    if (!ALLOWED_PARAMS.includes(key)) {
      errors.push({
        field: key,
        message: `Unknown parameter "${key}". Allowed: ${ALLOWED_PARAMS.join(", ")}.`,
      });
    }
  }

  const value = {
    keyword: "",
    category: [],
    minPrice: null,
    maxPrice: null,
    availability: AVAILABILITY.ALL,
    sort: SORT.RELEVANCE,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  const rawKeyword = rawArgs.keyword;
  if (rawKeyword !== undefined && rawKeyword !== null && rawKeyword !== "") {
    if (typeof rawKeyword !== "string") {
      errors.push({ field: "keyword", message: "keyword must be a string." });
    } else if (rawKeyword.length > MAX_KEYWORD_LENGTH) {
      errors.push({
        field: "keyword",
        message: `keyword must be ${MAX_KEYWORD_LENGTH} characters or fewer.`,
      });
    } else {
      value.keyword = rawKeyword.trim();
    }
  }

  const rawCategory = rawArgs.category;
  if (rawCategory !== undefined && rawCategory !== null && rawCategory !== "") {
    const entries = Array.isArray(rawCategory) ? rawCategory : [rawCategory];
    if (!entries.length) {
      errors.push({ field: "category", message: "category must include at least one value." });
    } else if (entries.length > MAX_CATEGORIES) {
      errors.push({ field: "category", message: `category accepts at most ${MAX_CATEGORIES} values.` });
    } else {
      for (const entry of entries) {
        if (typeof entry !== "string") {
          errors.push({ field: "category", message: "category must be a string or an array of strings." });
          break;
        }
        const trimmed = entry.trim();
        if (!trimmed) {
          errors.push({ field: "category", message: "category values must not be blank." });
          break;
        }
        if (trimmed.length > MAX_CATEGORY_LENGTH) {
          errors.push({
            field: "category",
            message: `category values must be ${MAX_CATEGORY_LENGTH} characters or fewer.`,
          });
          break;
        }
        value.category.push(trimmed);
      }
    }
  }

  for (const key of ["minPrice", "maxPrice"]) {
    const raw = rawArgs[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const amount = Number(raw);
    if (typeof raw === "boolean" || !Number.isFinite(amount) || amount < 0) {
      errors.push({ field: key, message: `${key} must be a number of 0 or more.` });
    } else {
      value[key] = amount;
    }
  }
  if (value.minPrice !== null && value.maxPrice !== null && value.minPrice > value.maxPrice) {
    errors.push({ field: "minPrice", message: "minPrice must not be greater than maxPrice." });
  }

  const rawAvailability = rawArgs.availability;
  if (rawAvailability !== undefined && rawAvailability !== null && rawAvailability !== "") {
    if (!Object.values(AVAILABILITY).includes(rawAvailability)) {
      errors.push({
        field: "availability",
        message: `availability must be one of: ${Object.values(AVAILABILITY).join(", ")}.`,
      });
    } else {
      value.availability = rawAvailability;
    }
  }

  const rawSort = rawArgs.sort;
  if (rawSort !== undefined && rawSort !== null && rawSort !== "") {
    if (!Object.values(SORT).includes(rawSort)) {
      errors.push({ field: "sort", message: `sort must be one of: ${Object.values(SORT).join(", ")}.` });
    } else {
      value.sort = rawSort;
    }
  }

  for (const [key, max] of [
    ["page", MAX_PAGE],
    ["pageSize", MAX_PAGE_SIZE],
  ]) {
    const raw = rawArgs[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const amount = Number(raw);
    if (typeof raw === "boolean" || !Number.isInteger(amount) || amount < 1 || amount > max) {
      errors.push({ field: key, message: `${key} must be a whole number between 1 and ${max}.` });
    } else {
      value[key] = amount;
    }
  }

  return { ok: errors.length === 0, errors, value: errors.length ? null : value };
}

/** Cheapest and dearest item plus the size of the catalogue, read live. */
async function readCatalog(Model) {
  const [min, max, productCount] = await Promise.all([
    Model.findOne({}, { price: 1 }).sort({ price: 1 }).lean(),
    Model.findOne({}, { price: 1 }).sort({ price: -1 }).lean(),
    Model.countDocuments({}),
  ]);
  return {
    minPrice: min?.price ?? null,
    maxPrice: max?.price ?? null,
    productCount,
  };
}

/**
 * Resolve the requested categories against the ones the catalogue really has.
 * Returns the verified names to filter on and the unverified ones to report.
 */
async function resolveCategories(requested, Model) {
  const distinct = await Model.distinct("category");
  const real = [...new Set(distinct.filter((entry) => typeof entry === "string" && entry.trim()))]
    .sort((a, b) => a.localeCompare(b));
  const byLowerName = new Map(real.map((entry) => [entry.toLowerCase(), entry]));

  const verified = [];
  const unverified = [];

  for (const category of requested) {
    const alias = CATEGORY_ALIASES[category.toLowerCase()] ?? category;
    const canonical = byLowerName.get(alias.toLowerCase());
    if (canonical) {
      if (!verified.includes(canonical)) verified.push(canonical);
    } else if (!unverified.includes(category)) {
      unverified.push(category);
    }
  }

  return { verified, unverified, availableCategories: real };
}

/**
 * Relevance ranking. An exact name wins, then a name that starts with the
 * phrase, then a word-level hit, then a plain substring, then the softer
 * matches in the description or brand. Ties break on name then _id so the
 * same query always walks the same pages.
 */
function relevanceScore(doc, tokens) {
  if (!tokens.length) return 0;
  const name = String(doc.name ?? "").toLowerCase();
  const brand = String(doc.brand ?? "").toLowerCase();
  const description = String(doc.description ?? "").toLowerCase();
  const phrase = tokens.join(" ");

  if (name === phrase) return 100;

  let best = 0;
  for (const token of tokens) {
    let score = 0;
    if (name === token) score = 95;
    else if (name.startsWith(token)) score = 85;
    else if (name.split(/\s+/).includes(token)) score = 75;
    else if (name.includes(token)) score = 65;
    else if (brand.includes(token)) score = 50;
    else if (description.includes(token)) score = 40;
    else continue;
    best = Math.max(best, score);
  }
  return best;
}

function sortDocs(docs, sort, tokens) {
  const byName = (a, b) =>
    String(a.name ?? "").localeCompare(String(b.name ?? "")) ||
    String(a._id).localeCompare(String(b._id));

  const sorted = [...docs];

  if (sort === SORT.PRICE_ASC || sort === SORT.PRICE_DESC) {
    const direction = sort === SORT.PRICE_ASC ? 1 : -1;
    sorted.sort(
      (a, b) => direction * (Number(a.price ?? 0) - Number(b.price ?? 0)) || byName(a, b)
    );
    return sorted;
  }

  if (sort === SORT.NAME_ASC || sort === SORT.NAME_DESC) {
    const direction = sort === SORT.NAME_ASC ? 1 : -1;
    sorted.sort((a, b) => direction * byName(a, b));
    return sorted;
  }

  // Relevance: score first, then fall back to a stable, name-based order so
  // paging never reshuffles between requests.
  sorted.sort(
    (a, b) => relevanceScore(b, tokens) - relevanceScore(a, tokens) || byName(a, b)
  );
  return sorted;
}

/**
 * Search the catalogue.
 *
 * @param {object} args the raw argument bag (see validateSearchArgs)
 * @param {{Product?: object, verify?: boolean}} [options]
 * @returns {Promise<object>} a result envelope; never throws for bad input
 */
export async function searchProducts(args, options = {}) {
  const validation = validateSearchArgs(args);
  if (!validation.ok) {
    return { ok: false, status: "invalid_arguments", errors: validation.errors, results: [] };
  }

  const Model = options.Product ?? ProductModel;
  const verify = options.verify !== false;
  const value = validation.value;
  const notes = [];

  let verifiedCategories = [];
  let availableCategories;
  if (value.category.length) {
    const resolved = await resolveCategories(value.category, Model);
    verifiedCategories = resolved.verified;
    if (resolved.unverified.length) {
      notes.push("category-unverified");
      availableCategories = resolved.availableCategories;
    }
  }

  // Every whitespace-separated keyword token must appear somewhere in the name,
  // description or brand (an AND phrase), and each token is regex-escaped so
  // punctuation stays literal text. The keyword phrase sits beside the verified
  // category in a $or - naming an aisle and a product at once means "either" -
  // while a category that could not be verified contributes no group at all, so
  // it can never widen the filter on its own.
  const tokens = value.keyword ? keywordTokens(value.keyword) : [];

  const groups = [];
  if (verifiedCategories.length) groups.push({ category: { $in: verifiedCategories } });
  if (tokens.length) {
    groups.push({
      $and: tokens.map((token) => ({
        $or: [
          { name: tokenPattern(token) },
          { description: tokenPattern(token) },
          { brand: tokenPattern(token) },
        ],
      })),
    });
  }

  const filter = {};
  if (groups.length) filter.$or = groups;

  if (value.minPrice !== null || value.maxPrice !== null) {
    const price = {};
    if (value.minPrice !== null) price.$gte = value.minPrice;
    if (value.maxPrice !== null) price.$lte = value.maxPrice;
    filter.price = price;
  }

  if (value.availability === AVAILABILITY.IN_STOCK) {
    filter.countInStock = { $gt: 0 };
  } else if (value.availability === AVAILABILITY.OUT_OF_STOCK) {
    filter.countInStock = { $lte: 0 };
  }

  const hasCriteria =
    groups.length > 0 ||
    filter.price !== undefined ||
    value.availability !== AVAILABILITY.ALL;

  const catalog = await readCatalog(Model);

  // An empty filter would return the whole shop, which is never the answer to
  // "search for nothing"; say so instead of pretending everything matched.
  if (!hasCriteria) {
    if (!notes.includes("no_search_criteria")) notes.push("no_search_criteria");
    return {
      ok: true,
      status: "no_results",
      results: [],
      pagination: {
        page: value.page,
        pageSize: value.pageSize,
        total: 0,
        totalPages: 0,
        hasMore: false,
      },
      catalog,
      notes,
      ...(availableCategories ? { availableCategories } : {}),
    };
  }

  const docs = await Model.find(filter).lean();
  const sorted = sortDocs(docs, value.sort, tokens);

  const total = sorted.length;
  const totalPages = total ? Math.ceil(total / value.pageSize) : 0;
  const start = (value.page - 1) * value.pageSize;
  const pageDocs = sorted.slice(start, start + value.pageSize);

  const results = pageDocs.map((doc) => groundProduct(doc));
  if (verify && results.length) {
    assertGrounded(await verifyGroundedProducts(results, Model), TOOL_NAME);
  }

  return {
    ok: true,
    status: results.length ? "ok" : "no_results",
    results,
    pagination: {
      page: value.page,
      pageSize: value.pageSize,
      total,
      totalPages,
      hasMore: value.page < totalPages,
    },
    catalog,
    notes,
    ...(availableCategories ? { availableCategories } : {}),
  };
}

/** JSON-schema style description of the tool, shared with the AI registry. */
export const SEARCH_PRODUCTS_TOOL = Object.freeze({
  name: TOOL_NAME,
  description:
    "Search the real grocery catalogue by free text, category, price range and stock. " +
    "Only ever quotes products that exist in the database; an empty search returns nothing rather than everything.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      keyword: {
        type: "string",
        maxLength: MAX_KEYWORD_LENGTH,
        description: "Free text matched against product names, descriptions and brands.",
      },
      category: {
        type: ["string", "array"],
        items: { type: "string", maxLength: MAX_CATEGORY_LENGTH },
        maxItems: MAX_CATEGORIES,
        description: "Catalogue category name(s). Unknown categories match nothing and are reported back.",
      },
      minPrice: { type: "number", minimum: 0, description: "Inclusive lower price bound in GBP." },
      maxPrice: { type: "number", minimum: 0, description: "Inclusive upper price bound in GBP." },
      availability: {
        type: "string",
        enum: Object.values(AVAILABILITY),
        default: AVAILABILITY.ALL,
        description: "Restrict to items that can be bought now, or to sold-out items.",
      },
      sort: {
        type: "string",
        enum: Object.values(SORT),
        default: SORT.RELEVANCE,
        description: "Ordering of the results.",
      },
      page: { type: "integer", minimum: 1, maximum: MAX_PAGE, default: 1 },
      pageSize: { type: "integer", minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
    },
  },
  runner: async (args) => searchProducts(args),
});
