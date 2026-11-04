import Order, { ORDER_STATUSES } from '../models/Order.js';
import Product, { pickProductFields } from '../models/Product.js';
import User from '../models/User.js';
import Setting from '../models/Setting.js';
import AuditLog from '../models/AuditLog.js';

// Escape RegExp metacharacters in user-supplied search text.
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const SETTING_DEFAULTS = {
  storeName: 'FreshMart',
  currencySymbol: '£',
  taxRate: 0,
  shippingFee: 0,
  freeShippingThreshold: 0,
  lowStockThreshold: 10,
  deliveryTimeEstimate: '3-5 business days',
  announcement: '',
  supportEmail: '',
  supportPhone: '',
  orderPrefix: 'FM',
};

export const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'name email')
      .populate('items.product', 'name price image')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

export const getAllProducts = async (req, res, next) => {
  try {
    // Escape and cap the search term before using it as a RegExp so a crafted
    // value can't trigger catastrophic backtracking (ReDoS).
    const search = escapeRegex(String(req.query.search || '').trim().slice(0, 64));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit) || 20)
    );
    const skip = (page - 1) * limit;

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { category: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { sku: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({ products, total, totalPages, currentPage: page, pageSize: limit });
  } catch (err) {
    next(err);
  }
};

export const getAllCustomers = async (req, res, next) => {
  try {
    const customers = await User.find({ role: 'user' }).select(
      'name email role createdAt'
    );
    res.json(customers);
  } catch (err) {
    next(err);
  }
};

