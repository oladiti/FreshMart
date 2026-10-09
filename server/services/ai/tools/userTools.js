// AI user-insight tools.
//
// Built from data the schema actually stores: purchase history and frequently
// purchased items are derived from the shopper's own non-cancelled orders.
// Favorites are deliberately NOT offered - the User model has no favorites
// collection - and the tool says so rather than pretending.

import OrderModel from "../../../models/Order.js";
import { asPositiveInt } from "./helpers.js";

export const GET_PURCHASE_HISTORY_TOOL = {
  name: "getPurchaseHistory",
  description: "Summarise the signed-in shopper's own purchase history: past orders, dates, totals and items. Real order data only.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
    },
  },
  runner: async (ctx, rawArgs) => {
    if (!ctx?.user?._id) {
      return { ok: false, status: "auth_required", errors: [{ field: "(root)", message: "This tool needs you to be signed in." }] };
    }
    const errors = [];
    const limit = asPositiveInt(rawArgs?.limit, "limit", errors, { fallback: 10, max: 20 });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors, history: [] };

    const docs = await OrderModel.find({ user: ctx.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const history = docs.map((order) => ({
      _id: String(order._id),
      reference: String(order._id).slice(-8).toUpperCase(),
      status: order.status ?? null,
      total: order.total_amount ?? 0,
      createdAt: order.createdAt ? order.createdAt.toISOString() : null,
      items: Array.isArray(order.items)
        ? order.items.map((item) => ({ name: item.name ?? null, quantity: item.quantity ?? 0, price: item.price ?? 0 }))
        : [],
    }));

    return { ok: true, status: history.length ? "ok" : "no_history", history };
  },
};

export const GET_FREQUENTLY_PURCHASED_TOOL = {
  name: "getFrequentlyPurchased",
  description: "Show the signed-in shopper's most frequently purchased items, ranked from their own past orders. Real order data only.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
    },
  },
  runner: async (ctx, rawArgs) => {
    if (!ctx?.user?._id) {
      return { ok: false, status: "auth_required", errors: [{ field: "(root)", message: "This tool needs you to be signed in." }] };
    }
    const errors = [];
    const limit = asPositiveInt(rawArgs?.limit, "limit", errors, { fallback: 5, max: 10 });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors, items: [] };

    const rows = await OrderModel.aggregate([
      { $match: { user: ctx.user._id, status: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          timesOrdered: { $sum: 1 },
          quantity: { $sum: "$items.quantity" },
          lastPrice: { $last: "$items.price" },
        },
      },
      { $sort: { quantity: -1, timesOrdered: -1, _id: 1 } },
      { $limit: limit },
    ]);

    return {
      ok: true,
      status: rows.length ? "ok" : "no_history",
      items: rows.map((row) => ({
        name: row._id,
        timesOrdered: row.timesOrdered,
        quantity: row.quantity,
        lastPrice: row.lastPrice ?? 0,
      })),
    };
  },
};

export const GET_MY_FAVORITES_TOOL = {
  name: "getMyFavorites",
  description: "List the signed-in shopper's saved favourites.",
  requiresAuth: true,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  runner: async (ctx) => {
    if (!ctx?.user?._id) {
      return { ok: false, status: "auth_required", errors: [{ field: "(root)", message: "This tool needs you to be signed in." }] };
    }
    // The User schema has no favorites collection; say so rather than pretend.
    return {
      ok: true,
      status: "not_supported",
      reason: "favourites_are_not_supported_yet",
      message: "Favourites aren't part of your account yet, but I can search the catalogue or show what you've bought before.",
    };
  },
};

export const AI_USER_TOOLS = [
  GET_PURCHASE_HISTORY_TOOL,
  GET_FREQUENTLY_PURCHASED_TOOL,
  GET_MY_FAVORITES_TOOL,
];