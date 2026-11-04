import Order, { ORDER_STATUSES } from '../models/Order.js';
import Product from '../models/Product.js';
import { coerceQuantity, MAX_ITEM_QUANTITY } from '../utils/orderItems.js';

// 📌 Create new order
export const createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    let customerEmail = req.body.customerEmail;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address is required' });
    }

    // Aggregate quantities per product so duplicate lines can't be used to
    // bypass the stock check, then validate each product and its stock.
    const lineItems = new Map(); // productId -> { product, quantity }
    const missingItems = [];

    for (const item of items) {
      const productId = item.productId || item.id;
      const product = await Product.findById(productId);
      if (!product) {
        missingItems.push({
          id: productId,
          name: item.name || 'Unavailable product',
        });
        continue;
      }

      const quantity = coerceQuantity(item.quantity);
      if (quantity === null) {
        return res.status(400).json({
          message: `Invalid quantity for "${product.name}". Use a whole number between 1 and ${MAX_ITEM_QUANTITY}.`,
        });
      }

      const key = String(product._id);
      const existing = lineItems.get(key);
      if (existing) existing.quantity += quantity;
      else lineItems.set(key, { product, quantity });
    }

    if (missingItems.length > 0) {
      return res.status(400).json({
        message: `Some items in your cart are no longer available: ${missingItems
          .map((m) => m.name || m.id)
          .join(', ')}`,
        code: 'MISSING_PRODUCTS',
        missingItems,
      });
    }

    const orderItems = [];
    let totalAmount = 0;

    for (const { product, quantity } of lineItems.values()) {
      // Validate available stock (across all lines for this product) before
      // placing the order.
      const stock = Number(product.countInStock ?? product.stock);
      if (typeof stock === 'number' && stock < quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Only ${stock} available.`,
        });
      }

      const price = Number(product.price) || 0;
      totalAmount += price * quantity;

      orderItems.push({
        product: product._id,
        name: product.name,
        price,
        image: product.image || '',
        sku: product.sku,
        category: product.category ?? null,
        quantity,
      });
    }

    if (!customerEmail && req.user) {
      customerEmail = req.user.email;
    }

    if (!customerEmail || !/^\S+@\S+\.\S+$/.test(customerEmail)) {
      return res
        .status(400)
        .json({ message: 'A valid customer email is required' });
    }

    const order = new Order({
      user: req.user ? req.user._id : null,
      items: orderItems,
      total_amount: totalAmount,
      status: 'pending',
      customer_email: customerEmail,
      shipping_address: shippingAddress,
      payment_info: {
        method: paymentMethod || 'card',
      },
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  } catch (error) {
    next(error);
  }
};

// 📌 Get logged-in user's orders
export const getUserOrders = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name price image')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// 📌 Get all orders (Admin only)
export const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'name email')
      .populate('items.product', 'name price image')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// 📌 Get single order by ID (owner or admin)
export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name price image')
      .populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only admins, or the shopper who placed the order, may read it. Guest
    // orders (no user) stay private instead of being visible to any caller.
    const isAdmin = req.user && req.user.role === 'admin';
    const orderUserId = order.user && (order.user._id || order.user);
    const isOwner =
      req.user && orderUserId && String(orderUserId) === String(req.user._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
};

// 📌 Update order status (Admin)
export const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.body.status !== undefined && !ORDER_STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${ORDER_STATUSES.join(', ')}`,
      });
    }

    order.status = req.body.status || order.status;
    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
};

// 📌 Delete order (Admin)
export const deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await order.deleteOne();
    res.json({ message: 'Order removed' });
  } catch (error) {
    next(error);
  }
};
