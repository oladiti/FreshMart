// AI product tools.
//
// Product data reaches the model exclusively through the grounding layer from
// services/assistant: every result is a whitelisted projection of a real Mongo
// document, verified against the database before it is returned. The assistant
// can therefore never quote a fabricated product, price or stock level.

import ProductModel from "../../../models/Product.js";
import { groundProduct, verifyGroundedProducts, assertGrounded } from "../../assistant/tools/grounding.js";
import {
  searchProducts,
  SEARCH_PRODUCTS_TOOL,
} from "../../assistant/tools/searchProducts.js";
import { getProductById } from "../../assistant/tools/getProductById.js";
import { findRelatedProducts } from "../../assistant/tools/findRelatedProducts.js";
import { findCheaperAlternative } from "../../assistant/tools/findCheaperAlternative.js";
import { checkProductStock } from "../../assistant/tools/checkProductStock.js";
import { asString, asPositiveInt, asBoolean, ensurePlainObject } from "./helpers.js";

/**
 * Validate raw args then run a grounded query, verifying the results against
 * Mongo. Shared by the small list-style tools (category, featured, new, deals).
 */
async function runGroundedQuery(rawArgs, { extract, Product = ProductModel }) {
  const errors = [];
  ensurePlainObject(rawArgs, errors);

  const category = asString(rawArgs?.category, "category", errors, { max: 60 });
  const limit = asPositiveInt(rawArgs?.limit, "limit", errors, {
    fallback: 10,
    max: 20,
  });
  const inStock = asBoolean(rawArgs?.inStock, false);

  if (errors.length) return { ok: false, status: "invalid_arguments", errors, results: [] };

  let docs;
  try {
    const filter = { ...(category ? { category } : {}), ...(inStock ? { countInStock: { $gt: 0 } } : {}) };
    docs = await Product.find(filter).sort({ createdAt: -1, _id: 1 }).limit(limit).lean();
  } catch (error) {
    return { ok: false, status: "tool_error", errors: [{ field: "(root)", message: "The product lookup failed. Try again." }], results: [] };
  }

  const results = docs.map(groundProduct);
  if (results.length) {
    assertGrounded(await verifyGroundedProducts(results, Product), extract);
  }

  return {
    ok: true,
    status: results.length ? "ok" : "no_results",
    results,
    args: { category, limit, inStock },
    notes: results.length ? [] : ["no_results"],
  };
}

const listTool = (name, description, extract) => ({
  name,
  description,
  requiresAuth: false,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      category: {
        type: "string",
        maxLength: 60,
        description: "An existing catalogue category name. Unknown values match nothing.",
      },
      limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
      inStock: { type: "boolean", default: false, description: "Only include items you can buy now." },
    },
  },
  runner: async (_ctx, rawArgs) =>
    runGroundedQuery(rawArgs, { extract, Product: ProductModel }),
});

export const GET_PRODUCTS_BY_CATEGORY_TOOL = listTool(
  "getProductsByCategory",
  "List real products in a store category. Only quotes products that exist in the database; if nothing matches, say so.",
  "getProductsByCategory"
);
export const GET_FEATURED_PRODUCTS_TOOL = listTool(
  "getFeaturedProducts",
  "List products the store marks as featured. Quotes real catalogue data only.",
  "getFeaturedProducts"
);
export const GET_NEW_PRODUCTS_TOOL = listTool(
  "getNewProducts",
  "List products the store marks as new arrivals. Quotes real catalogue data only.",
  "getNewProducts"
);
export const GET_WEEKLY_DEALS_TOOL = listTool(
  "getWeeklyDeals",
  "List products currently on weekly deal. Quotes real prices and stock from the database only.",
  "getWeeklyDeals"
);

function productResult(overflow = {}) {
  return { ok: true, status: "ok", results: [], notes: [], ...overflow };
}

export const AI_PRODUCT_TOOLS = [
  {
    name: "searchProducts",
    description: SEARCH_PRODUCTS_TOOL.description,
    requiresAuth: false,
    requiresAdmin: false,
    parameters: SEARCH_PRODUCTS_TOOL.parameters,
    runner: async (_ctx, rawArgs) => {
      const result = await searchProducts(rawArgs);
      return { ok: result.ok, status: result.status, results: result.results, notes: result.notes || [] };
    },
  },
  {
    name: "getProductById",
    description: "Fetch one product by its real MongoDB _id. Never invents product data.",
    requiresAuth: false,
    requiresAdmin: false,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        productId: { type: "string", description: "Real MongoDB _id of the product." },
      },
      required: ["productId"],
    },
    runner: async (_ctx, rawArgs) => {
      const errors = [];
      const productId = asString(rawArgs?.productId, "productId", errors, { required: true });
      if (errors.length) return { ok: false, status: "invalid_arguments", errors, results: [] };
      const result = await getProductById({ productId, verify: true });
      return { ok: result.ok, status: result.status, results: result.results, notes: result.notes || [] };
    },
  },
  {
    name: "findRelatedProducts",
    description: "Find real products related to a given product (same category or similar); never the target itself.",
    requiresAuth: false,
    requiresAdmin: false,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        productId: { type: "string", description: "Real MongoDB _id of the target product." },
        category: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
      required: ["productId"],
    },
    runner: async (_ctx, rawArgs) => {
      const result = await findRelatedProducts(rawArgs);
      return { ok: result.ok, status: result.status, results: result.results, notes: result.notes || [] };
    },
  },
  {
    name: "findCheaperAlternative",
    description:
      "Find real cheaper alternatives to a product (lower price from actual catalogue data, same category unless told otherwise). Never invent an alternative: if none exists, say so.",
    requiresAuth: false,
    requiresAdmin: false,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        productId: { type: "string", description: "Real MongoDB _id of the product to find alternatives to." },
        maxPrice: { type: "number", minimum: 0, description: "Optional additional ceiling lower than the target's price." },
        category: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
      required: ["productId"],
    },
    runner: async (_ctx, rawArgs) => {
      const result = await findCheaperAlternative(rawArgs);
      return { ok: result.ok, status: result.status, results: result.results, notes: result.notes || [] };
    },
  },
  {
    name: "checkProductStock",
    description: "Check the real stock level of a product by its MongoDB _id.",
    requiresAuth: false,
    requiresAdmin: false,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        productId: { type: "string" },
      },
      required: ["productId"],
    },
    runner: async (_ctx, rawArgs) => {
      const result = await checkProductStock(rawArgs);
      return { ok: result.ok, status: result.status, results: result.results, notes: result.notes || [] };
    },
  },
  GET_PRODUCTS_BY_CATEGORY_TOOL,
  GET_FEATURED_PRODUCTS_TOOL,
  GET_NEW_PRODUCTS_TOOL,
  GET_WEEKLY_DEALS_TOOL,
];

export const PRODUCT_TOOL_NAMES = new Set(
  AI_PRODUCT_TOOLS.map((tool) => tool.name)
);