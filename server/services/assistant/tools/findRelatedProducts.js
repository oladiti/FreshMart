// Find products related to a real one: same category first, never the target
// itself. Used by the AI agent when a shopper asks "anything like this?".

import ProductModel from "../../../models/Product.js";
import { isValidObjectId } from "mongoose";
import { groundProduct, verifyGroundedProducts, assertGrounded } from "./grounding.js";

export const TOOL_NAME = "findRelatedProducts";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/**
 * @param {{productId: string, category?: string, limit?: number}} args
 * @param {{Product?: object}} [options]
 * @returns {Promise<object>} result envelope: {ok, status, results, notes}
 */
export async function findRelatedProducts(args, options = {}) {
  const raw = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const errors = [];

  const productId = typeof raw.productId === "string" ? raw.productId.trim() : "";
  if (!productId) {
    errors.push({ field: "productId", message: "productId is required." });
  } else if (!isValidObjectId(productId)) {
    errors.push({ field: "productId", message: "productId must be a real MongoDB _id." });
  }

  const category =
    typeof raw.category === "string" && raw.category.trim() ? raw.category.trim().slice(0, 60) : "";

  let limit = DEFAULT_LIMIT;
  if (raw.limit !== undefined && raw.limit !== null && raw.limit !== "") {
    const n = Number(raw.limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
      errors.push({ field: "limit", message: `limit must be a whole number between 1 and ${MAX_LIMIT}.` });
    } else {
      limit = n;
    }
  }

  if (errors.length) {
    return { ok: false, status: "invalid_arguments", errors, results: [] };
  }

  const Model = options.Product ?? ProductModel;
  const target = await Model.findById(productId).lean();
  if (!target) {
    return { ok: true, status: "not_found", results: [], notes: ["product-not-found"] };
  }

  // Prefer the caller's category, then the target's own, then whatever the
  // product links to explicitly; a product with none of those has no honest
  // "related" set to offer.
  const relatedCategory = category || (typeof target.category === "string" ? target.category : "");
  const relatedIds = Array.isArray(target.related) ? target.related : [];

  const filter = { _id: { $ne: target._id } };
  if (relatedCategory) filter.category = relatedCategory;
  else if (relatedIds.length) filter._id.$in = relatedIds;
  else return { ok: true, status: "no_results", results: [], notes: ["no_related_products"] };

  const docs = await Model.find(filter)
    .sort({ createdAt: -1, _id: 1 })
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
    notes: results.length ? [] : ["no_related_products"],
  };
}

export default findRelatedProducts;
