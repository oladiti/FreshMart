// Cheaper alternatives to a real product.
//
// "Cheaper" is measured against the target's live catalogue price, never a
// model estimate, and the target itself can never be offered as its own
// alternative. If the catalogue holds nothing below that price, the tool says
// so instead of rounding up to something that costs more.

import ProductModel from "../../../models/Product.js";
import { isValidObjectId } from "mongoose";
import { groundProduct, verifyGroundedProducts, assertGrounded } from "./grounding.js";

export const TOOL_NAME = "findCheaperAlternative";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/**
 * @param {{productId: string, category?: string, maxPrice?: number, limit?: number}} args
 * @param {{Product?: object}} [options]
 * @returns {Promise<object>} result envelope: {ok, status, results, notes}
 */
export async function findCheaperAlternative(args, options = {}) {
  const raw = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const errors = [];

  const productId = typeof raw.productId === "string" ? raw.productId.trim() : "";
  if (!productId) {
    errors.push({ field: "productId", message: "productId is required." });
  } else if (!isValidObjectId(productId)) {
    errors.push({ field: "productId", message: "productId must be a real MongoDB _id." });
  }

  let ceiling = null;
  if (raw.maxPrice !== undefined && raw.maxPrice !== null && raw.maxPrice !== "") {
    const n = Number(raw.maxPrice);
    if (!Number.isFinite(n) || n < 0) {
      errors.push({ field: "maxPrice", message: "maxPrice must be a number of 0 or more." });
    } else {
      ceiling = n;
    }
  }

  let limit = DEFAULT_LIMIT;
  if (raw.limit !== undefined && raw.limit !== null && raw.limit !== "") {
    const n = Number(raw.limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
      errors.push({ field: "limit", message: `limit must be a whole number between 1 and ${MAX_LIMIT}.` });
    } else {
      limit = n;
    }
  }

  const category =
    typeof raw.category === "string" && raw.category.trim() ? raw.category.trim().slice(0, 60) : "";

  if (errors.length) {
    return { ok: false, status: "invalid_arguments", errors, results: [] };
  }

  const Model = options.Product ?? ProductModel;
  const target = await Model.findById(productId).lean();
  if (!target) {
    return { ok: true, status: "not_found", results: [], notes: ["product-not-found"] };
  }

  const targetPrice = Number(target.price);
  // An extra ceiling can only lower the bar; it never raises it above what the
  // target actually costs.
  const priceBelow = Math.min(targetPrice, ceiling ?? targetPrice);

  const filter = { price: { $lt: priceBelow }, _id: { $ne: target._id } };
  if (category) filter.category = category;
  else if (typeof target.category === "string" && target.category) filter.category = target.category;

  const docs = await Model.find(filter)
    .sort({ price: 1, _id: 1 })
    .limit(limit)
    .lean();

  const results = docs.map(groundProduct);
  if (results.length) {
    assertGrounded(await verifyGroundedProducts(results, Model), TOOL_NAME);
  }

  return {
    ok: true,
    status: results.length ? "ok" : "no_results",
    results,
    notes: results.length ? [] : ["nothing_cheaper_in_catalogue"],
  };
}

export default findCheaperAlternative;
