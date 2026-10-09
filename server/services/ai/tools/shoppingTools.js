// AI shopping tools.
//
// Three grounded helpers that turn the assistant into a practical shopping
// companion: fill a basket inside a budget, find honest substitutes for a
// product, and re-propose a past order. Every product they return is grounded
// (projected from a real Mongo document and re-verified) and nothing here
// mutates the cart - reorder only proposes, and adding stays in addToCart so
// the confirmation rules still apply.

import { isValidObjectId } from "mongoose";
import ProductModel from "../../../models/Product.js";
import OrderModel from "../../../models/Order.js";
import { searchProducts } from "../../assistant/tools/searchProducts.js";
import { groundProduct, verifyGroundedProducts, assertGrounded } from "../../assistant/tools/grounding.js";
import { createMatcher, matchIngredient } from "../../assistant/recipeMatch.js";
import { buildBasket } from "../../assistant/buildBasket.js";
import { asString, asPositiveInt, asBoolean, asStringArray, ensurePlainObject } from "./helpers.js";

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const emptyBasket = (extra = {}) => ({ items: [], totalItems: 0, total: 0, missing: [], ...extra });

/* ------------------------------------------------------------------ *
 * buildBudgetBasket
 * ------------------------------------------------------------------ */

export const BUILD_BUDGET_BASKET_TOOL = {
  name: "buildBudgetBasket",
  description:
    "Fill a basket of real in-stock products that fits within a budget, using live prices. Never exceeds the budget and never invents a product.",
  requiresAuth: false,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      budget: { type: "number", minimum: 0.01, description: "The hard spending ceiling in GBP." },
      keyword: { type: "string", maxLength: 120, description: "Optional free text to steer the basket." },
      categories: {
        type: "array",
        items: { type: "string", maxLength: 60 },
        maxItems: 10,
        description: "Optional catalogue categories to draw from.",
      },
      maxPerCategory: { type: "integer", minimum: 1, maximum: 5, default: 2 },
      maxItems: { type: "integer", minimum: 1, maximum: 15, default: 8 },
    },
    required: ["budget"],
  },
  runner: async (_ctx, rawArgs) => {
    const errors = [];
    ensurePlainObject(rawArgs, errors);
    const rawBudget = rawArgs?.budget;
    const budget = Number(rawBudget);
    if (rawBudget === undefined || rawBudget === null || rawBudget === "" || !Number.isFinite(budget) || budget <= 0) {
      errors.push({ field: "budget", message: "budget must be a number greater than 0." });
    }
    const keyword = asString(rawArgs?.keyword, "keyword", errors, { max: 120 });
    const categories =
      rawArgs?.categories === undefined
        ? []
        : asStringArray(rawArgs.categories, "categories", errors, { maxItems: 10, maxLength: 60 });
    const maxPerCategory = asPositiveInt(rawArgs?.maxPerCategory, "maxPerCategory", errors, { fallback: 2, max: 5 });
    const maxItems = asPositiveInt(rawArgs?.maxItems, "maxItems", errors, { fallback: 8, max: 15 });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors, basket: null, results: [] };

    const search = await searchProducts({
      ...(keyword ? { keyword } : {}),
      ...(categories.length ? { category: categories } : {}),
      maxPrice: budget,
      availability: "in_stock",
      sort: "price_asc",
      pageSize: 50,
    });

    if (!search.ok) {
      return { ok: false, status: search.status, errors: search.errors || [], basket: null, results: [] };
    }

    // searchProducts already grounds+verifies its results, so they are safe to
    // price and place directly - re-grounding a projection would drop reviews.
    const basket = { ...buildBasket(search.results, budget, { maxPerCategory, maxItems }), kind: "budget" };

    return {
      ok: true,
      status: basket.items.length ? "ok" : "no_results",
      basket,
      results: basket.items,
      notes: basket.items.length ? [] : ["nothing_within_budget"],
    };
  },
};

/* ------------------------------------------------------------------ *
 * findSubstitutes
 * ------------------------------------------------------------------ */

