// AI cart tools.
//
// These operate on the server-side per-user cart (models/Cart.js); the
// authenticated user's id always comes from the request JWT, never from model
// input. Rules enforced here, not trusted to the model:
//   - Requires a signed-in shopper (auth_required).
//   - Line quantity is capped at 99 and at the product's real stock.
//   - Adding a large quantity, or pushing the cart past 8 distinct lines,
//     returns needs_confirmation until the caller passes confirmed:true.
//   - Clearing the cart always requires explicit confirmed:true.
//   - Prices/names in responses always come from live Product documents.

import Cart from "../../../models/Cart.js";
import ProductModel from "../../../models/Product.js";
import { groundProduct } from "../../assistant/tools/grounding.js";
import { asString, asPositiveInt, asNonNegativeInt, asBoolean, ensurePlainObject } from "./helpers.js";

export const MAX_LINE_QUANTITY = 99;
/** Any line whose quantity would exceed this needs explicit confirmation. */
export const BULK_QUANTITY_THRESHOLD = 5;
/** A new line that would take the cart past this many lines needs confirmation. */
export const MAX_DISTINCT_LINES = 8;

const requireUser = (ctx) => {
  if (!ctx?.user?._id) {
    return {
      ok: false,
      status: "auth_required",
      errors: [{ field: "(root)", message: "This tool needs you to be signed in." }],
    };
  }
  return null;
};

async function currentCartView(userId) {
  const cart = await Cart.findOrCreateFor(userId);
  return { cart, view: await cart.toClientView() };
}

function productCard(product) {
  return groundProduct(product);
}

async function loadProduct(productId) {
  if (!productId) return null;
  try {
    return await ProductModel.findById(productId).lean();
  } catch (error) {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * getCart
 * ------------------------------------------------------------------ */

export const GET_CART_TOOL = {
  name: "getCart",
  description: "Show the signed-in shopper's current cart: products, quantities, line totals and the grand total, all from real catalogue data.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  runner: async (ctx) => {
    const missing = requireUser(ctx);
    if (missing) return missing;
    const { view } = await currentCartView(ctx.user._id);
    return { ok: true, status: view.items.length ? "ok" : "empty", cart: view };
  },
};

/* ------------------------------------------------------------------ *
 * addToCart
 * ------------------------------------------------------------------ */

export const ADD_TO_CART_TOOL = {
  name: "addToCart",
  description:
    "Add a real product to the signed-in shopper's cart by its MongoDB _id. " +
    "Pass confirmed=true only after the shopper explicitly agrees (required for quantities above 5 or carts beyond 8 lines).",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      productId: { type: "string", description: "Real MongoDB _id of the product (must come from a product tool result)." },
      quantity: { type: "integer", minimum: 1, maximum: MAX_LINE_QUANTITY, default: 1 },
      confirmed: { type: "boolean", default: false, description: "Set true only after the shopper confirmed a bulk addition." },
    },
    required: ["productId"],
  },
  runner: async (ctx, rawArgs) => {
    const missing = requireUser(ctx);
    if (missing) return missing;

    const errors = [];
    ensurePlainObject(rawArgs, errors);
    const productId = asString(rawArgs?.productId, "productId", errors, { required: true });
    const quantity = asPositiveInt(rawArgs?.quantity, "quantity", errors, {
      fallback: 1,
      max: MAX_LINE_QUANTITY,
    });
    const confirmed = asBoolean(rawArgs?.confirmed, false);
    if (errors.length) return { ok: false, status: "invalid_arguments", errors };

    const product = await loadProduct(productId);
    if (!product) {
      const { view } = await currentCartView(ctx.user._id);
      return { ok: true, status: "not_found", cart: view, errors: [{ field: "productId", message: "That product does not exist." }] };
    }
    if (Number(product.countInStock) <= 0) {
      const { view } = await currentCartView(ctx.user._id);
      return { ok: true, status: "sold_out", cart: view, product: productCard(product) };
    }

    const { cart, view } = await currentCartView(ctx.user._id);
    const line = cart.items.find((item) => String(item.product) === productId);
    const existingQty = line?.quantity || 0;
    const finalQty = existingQty + quantity;

    if (finalQty > MAX_LINE_QUANTITY) {
      return { ok: true, status: "quantity_limit", max: MAX_LINE_QUANTITY, cart: view };
    }

    // Real stock is the hard ceiling; never let quantity exceed it.
    if (finalQty > Number(product.countInStock)) {
      return {
        ok: true,
        status: "insufficient_stock",
        available: Number(product.countInStock),
        requested: finalQty,
        product: productCard(product),
        cart: view,
      };
    }

    const bulk = finalQty > BULK_QUANTITY_THRESHOLD;
    const crowded = !line && cart.items.length >= MAX_DISTINCT_LINES;
    if ((bulk || crowded) && !confirmed) {
      return {
        ok: true,
        status: "needs_confirmation",
        summary: {
          productId,
          name: product.name,
          quantity: finalQty,
          reason: bulk ? "large_quantity" : "cart_line_limit",
        },
        product: productCard(product),
        cart: view,
      };
    }

    if (line) {
      line.quantity = finalQty;
    } else {
      cart.items.push({ product: product._id, quantity });
    }
    await cart.save();

    const updated = await currentCartView(ctx.user._id);
    return {
      ok: true,
      status: "ok",
      added: { product: productCard(product), quantity },
      cart: updated.view,
    };
  },
};

