import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Setting from '../models/Setting.js';

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

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'name email')
      .populate('items.product', 'name price image')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
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
    res.status(500).json({ message: err.message });
  }
};

export const getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: 'user' }).select(
      'name email role createdAt'
    );
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getBestSellers = async (req, res) => {
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
    res.status(500).json({ message: err.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    order.status = req.body.status || order.status;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createProductAdmin = async (req, res) => {
  try {
    const p = await Product.create(req.body);
    res.status(201).json(p);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateProductAdmin = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Not found' });
    Object.assign(p, req.body);
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteProductAdmin = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Not found' });
    await p.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const dayKey = (date) => {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getAnalytics = async (req, res) => {
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

    // Top categories by revenue (look up product category snapshot).
    const categoryTotals = {};
    activeOrders.forEach((o) => {
      o.items.forEach((it) => {
        const category = it.product?.category || 'Unknown';
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
    res.status(500).json({ message: err.message });
  }
};

export const getSettings = async (req, res) => {
  try {
    const settings = await Setting.find({});
    const current = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    res.json({ ...SETTING_DEFAULTS, ...current });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateSettings = async (req, res) => {
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
    res.status(500).json({ message: err.message });
  }
};