export const FIND_SUBSTITUTES_TOOL = {
  name: "findSubstitutes",
  description:
    "Find real substitute products for a product: same aisle, from live catalogue data, each with the real price difference. Never invents a substitute; if none exists, says so.",
  requiresAuth: false,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      productId: { type: "string", description: "Real MongoDB _id of the product to replace." },
      maxPrice: { type: "number", minimum: 0, description: "Optional ceiling; only substitutes at or below this price." },
      includeOutOfStock: { type: "boolean", default: false },
      limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
    },
    required: ["productId"],
  },
  runner: async (_ctx, rawArgs) => {
    const errors = [];
    ensurePlainObject(rawArgs, errors);
    const productId = asString(rawArgs?.productId, "productId", errors, { required: true });
    const limit = asPositiveInt(rawArgs?.limit, "limit", errors, { fallback: 5, max: 10 });
    const includeOutOfStock = asBoolean(rawArgs?.includeOutOfStock, false);
    let ceiling = null;
    if (rawArgs?.maxPrice !== undefined && rawArgs?.maxPrice !== null && rawArgs?.maxPrice !== "") {
      const n = Number(rawArgs.maxPrice);
      if (!Number.isFinite(n) || n < 0) errors.push({ field: "maxPrice", message: "maxPrice must be a number of 0 or more." });
      else ceiling = n;
    }
    if (productId && !isValidObjectId(productId)) {
      errors.push({ field: "productId", message: "productId must be a real MongoDB _id." });
    }
    if (errors.length) return { ok: false, status: "invalid_arguments", errors, recommendations: [], results: [] };

    let target;
    try {
      target = await ProductModel.findById(productId).lean();
    } catch (error) {
      target = null;
    }
    if (!target) {
      return { ok: true, status: "not_found", target: null, recommendations: [], results: [], notes: ["product_not_found"] };
    }

    const targetPrice = Number(target.price || 0);
    const filter = { _id: { $ne: target._id } };
    if (!includeOutOfStock) filter.countInStock = { $gt: 0 };
    if (ceiling !== null) filter.price = { $lte: ceiling };

    if (typeof target.category === "string" && target.category) {
      filter.category = target.category;
    } else {
      const tokens = String(target.name || "")
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length > 2);
      if (!tokens.length) {
        return { ok: true, status: "no_results", target: groundProduct(target), recommendations: [], results: [], notes: ["no_substitutes_found"] };
      }
      filter.$and = tokens.map((token) => ({
        $or: [
          { name: new RegExp(escapeRegex(token), "i") },
          { description: new RegExp(escapeRegex(token), "i") },
        ],
      }));
    }

    const docs = await ProductModel.find(filter).sort({ price: 1, _id: 1 }).limit(limit).lean();
    const results = docs.map(groundProduct);
    if (results.length) assertGrounded(await verifyGroundedProducts(results, ProductModel), "findSubstitutes");

    const recommendations = results.map((product) => {
      const delta = Number((Number(product.price || 0) - targetPrice).toFixed(2));
      const where = product.category ? ` in ${product.category}` : "";
      const reason =
        delta < 0
          ? `£${Math.abs(delta).toFixed(2)} cheaper${where}`
          : delta > 0
            ? `£${delta.toFixed(2)} more${where}`
            : `Same price${where}`;
      return { product, reason, priceDelta: delta };
    });

    return {
      ok: true,
      status: results.length ? "ok" : "no_results",
      target: groundProduct(target),
      recommendations,
      results,
      notes: results.length ? [] : ["no_substitutes_found"],
    };
  },
};

/* ------------------------------------------------------------------ *
 * buildReorderList
 * ------------------------------------------------------------------ */