/* ------------------------------------------------------------------ *
 * updateCartQuantity
 * ------------------------------------------------------------------ */

export const UPDATE_CART_QUANTITY_TOOL = {
  name: "updateCartQuantity",
  description:
    "Set the quantity of a line in the signed-in shopper's cart by product _id. Quantity 0 removes the line. Quantities above 5 need confirmed=true.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      productId: { type: "string" },
      quantity: { type: "integer", minimum: 0, maximum: MAX_LINE_QUANTITY },
      confirmed: { type: "boolean", default: false },
    },
    required: ["productId", "quantity"],
  },
  runner: async (ctx, rawArgs) => {
    const missing = requireUser(ctx);
    if (missing) return missing;

    const errors = [];
    ensurePlainObject(rawArgs, errors);
    const productId = asString(rawArgs?.productId, "productId", errors, { required: true });
    const quantity = asNonNegativeInt(rawArgs?.quantity, "quantity", errors, {
      fallback: -1,
      max: MAX_LINE_QUANTITY,
    });
    const confirmed = asBoolean(rawArgs?.confirmed, false);
    if (errors.length || quantity === -1) {
      return { ok: false, status: "invalid_arguments", errors };
    }

    const { cart, view } = await currentCartView(ctx.user._id);
    const line = cart.items.find((item) => String(item.product) === productId);
    if (!line) {
      return { ok: true, status: "not_in_cart", cart: view };
    }

    if (quantity > BULK_QUANTITY_THRESHOLD && !confirmed) {
      const product = await loadProduct(productId);
      return {
        ok: true,
        status: "needs_confirmation",
        summary: {
          productId,
          name: product?.name ?? null,
          quantity,
          reason: "large_quantity",
        },
        cart: view,
      };
    }

    if (quantity === 0) {
      cart.items = cart.items.filter((item) => String(item.product) !== productId);
    } else {
      const product = await loadProduct(productId);
      if (product && quantity > Number(product.countInStock)) {
        return {
          ok: true,
          status: "insufficient_stock",
          available: Number(product.countInStock),
          requested: quantity,
          product: productCard(product),
          cart: view,
        };
      }
      line.quantity = quantity;
    }
    await cart.save();

    const updated = await currentCartView(ctx.user._id);
    return { ok: true, status: "ok", cart: updated.view };
  },
};

/* ------------------------------------------------------------------ *
 * removeFromCart
 * ------------------------------------------------------------------ */

export const REMOVE_FROM_CART_TOOL = {
  name: "removeFromCart",
  description: "Remove one product line from the signed-in shopper's cart by product _id.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      productId: { type: "string" },
    },
    required: ["productId"],
  },
  runner: async (ctx, rawArgs) => {
    const missing = requireUser(ctx);
    if (missing) return missing;

    const errors = [];
    ensurePlainObject(rawArgs, errors);
    const productId = asString(rawArgs?.productId, "productId", errors, { required: true });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors };

    const { cart, view } = await currentCartView(ctx.user._id);
    const line = cart.items.find((item) => String(item.product) === productId);
    if (!line) {
      return { ok: true, status: "not_in_cart", cart: view };
    }

    cart.items = cart.items.filter((item) => String(item.product) !== productId);
    await cart.save();

    const updated = await currentCartView(ctx.user._id);
    return { ok: true, status: "ok", removed: productId, cart: updated.view };
  },
};

/* ------------------------------------------------------------------ *
 * calculateCartTotal
 * ------------------------------------------------------------------ */

export const CALCULATE_CART_TOTAL_TOOL = {
  name: "calculateCartTotal",
  description: "Calculate the real running total (and item count) of the signed-in shopper's cart using live product prices.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      currency: { type: "string", description: "Ignored: FreshMart always prices in GBP (£)." },
    },
  },
  runner: async (ctx) => {
    const missing = requireUser(ctx);
    if (missing) return missing;
    const { view } = await currentCartView(ctx.user._id);
    return {
      ok: true,
      status: "ok",
      cartTotal: view.total,
      totalItems: view.totalItems,
      itemCount: view.items.length,
      cart: view,
    };
  },
};

/* ------------------------------------------------------------------ *
 * clearCart
 * ------------------------------------------------------------------ */

export const CLEAR_CART_TOOL = {
  name: "clearCart",
  description:
    "Remove every line from the signed-in shopper's cart. Always returns needs_confirmation until confirmed=true is passed after the shopper agrees.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      confirmed: { type: "boolean", default: false },
    },
  },
  runner: async (ctx, rawArgs) => {
    const missing = requireUser(ctx);
    if (missing) return missing;
    const confirmed = asBoolean(rawArgs?.confirmed, false);

    const { cart, view } = await currentCartView(ctx.user._id);
    if (!confirmed) {
      return {
        ok: true,
        status: "needs_confirmation",
        summary: {
          reason: "clear_cart",
          lineCount: view.items.length,
          totalItems: view.totalItems,
          total: view.total,
          products: view.items.map((item) => item.product.name),
        },
        cart: view,
      };
    }

    cart.items = [];
    await cart.save();

    const updated = await currentCartView(ctx.user._id);
    return { ok: true, status: "ok", cart: updated.view };
  },
};

export const AI_CART_TOOLS = [
  GET_CART_TOOL,
  ADD_TO_CART_TOOL,
  UPDATE_CART_QUANTITY_TOOL,
  REMOVE_FROM_CART_TOOL,
  CALCULATE_CART_TOTAL_TOOL,
  CLEAR_CART_TOOL,
];