import Stripe from 'stripe';
import dotenv from 'dotenv';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

dotenv.config();

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey && !stripeKey.includes('sk_test_xxx')
  ? new Stripe(stripeKey)
  : null;

export const createPaymentIntent = async (req, res) => {
  try {
    const { cart, customer, shippingAddress } = req.body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      console.warn('createPaymentIntent: cart is empty');
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Fetch products from DB using Mongoose
    const items = [];
    const missingItems = [];
    let amount = 0;

    for (const it of cart) {
      const product = await Product.findById(it.id || it.productId);
      if (!product) {
        missingItems.push({
          id: it.id || it.productId,
          name: it.name || 'Unavailable product',
        });
        continue;
      }
      const qty = Number(it.quantity) || 1;

      // Validate stock before charging
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

    const amountPence = Math.round(amount * 100);
    const customerEmail = customer?.email || '';

    if (!customerEmail || !/^\S+@\S+\.\S+$/.test(customerEmail)) {
      console.warn('createPaymentIntent: invalid customer email', customerEmail);
      return res
        .status(400)
        .json({ message: 'A valid customer email is required' });
    }

    // Create order in MongoDB with Mongoose
    const order = new Order({
      user: customer?._id || customer?.id || null,
      items: items.map(({ product, qty }) => ({
        product: product._id,
        name: product.name,
        price: Number(product.price) || 0,
        image: product.image || '',
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

    res.json({ clientSecret: pi.client_secret, orderId: order._id, amount });
  } catch (err) {
    console.error('createPaymentIntent error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

export const confirmOrderPayment = async (req, res) => {
  try {
    const { orderId, transactionId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'orderId is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Guard against duplicate processing / double stock decrement
    const wasAlreadyPaid = order.status === 'paid';
    order.status = 'paid';
    if (transactionId) {
      order.payment_info = order.payment_info || {};
      order.payment_info.transaction_id = transactionId;
    } else {
      order.payment_info = order.payment_info || {};
      order.payment_info.transaction_id = order.payment_info.transaction_id || 'demo_payment';
    }
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
    console.error('confirmOrderPayment error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

export const stripeWebhookHandler = async (req, res) => {
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
    console.error('Webhook processing error', err);
    res.status(500).json({ message: err.message });
  }
};