export const BUILD_REORDER_LIST_TOOL = {
  name: "buildReorderList",
  description:
    "Build a proposed basket from the signed-in shopper's own past order (by orderId, or their most recent order). Only proposes - it maps each past item to a real in-stock product and reports anything we no longer stock.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      orderId: { type: "string", description: "Optional real order _id; defaults to the shopper's most recent order." },
      limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
      onlyInStock: { type: "boolean", default: true },
    },
  },
  runner: async (ctx, rawArgs) => {
    if (!ctx?.user?._id) {
      return {
        ok: false,
        status: "auth_required",
        errors: [{ field: "(root)", message: "This tool needs you to be signed in." }],
        basket: null,
        results: [],
      };
    }

    const errors = [];
    ensurePlainObject(rawArgs, errors);
    const orderId = asString(rawArgs?.orderId, "orderId", errors, { max: 60 });
    const limit = asPositiveInt(rawArgs?.limit, "limit", errors, { fallback: 10, max: 20 });
    const onlyInStock = asBoolean(rawArgs?.onlyInStock, true);
    if (orderId && !isValidObjectId(orderId)) {
      errors.push({ field: "orderId", message: "orderId must be a real MongoDB _id." });
    }
    if (errors.length) return { ok: false, status: "invalid_arguments", errors, basket: null, results: [] };

    let order;
    if (orderId) {
      order = await OrderModel.findOne({ _id: orderId, user: ctx.user._id }).lean();
      if (!order) {
        return { ok: true, status: "not_found", order: null, basket: emptyBasket({ kind: "reorder" }), results: [], notes: ["order_not_found"] };
      }
    } else {
      order = await OrderModel.findOne({ user: ctx.user._id, status: { $ne: "cancelled" } })
        .sort({ createdAt: -1 })
        .lean();
      if (!order) {
        return { ok: true, status: "no_history", order: null, basket: emptyBasket({ kind: "reorder" }), results: [], notes: ["no_orders_yet"] };
      }
    }

    const catalogue = onlyInStock
      ? await ProductModel.find({ countInStock: { $gt: 0 } }).lean()
      : await ProductModel.find({}).lean();
    const matcher = createMatcher(catalogue);

    const items = [];
    const missing = [];
    const byId = new Map();

    const lines = Array.isArray(order.items) ? order.items.slice(0, limit) : [];
    for (const line of lines) {
      const name = String(line?.name || "").trim();
      if (!name) continue;
      const quantity = Number.isFinite(Number(line?.quantity)) && Number(line.quantity) > 0 ? Number(line.quantity) : 1;

      // Prefer the exact product id the order recorded; fall back to matching
      // the historical name against the live in-stock catalogue. The stored
      // ref may be a populated document (mongoose-autopopulate) or an id.
      const productRef = line?.product;
      const directId = productRef ? String(productRef._id ?? productRef) : null;
      let doc = directId ? catalogue.find((product) => String(product._id) === directId) || null : null;
      if (!doc) {
        const found = matchIngredient(name, catalogue, matcher.context);
        doc = found.matches[0]?.product || null;
      }
      if (!doc) {
        missing.push({ name, quantity });
        continue;
      }

      const product = groundProduct(doc);
      const key = String(product._id);
      const existing = byId.get(key);
      if (existing) {
        existing.quantity += quantity;
        existing.lineTotal = Number((existing.price * existing.quantity).toFixed(2));
        continue;
      }
      byId.set(key, { ...product, quantity, lineTotal: Number((product.price * quantity).toFixed(2)) });
      items.push(byId.get(key));
    }

    if (items.length) {
      assertGrounded(await verifyGroundedProducts(items, ProductModel), "buildReorderList");
    }

    const total = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));

    return {
      ok: true,
      status: items.length ? "ok" : "no_results",
      order: { _id: String(order._id), createdAt: order.createdAt ? order.createdAt.toISOString() : null },
      basket: {
        kind: "reorder",
        items,
        totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
        total,
        missing,
      },
      results: items,
      missing,
      notes: items.length ? (missing.length ? ["some_items_unavailable"] : []) : ["nothing_available_to_reorder"],
    };
  },
};

export const AI_SHOPPING_TOOLS = [
  BUILD_BUDGET_BASKET_TOOL,
  FIND_SUBSTITUTES_TOOL,
  BUILD_REORDER_LIST_TOOL,
];
