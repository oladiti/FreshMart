import Stripe from 'stripe';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { coerceQuantity, MAX_ITEM_QUANTITY } from '../utils/orderItems.js';

dotenv.config();

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey && !stripeKey.includes('sk_test_xxx')
  ? new Stripe(stripeKey)
  : null;

export const createPaymentIntent = async (req, res, next) => {
  try {
    const { cart, customer, shippingAddress } = req.body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      console.warn('createPaymentIntent: cart is empty');
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Fetch products from DB and aggregate quantities per product so duplicate
    // lines can't be used to bypass the stock check.
    const lineItems = new Map(); // productId -> { product, qty }
    const missingItems = [];

    for (const it of cart) {
      const product = await Product.findById(it.id || it.productId);
      if (!product) {
        missingItems.push({
          id: it.id || it.productId,
          name: it.name || 'Unavailable product',
        });
        continue;
      }

      const qty = coerceQuantity(it.quantity);
      if (qty === null) {
        return res.status(400).json({
          message: `Invalid quantity for "${product.name}". Use a whole number between 1 and ${MAX_ITEM_QUANTITY}.`,
        });
      }

      const key = String(product._id);
      const existing = lineItems.get(key);
      if (existing) existing.qty += qty;
      else lineItems.set(key, { product, qty });
    }

    if (missingItems.length > 0) {
      console.warn(
        'createPaymentIntent: missing products',
        missingItems.map((m) => m.id)
      );
      return res.status(400).json({
        message: `Some items in your cart are no longer available: ${missingItems
          .map((m) => m.name || m.id)
          .join(', ')}`,
        code: 'MISSING_PRODUCTS',
        missingItems: missingItems.map((m) => ({
          id: m.id,
          productId: m.id,
          name: m.name || 'Unavailable product',
        })),
      });
    }

    const items = [];
    let amount = 0;

    for (const { product, qty } of lineItems.values()) {
      // Validate stock (across all lines for this product) before charging.
      const stock = Number(product.countInStock ?? product.stock);
      if (typeof stock === 'number' && stock < qty) {
        console.warn(
          `createPaymentIntent: insufficient stock for "${product.name}" (have ${stock}, need ${qty})`
        );
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Only ${stock} available.`,
        });
      }

      const price = Number(product.price) || 0;
      amount += price * qty;
      items.push({ product, qty });
    }

    const amountPence = Math.round(amount * 100);
    const customerEmail = customer?.email || '';

    if (!customerEmail || !/^\S+@\S+\.\S+$/.test(customerEmail)) {
      console.warn('createPaymentIntent: invalid customer email', customerEmail);
      return res
        .status(400)
        .json({ message: 'A valid customer email is required' });
    }

    // Create order in MongoDB with Mongoose. The owner is always the
    // authenticated user (never a client-supplied id) so a caller cannot
    // attribute an order to someone else.
    const order = new Order({
      user: req.user ? req.user._id : null,
      items: items.map(({ product, qty }) => ({
        product: product._id,
        name: product.name,
        price: Number(product.price) || 0,
        image: product.image || '',
        category: product.category ?? null,
        quantity: qty,
      })),
      total_amount: amount,
      status: 'pending',
      customer_email: customerEmail,
      shipping_address: shippingAddress || {},
      payment_info: { method: 'card' },
    });

    await order.save();

    // If Stripe is not configured, fall back to simulating a successful intent
    if (!stripe) {
      return res.json({
        clientSecret: 'demo_mode',
        orderId: order._id,
        amount,
        demoMode: true,
      });
    }

    const pi = await stripe.paymentIntents.create({
      amount: amountPence,
      currency: 'gbp',
      metadata: { order_id: String(order._id) },
      receipt_email: customer?.email,
    });

    // Remember the intent so confirm-order can verify it with Stripe later.
    order.payment_info = order.payment_info || {};
    order.payment_info.transaction_id = pi.id;
    await order.save();

    res.json({ clientSecret: pi.client_secret, orderId: order._id, amount });
  } catch (err) {
    next(err);
  }
};

export const confirmOrderPayment = async (req, res, next) => {
  try {
    const { orderId, transactionId } = req.body || {};

    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ message: 'A valid orderId is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only the order's owner (or an admin) may confirm its payment.
    const orderUserId = order.user && (order.user._id || order.user);
    const isOwner =
      req.user && orderUserId && String(orderUserId) === String(req.user._id);
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ message: 'Not authorized to confirm this order' });
    }

    // Never trust the client's word that a payment succeeded: verify the
    // PaymentIntent with Stripe before marking the order paid.
    if (stripe) {
      if (!transactionId) {
        return res.status(400).json({ message: 'transactionId is required' });
      }

      let intent;
      try {
        intent = await stripe.paymentIntents.retrieve(transactionId);
      } catch (err) {
        console.error('confirmOrderPayment: Stripe retrieve failed', err.message);
        return res.status(400).json({ message: 'Unable to verify payment' });
      }

      const matchesOrder =
        intent.metadata?.order_id &&
        String(intent.metadata.order_id) === String(order._id);

      if (intent.status !== 'succeeded' || !matchesOrder) {
        return res
          .status(400)
          .json({ message: 'Payment has not been completed' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // With no Stripe key configured there is nothing to verify, so demo
      // confirmations must never be accepted in production.
      return res
        .status(503)
        .json({ message: 'Payment processing is not configured' });
    }

    // Guard against duplicate processing / double stock decrement
    const wasAlreadyPaid = order.status === 'paid';
    order.status = 'paid';
    order.payment_info = order.payment_info || {};
    order.payment_info.transaction_id =
      transactionId || order.payment_info.transaction_id || 'demo_payment';
    await order.save();

    if (!wasAlreadyPaid) {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product && typeof product.countInStock === 'number') {
          product.countInStock = Math.max(
            0,
            product.countInStock - item.quantity
          );
          await product.save();
        }
      }
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

export const stripeWebhookHandler = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];

  if (!stripe) {
    return res.json({ received: true, demoMode: true });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const orderId = pi.metadata?.order_id;
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order) {
          const wasAlreadyPaid = order.status === 'paid';
          order.status = 'paid';
          order.payment_info.transaction_id = pi.id;
          await order.save();

          // Decrement product stock (only once)
          if (!wasAlreadyPaid) {
            for (const item of order.items) {
              const product = await Product.findById(item.product);
              if (product && typeof product.countInStock === 'number') {
                product.countInStock = Math.max(
                  0,
                  product.countInStock - item.quantity
                );
                await product.save();
              }
            }
          }
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
};
