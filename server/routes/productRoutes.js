import express from 'express';
import {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getWeeklyDeals,
  addRelatedProducts,
  removeRelatedProducts,
  getProductsByCategory,
  getFeaturedProducts,
  getNewArrivals,
  createReview
} from '../controllers/productController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import Product from '../models/Product.js';

const router = express.Router();

/* ==========================
   📦 PUBLIC ROUTES
========================== */

// ✅ GET all products (with optional search, category, price, dietary filters
// and pagination). Delegates to the controller so filtering stays in one place.
router.get('/', getProducts);

router.get('/featured', async (req, res) => {
  try {
    // Only the product-card fields the featured row renders, newest first.
    const products = await Product.find({ isFeatured: true })
      .select(
        'name price image category slug sku countInStock isWeeklyDeal isNewArrival isFeatured'
      )
      .sort({ createdAt: -1 })
      .limit(24)
      .lean();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ GET products by category (clean endpoint)
router.get('/category/:category', getProductsByCategory);

// ✅ GET weekly deals
router.get('/weekly-deals', getWeeklyDeals);

// ✅ GET new arrivals
router.get('/new', getNewArrivals);

// ✅ GET single product by slug
router.get('/:slug', getProductBySlug);

/* ==========================
   👤 CUSTOMER ROUTES
   (authenticated, not admin-only)
========================== */

// ✅ Submit a review (or edit your existing one)
router.post('/:id/reviews', protect, createReview);

/* ==========================
   🔒 ADMIN ROUTES
========================== */

// ✅ CREATE new product
router.post('/', protect, adminOnly, createProduct);

// ✅ UPDATE existing product
router.put('/:id', protect, adminOnly, updateProduct);

// ✅ ADD related products
router.patch('/:id/related', protect, adminOnly, addRelatedProducts);

// ✅ REMOVE related products
router.delete('/:id/related', protect, adminOnly, removeRelatedProducts);

// ✅ DELETE product
router.delete('/:id', protect, adminOnly, deleteProduct);

export default router;
