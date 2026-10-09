// AI admin tools.
//
// These are only presented to the model when the signed-in user has role
// "admin" (see registry.js), and the registry ALSO rejects any admin-tool call
// from a non-admin. Metrics are built with real aggregates over Order and
// Product documents - the same numbers the admin dashboard shows.

import OrderModel from "../../../models/Order.js";
import ProductModel from "../../../models/Product.js";
import { asPositiveInt, asNonNegativeInt, ensurePlainObject } from "./helpers.js";

const ALLOWED_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];

function sinceDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export const GET_LOW_STOCK_PRODUCTS_TOOL = {
  name: "getLowStockProducts",
  description: "List real products at or below a stock threshold, cheapest stock first. Admin only.",
  requiresAuth: true,
  requiresAdmin: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      threshold: { type: "integer", minimum: 0, maximum: 100, default: 10, description: "Stock level at or below which a product counts as low." },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
    },
  },
  runner: async (_ctx, rawArgs) => {
    const errors = [];
    ensurePlainObject(rawArgs, errors);
    const threshold = asNonNegativeInt(rawArgs?.threshold, "threshold", errors, { fallback: 10, max: 100 });
    const limit = asPositiveInt(rawArgs?.limit, "limit", errors, { fallback: 20, max: 50 });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors, products: [] };

    const docs = await ProductModel.find({ countInStock: { $lte: threshold } })
      .sort({ countInStock: 1, _id: 1 })
      .limit(limit)
      .lean();

    return {
      ok: true,
      status: "ok",
      admin: {
        type: "low_stock",
        threshold,
        products: docs.map((p) => ({
          _id: String(p._id),
          name: p.name,
          category: p.category ?? null,
          price: p.price,
          countInStock: p.countInStock,
        })),
      },
    };
  },
};

export const GET_SALES_SUMMARY_TOOL = {
  name: "getSalesSummary",
  description: "Real sales summary for the last N days: revenue, order count, average order value, units sold, cancelled orders and active customers. Admin only.",
  requiresAuth: true,
  requiresAdmin: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      days: { type: "integer", minimum: 1, maximum: 90, default: 30 },
    },
  },
  runner: async (_ctx, rawArgs) => {
    const errors = [];
    const days = asPositiveInt(rawArgs?.days, "days", errors, { fallback: 30, max: 90 });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors };

    const orders = await OrderModel.find({ createdAt: { $gte: sinceDaysAgo(days) } }).lean();
    const active = orders.filter((o) => o.status !== "cancelled");
    const cancelled = orders.filter((o) => o.status === "cancelled");

    const totalRevenue = active.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const unitsSold = active.reduce(
      (sum, o) => sum + (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
      0
    );
    const customers = new Set(active.map((o) => o.customer_email));

    return {
      ok: true,
      status: "ok",
      admin: {
        type: "sales_summary",
        days,
        summary: {
          totalRevenue: Number(totalRevenue.toFixed(2)),
          totalOrders: active.length,
          cancelledOrders: cancelled.length,
          averageOrderValue: active.length ? Number((totalRevenue / active.length).toFixed(2)) : 0,
          unitsSold,
          activeCustomers: customers.size,
        },
      },
    };
  },
};

export const GET_ORDER_SUMMARY_TOOL = {
  name: "getOrderSummary",
  description: "Break down current order volumes by status across the whole store. Admin only.",
  requiresAuth: true,
  requiresAdmin: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  runner: async () => {
    const rows = await OrderModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const statusCounts = ALLOWED_STATUSES.map((status) => ({
      status,
      count: byStatus[status] || 0,
    }));
    const total = statusCounts.reduce((sum, s) => sum + s.count, 0);

    return {
      ok: true,
      status: "ok",
      admin: { type: "order_summary", totalOrders: total, statusCounts },
    };
  },
};

export const GET_TOP_PRODUCTS_TOOL = {
  name: "getTopProducts",
  description: "Rank real products by units sold across all non-cancelled orders. Admin only.",
  requiresAuth: true,
  requiresAdmin: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
    },
  },
  runner: async (_ctx, rawArgs) => {
    const errors = [];
    const limit = asPositiveInt(rawArgs?.limit, "limit", errors, { fallback: 10, max: 20 });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors, products: [] };

    const rows = await OrderModel.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          unitsSold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { unitsSold: -1, revenue: -1 } },
      { $limit: limit },
    ]);

    return {
      ok: true,
      status: "ok",
      admin: {
        type: "top_products",
        products: rows.map((row) => ({
          name: row._id,
          unitsSold: row.unitsSold,
          revenue: Number(row.revenue.toFixed(2)),
        })),
      },
    };
  },
};

export const GET_CATEGORY_PERFORMANCE_TOOL = {
  name: "getCategoryPerformance",
  description: "Category revenue and units for the last N days. Admin only. Category names are the real product categories.",
  requiresAuth: true,
  requiresAdmin: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      days: { type: "integer", minimum: 1, maximum: 90, default: 30 },
    },
  },
  runner: async (_ctx, rawArgs) => {
    const errors = [];
    const days = asPositiveInt(rawArgs?.days, "days", errors, { fallback: 30, max: 90 });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors, categories: [] };

    // Order items only snapshot name/price/image, so the category has to come
    // from the live Product document via a $lookup.
    const rows = await OrderModel.aggregate([
      { $match: { createdAt: { $gte: sinceDaysAgo(days) }, status: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$productInfo.category", "Unknown"] },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          units: { $sum: "$items.quantity" },
        },
      },
      { $sort: { revenue: -1, _id: 1 } },
    ]);

    return {
      ok: true,
      status: "ok",
      admin: {
        type: "category_performance",
        categories: rows.map((row) => ({
          category: row._id,
          revenue: Number(row.revenue.toFixed(2)),
          units: row.units,
        })),
      },
    };
  },
};

export const AI_ADMIN_TOOLS = [
  GET_LOW_STOCK_PRODUCTS_TOOL,
  GET_SALES_SUMMARY_TOOL,
  GET_ORDER_SUMMARY_TOOL,
  GET_TOP_PRODUCTS_TOOL,
  GET_CATEGORY_PERFORMANCE_TOOL,
];