// Fetch a single product by its real Mongo _id.
//
// The id is checked as an ObjectId before it reaches a query, and the document
// that comes back is projected through the grounding layer and verified, so a
// reply can only ever name a product the catalogue actually holds.

import ProductModel from "../../../models/Product.js";
import { isValidObjectId } from "mongoose";
import { groundProduct, verifyGroundedProducts, assertGrounded } from "./grounding.js";

export const TOOL_NAME = "getProductById";

/**
 * @param {{productId: string, verify?: boolean}} args
 * @param {{Product?: object}} [options]
 * @returns {Promise<object>} result envelope: {ok, status, results, notes}
 */
export async function getProductById(args, options = {}) {
  const raw = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const productId = typeof raw.productId === "string" ? raw.productId.trim() : "";

  if (!productId) {
    return {
      ok: false,
      status: "invalid_arguments",
      errors: [{ field: "productId", message: "productId is required." }],
      results: [],
    };
  }
  if (!isValidObjectId(productId)) {
    return {
      ok: false,
      status: "invalid_arguments",
      errors: [{ field: "productId", message: "productId must be a real MongoDB _id." }],
      results: [],
    };
  }

  const Model = options.Product ?? ProductModel;
  const doc = await Model.findById(productId).lean();
  if (!doc) {
    return { ok: true, status: "not_found", results: [], notes: ["product-not-found"] };
  }

  const results = [groundProduct(doc)];
  if (options.verify !== false) {
    assertGrounded(await verifyGroundedProducts(results, Model), TOOL_NAME);
  }

  return { ok: true, status: "ok", results, notes: [] };
}

export default getProductById;