export const getBestSellers = async (req, res, next) => {
  try {
    // Rank products by cumulative units sold across all non-cancelled orders.
    // Items carry name/image snapshots, so results survive deleted products.
    const bestSellers = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          image: { $first: '$items.image' },
          unitsSold: { $sum: '$items.quantity' },
          revenue: {
            $sum: { $multiply: ['$items.price', '$items.quantity'] },
          },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      {
        $unwind: {
          path: '$productInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          productId: '$_id',
          name: {
            $ifNull: ['$productInfo.name', '$name'],
          },
          image: {
            $ifNull: ['$productInfo.image', '$image'],
          },
          category: '$productInfo.category',
          countInStock: '$productInfo.countInStock',
          unitsSold: 1,
          revenue: 1,
        },
      },
      { $sort: { unitsSold: -1, revenue: -1 } },
      { $limit: 10 },
    ]);

    res.json(bestSellers);
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (req.body.status !== undefined && !ORDER_STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${ORDER_STATUSES.join(', ')}`,
      });
    }
    order.status = req.body.status || order.status;
    await order.save();
    res.json(order);
  } catch (err) {
    next(err);
  }
};

export const createProductAdmin = async (req, res, next) => {
  try {
    const p = await Product.create(pickProductFields(req.body));
    res.status(201).json(p);
  } catch (err) {
    next(err);
  }
};

export const updateProductAdmin = async (req, res, next) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Not found' });
    Object.assign(p, pickProductFields(req.body));
    await p.save();
    res.json(p);
  } catch (err) {
    next(err);
  }
};

export const deleteProductAdmin = async (req, res, next) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Not found' });
    await p.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

const dayKey = (date) => {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getAnalytics = async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const orders = await Order.find({ createdAt: { $gte: since } })
      .populate('user', 'name email')
      .populate('items.product', 'name category');

    const activeOrders = orders.filter((o) => o.status !== 'cancelled');
    const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

    const totalRevenue = activeOrders.reduce(
      (sum, o) => sum + (o.total_amount || 0),
      0
    );
    const unitsSold = activeOrders.reduce(
      (sum, o) =>
        sum + o.items.reduce((itemSum, it) => itemSum + (it.quantity || 0), 0),
      0
    );
    const uniqueEmails = new Set(activeOrders.map((o) => o.customer_email));

    // Build the day-by-day series first so it also drives the charts.
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      series.push({ date: dayKey(day), revenue: 0, orders: 0, units: 0 });
    }
    const seriesIndex = new Map(series.map((d, i) => [d.date, i]));

    activeOrders.forEach((o) => {
      const idx = seriesIndex.get(dayKey(o.createdAt));
      if (idx === undefined) return;
      series[idx].revenue += o.total_amount || 0;
      series[idx].orders += 1;
      series[idx].units += o.items.reduce(
        (s, it) => s + (it.quantity || 0),
        0
      );
    });

    // Top categories by revenue. Prefer the category snapshot stored on the
    // order item so deleted products keep their original category.
    const categoryTotals = {};
    activeOrders.forEach((o) => {
      o.items.forEach((it) => {
        const category = it.category || it.product?.category || 'Uncategorised';
        categoryTotals[category] = categoryTotals[category] || {
          revenue: 0,
          units: 0,
        };
        categoryTotals[category].revenue += (it.price || 0) * (it.quantity || 0);
        categoryTotals[category].units += it.quantity || 0;
      });
    });
    const topCategories = Object.entries(categoryTotals)
      .map(([category, totals]) => ({ category, ...totals }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    // Top customers by spend (non-cancelled orders only).
    const customerTotals = {};
    activeOrders.forEach((o) => {
      const key = o.customer_email;
      customerTotals[key] = customerTotals[key] || { email: key, name: '', spend: 0, orders: 0 };
      if (o.user?.name) customerTotals[key].name = o.user.name;
      customerTotals[key].spend += o.total_amount || 0;
      customerTotals[key].orders += 1;
    });
    const topCustomers = Object.values(customerTotals)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    const statusCounts = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map(
      (status) => ({
        status,
        count: orders.filter((o) => o.status === status).length,
      })
    );

    res.json({
      days,
      summary: {
        totalRevenue,
        totalOrders: activeOrders.length,
        cancelledOrders: cancelledOrders.length,
        averageOrderValue: activeOrders.length
          ? totalRevenue / activeOrders.length
          : 0,
        unitsSold,
        activeCustomers: uniqueEmails.size,
      },
      series,
      topCategories,
      topCustomers,
      statusCounts,
    });
  } catch (err) {
    next(err);
  }
};

export const getSettings = async (req, res, next) => {
  try {
    const settings = await Setting.find({});
    const current = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    res.json({ ...SETTING_DEFAULTS, ...current });
  } catch (err) {
    next(err);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const updates = req.body && typeof req.body === 'object' ? req.body : {};
    const allowList = Object.keys(SETTING_DEFAULTS);

    for (const key of allowList) {
      if (!(key in updates)) continue;
      let value = updates[key];
      const current = SETTING_DEFAULTS[key];

      if (typeof current === 'number') {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          return res
            .status(400)
            .json({ message: `${key} must be a valid number` });
        }
        value = n;
      } else {
        value = String(value ?? '');
      }

      await Setting.findOneAndUpdate({ key }, { value }, { upsert: true });
    }

    const settings = await Setting.find({});
    const current = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    res.json({ ...SETTING_DEFAULTS, ...current });
  } catch (err) {
    next(err);
  }
};

// Read-only audit trail viewer. Supports pagination plus optional filters on
// action, actor id and a free-text target. Admin-only (router-level guard).
export const getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const filter = {};
    if (typeof req.query.action === 'string' && req.query.action.trim()) {
      filter.action = req.query.action.trim().slice(0, 100);
    }
    if (typeof req.query.actor === 'string' && /^[a-f0-9]{24}$/i.test(req.query.actor)) {
      filter.actor = req.query.actor;
    }
    if (typeof req.query.target === 'string' && req.query.target.trim()) {
      filter.target = new RegExp(escapeRegex(req.query.target.trim().slice(0, 64)), 'i');
    }
    if (req.query.success === 'true' || req.query.success === 'false') {
      filter.success = req.query.success === 'true';
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
};
