import Order from '../models/Order.js';
import Product from '../models/Product.js';

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

    // Build order item snapshots and validate products exist
    const orderItems = [];
    const missingItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId || item.id);
      if (!product) {
        missingItems.push({
          id: item.productId || item.id,
          name: item.name || 'Unavailable product',
        });
        continue;
      }

      const quantity = Number(item.quantity) || 1;
      const price = Number(product.price) || 0;

      // Validate available stock before placing the order
      const stock = Number(product.countInStock ?? product.stock);
      if (typeof stock === 'number' && stock < quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Only ${stock} available.`,
        });
      }

      totalAmount += price * quantity;

      orderItems.push({
        product: product._id,
        name: product.name,
        price,
        image: product.image || '',
        sku: product.sku,
        quantity,
      });
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

    // Non-admins can only view their own orders
    if (
      req.user &&
      req.user.role !== 'admin' &&
      order.user &&
      order.user._id.toString() !== req.user._id.toString()
    ) {
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
