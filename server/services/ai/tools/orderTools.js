// AI order tools.
//
// Orders are scoped to the signed-in shopper: the user id always comes from the
// JWT, and a lookup for an order that belongs to someone else returns not_found
// so the assistant cannot even discover that it exists. Admins may view any
// order, because admin capabilities are only exposed to admins in the first
// place.

import OrderModel from "../../../models/Order.js";
import { asString, asPositiveInt, ensurePlainObject } from "./helpers.js";

const orderSummary = (order) => ({
  _id: String(order._id),
  reference: String(order._id).slice(-8).toUpperCase(),
  status: order.status ?? null,
  total: order.total_amount ?? 0,
  createdAt: order.createdAt ? order.createdAt.toISOString() : null,
  itemCount: Array.isArray(order.items)
    ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    : 0,
  items: Array.isArray(order.items)
    ? order.items.map((item) => ({
        name: item.name ?? null,
        quantity: item.quantity ?? 0,
        price: item.price ?? 0,
      }))
    : [],
});

async function ordersFor(userId, limit) {
  const docs = await OrderModel.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return docs.map(orderSummary);
}

const listTool = (name, description, { maxLimit }) => ({
  name,
  description,
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: maxLimit, default: Math.min(maxLimit, 10), description: `How many orders to return (max ${maxLimit}).` },
    },
  },
  runner: async (ctx, rawArgs) => {
    if (!ctx?.user?._id) {
      return { ok: false, status: "auth_required", errors: [{ field: "(root)", message: "This tool needs you to be signed in." }] };
    }
    const errors = [];
    const limit = asPositiveInt(rawArgs?.limit, "limit", errors, { fallback: Math.min(maxLimit, 10), max: maxLimit });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors, orders: [] };
    const orders = await ordersFor(ctx.user._id, limit);
    return { ok: true, status: orders.length ? "ok" : "no_orders", orders };
  },
});

export const GET_MY_ORDERS_TOOL = listTool(
  "getMyOrders",
  "List the signed-in shopper's own orders (real data only: totals, status, items).",
  { maxLimit: 20 }
);

export const GET_MY_RECENT_ORDERS_TOOL = listTool(
  "getMyRecentOrders",
  "Show the signed-in shopper's most recent orders (real data only).",
  { maxLimit: 5 }
);

export const GET_ORDER_BY_ID_TOOL = {
  name: "getOrderById",
  description: "Fetch one of the signed-in shopper's own orders by its MongoDB _id. Returns only that shopper's orders; never another account's.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      orderId: { type: "string", description: "MongoDB _id of an order." },
    },
    required: ["orderId"],
  },
  runner: async (ctx, rawArgs) => {
    if (!ctx?.user?._id) {
      return { ok: false, status: "auth_required", errors: [{ field: "(root)", message: "This tool needs you to be signed in." }] };
    }
    const errors = [];
    ensurePlainObject(rawArgs, errors);
    const orderId = asString(rawArgs?.orderId, "orderId", errors, { required: true });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors };

    const isAdmin = ctx.user.role === "admin";
    let doc = null;
    try {
      doc = isAdmin
        ? await OrderModel.findById(orderId).lean()
        : await OrderModel.findOne({ _id: orderId, user: ctx.user._id }).lean();
    } catch (error) {
      doc = null;
    }

    if (!doc) return { ok: true, status: "not_found", order: null, notes: ["order_not_found"] };
    return { ok: true, status: "ok", order: orderSummary(doc) };
  },
};

export const GET_ORDER_STATUS_TOOL = {
  name: "getOrderStatus",
  description: "Check the current status of one of the signed-in shopper's own orders by its MongoDB _id.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      orderId: { type: "string" },
    },
    required: ["orderId"],
  },
  runner: async (ctx, rawArgs) => {
    if (!ctx?.user?._id) {
      return { ok: false, status: "auth_required", errors: [{ field: "(root)", message: "This tool needs you to be signed in." }] };
    }
    const errors = [];
    const orderId = asString(rawArgs?.orderId, "orderId", errors, { required: true });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors };

    const isAdmin = ctx.user.role === "admin";
    let doc = null;
    try {
      doc = isAdmin
        ? await OrderModel.findById(orderId).lean()
        : await OrderModel.findOne({ _id: orderId, user: ctx.user._id }).lean();
    } catch (error) {
      doc = null;
    }

    if (!doc) return { ok: true, status: "not_found", order: null };
    return {
      ok: true,
      status: "ok",
      order: {
        _id: String(doc._id),
        reference: String(doc._id).slice(-8).toUpperCase(),
        status: doc.status ?? null,
        createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
      },
    };
  },
};

export const AI_ORDER_TOOLS = [
  GET_MY_ORDERS_TOOL,
  GET_MY_RECENT_ORDERS_TOOL,
  GET_ORDER_BY_ID_TOOL,
  GET_ORDER_STATUS_TOOL,
];