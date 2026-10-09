import express from 'express';
import { createPaymentIntent, confirmOrderPayment } from '../controllers/paymentStripeController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();
router.post('/create-payment-intent', protect, createPaymentIntent);
router.post('/confirm-order', protect, confirmOrderPayment);
export default router;
