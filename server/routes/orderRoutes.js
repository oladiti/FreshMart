import express from 'express';
import {
  createOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
  getOrderById
} from '../controllers/orderController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { validate } from '../middleware/validate.js';
import { createOrderSchema } from '../schemas/orderSchemas.js';

const router = express.Router();

// 📌 User Routes
router.post('/', protect, validate({ body: createOrderSchema }), createOrder);  // Create new order
router.get('/myorders', protect, getUserOrders);   // Get logged-in user's orders
router.get('/user', protect, getUserOrders);       // Alias

// 📌 Admin Routes
router.get('/', protect, adminOnly, getAllOrders);          // Get all orders
router.put('/:id', protect, adminOnly, validateObjectId(), updateOrderStatus);  // Update order status
router.delete('/:id', protect, adminOnly, validateObjectId(), deleteOrder);     // Delete order

// 📌 Single order (must be defined AFTER static /myorders and /user routes)
router.get('/:id', protect, validateObjectId(), getOrderById);

export default router;
