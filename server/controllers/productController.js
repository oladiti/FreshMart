import mongoose from "mongoose";
import Product from "../models/Product.js";

/* ======================================================
   🛒 PRODUCT CONTROLLER
   Handles: Get, Create, Update, Delete, Filter, Related, Reviews
====================================================== */

// Single source of truth for the review shape returned to clients. Requires a
// product already queried with .populate("reviews.user"), which both callers do.
// Ids and timestamps are included so the UI can key and date entries reliably,
// and the author is nested so the client can tell whether a review is the
// signed-in user's own.
const serializeReviews = (product) =>
  (product.reviews || []).map((r) => ({
    _id: r._id,
    user: r.user ? { _id: r.user._id, name: r.user.name || "Anonymous" } : null,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  }));

const MAX_COMMENT_LENGTH = 1000;

// Fields a product card needs. Keeping list responses to just these shrinks the
// payload significantly (no description/nutrition/reviews for every card).
const PRODUCT_LIST_FIELDS =
  "name price image category slug sku countInStock isWeeklyDeal isNewArrival isFeatured";

// Guard user-supplied strings before turning them into RegExp, so a stray `(`
// can't throw and `.*` can't force an unbounded match.
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// ✅ Fetch Weekly Deals
export const getWeeklyDeals = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const deals = await Product.find({ isWeeklyDeal: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments({ isWeeklyDeal: true });

    res.json({ deals, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("❌ Error fetching weekly deals:", error);
    res.status(500).json({ message: "Failed to fetch weekly deals" });
  }
};

export const getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true });
    res.json(products);
  } catch (error) {
    console.error("❌ Error fetching featured products:", error);
    res.status(500).json({ message: "Failed to fetch featured products" });
  }
};

// ✅ Fetch New Arrivals
export const getNewArrivals = async (req, res) => {
  try {
    // Prefer products flagged as new arrivals; fall back to most recent
    let products = await Product.find({ isNewArrival: true })
      .sort({ createdAt: -1 })
      .limit(50);

    if (products.length === 0) {
      products = await Product.find({})
        .sort({ createdAt: -1 })
        .limit(50);
    }

    res.json(products);
  } catch (error) {
    console.error("❌ Error fetching new arrivals:", error);
    res.status(500).json({ message: "Failed to fetch new arrivals" });
  }
};

// ✅ Get All Products (search + category + price + dietary + pagination)
// Filtering happens here so the client never has to download the whole
// catalogue to filter it. Returns a small, projected page of products.
export const getProducts = async (req, res) => {
  try {
    const { search = "", category, categories, minPrice, maxPrice, dietary } =
      req.query;

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100
    );
    const skip = (page - 1) * limit;

    const conditions = [];

    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      conditions.push({
        $or: [
          { name: rx },
          { category: rx },
          { description: rx },
          { sku: rx },
        ],
      });
    }

    const categoryList = [
      ...(typeof categories === "string" ? categories.split(",") : []),
      ...(category ? [category] : []),
    ]
      .map((value) => String(value).trim())
      .filter(Boolean);
    if (categoryList.length) {
      conditions.push({
        $or: categoryList.map((value) => ({
          category: { $regex: escapeRegex(value), $options: "i" },
        })),
      });
    }

    const min = toNumberOrNull(minPrice);
    const max = toNumberOrNull(maxPrice);
    if (min !== null || max !== null) {
      const price = {};
      if (min !== null) price.$gte = min;
      if (max !== null) price.$lte = max;
      conditions.push({ price });
    }

    if (dietary && dietary !== "All") {
      conditions.push({
        tags: { $regex: escapeRegex(dietary), $options: "i" },
      });
    }

    const query = conditions.length ? { $and: conditions } : {};

    const [products, total] = await Promise.all([
      Product.find(query)
        .select(PRODUCT_LIST_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      products,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get Products by Category
export const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 20 } = req.query;

    const products = await Product.find({
      category: { $regex: new RegExp(category, "i") },
    })
      .select("name price image category isWeeklyDeal slug")
      .limit(parseInt(limit))
      .lean();

    if (!products.length) {
      return res.status(404).json({
        message: `No products found for category: ${category}`,
      });
    }

    res.json(products);
  } catch (error) {
    console.error("❌ Error fetching products by category:", error);
    res.status(500).json({ message: "Failed to fetch products by category" });
  }
};


// ✅ Get Product by Slug (with related + reviews)
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await Product.findOne({
      $or: [
        { slug },
        ...(mongoose.isValidObjectId(slug) ? [{ _id: slug }] : []),
      ],
    })
      .populate("related", "name price image category slug")
      .populate("reviews.user", "name email")
      .lean();

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Never expose raw _id URLs: an id-based request is permanently
    // redirected to the canonical slug instead of being served as-is.
    if (mongoose.isValidObjectId(slug) && product.slug) {
      return res.redirect(301, `/api/products/${product.slug}`);
    }

    // 🧩 Determine related products
    let relatedProducts = [];
    if (product.related?.length > 0) {
      relatedProducts = product.related.slice(0, 4);
    } else {
      relatedProducts = await Product.find({
        category: product.category,
        _id: { $ne: product._id },
      })
        .select("name price image category slug")
        .limit(4)
        .lean();
    }

    res.json({
      ...product,
      reviews: serializeReviews(product),
      related: relatedProducts,
    });
  } catch (error) {
    console.error("❌ Error fetching product:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Create New Product
export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      category,
      countInStock,
      stock,
      image,
      images,
      nutrition,
      sku,
      isWeeklyDeal,
      isNewArrival,
      isFeatured,
      related,
    } = req.body;

    const newProduct = new Product({
      name,
      description,
      price,
      category,
      countInStock: countInStock ?? stock ?? 10,
      image,
      images,
      nutrition,
      sku,
      isWeeklyDeal,
      isNewArrival,
      isFeatured,
      related: related || [],
    });

    const createdProduct = await newProduct.save();
    const populatedProduct = await Product.findById(createdProduct._id).populate(
      "related",
      "name price image category"
    );

    res.status(201).json(populatedProduct);
  } catch (error) {
    next(error);
  }
};

// ✅ Update Product
export const updateProduct = async (req, res, next) => {
  try {
    const updates = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    Object.assign(product, updates);
    const updatedProduct = await product.save();

    const populatedProduct = await Product.findById(updatedProduct._id).populate(
      "related",
      "name price image category"
    );

    res.json(populatedProduct);
  } catch (error) {
    next(error);
  }
};

// ✅ Add Related Products
export const addRelatedProducts = async (req, res) => {
  try {
    const { relatedProductIds } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: { related: { $each: relatedProductIds } },
      },
      { new: true }
    ).populate("related", "name price image category");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: "Related products added successfully",
      product,
    });
  } catch (error) {
    console.error("❌ Error adding related products:", error);
    res.status(500).json({ message: "Failed to add related products" });
  }
};

// ✅ Remove Related Products
export const removeRelatedProducts = async (req, res) => {
  try {
    const { relatedProductIds } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        $pull: { related: { $in: relatedProductIds } },
      },
      { new: true }
    ).populate("related", "name price image category");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: "Related products removed successfully",
      product,
    });
  } catch (error) {
    console.error("❌ Error removing related products:", error);
    res.status(500).json({ message: "Failed to remove related products" });
  }
};

// ✅ Delete Product
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ message: "Product not found" });

    await product.deleteOne();
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// ✅ Create or Update a Review (authenticated users only, one per product)
// A repeat submission from the same user edits their existing review in place
// rather than adding a second one, so the rating a customer sees can't be
// skewed by someone posting over and over.
export const createReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    // Validate up front: a bad rating would otherwise surface as a 500 from the
    // Mongoose validator, which tells the client nothing useful.
    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be a whole number between 1 and 5" });
    }

    const trimmedComment = typeof comment === "string" ? comment.trim() : "";
    if (!trimmedComment) {
      return res.status(400).json({ message: "Please write a short review" });
    }
    if (trimmedComment.length > MAX_COMMENT_LENGTH) {
      return res
        .status(400)
        .json({ message: `Reviews are limited to ${MAX_COMMENT_LENGTH} characters` });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const userId = req.user._id.toString();
    const existing = product.reviews.find(
      (r) => r.user && r.user.toString() === userId
    );

    if (existing) {
      existing.rating = parsedRating;
      existing.comment = trimmedComment;
    } else {
      product.reviews.push({
        user: req.user._id,
        rating: parsedRating,
        comment: trimmedComment,
      });
    }

    await product.save();

    // Re-read so the serializer gets populated author names, and hand back the
    // full list so the client never has to refetch the whole product.
    const updated = await Product.findById(product._id)
      .populate("reviews.user", "name")
      .lean();
    const reviews = serializeReviews(updated);

    res.status(existing ? 200 : 201).json({
      message: existing
        ? "Your review has been updated"
        : "Thanks for your review!",
      review: reviews.find((r) => r.user?._id?.toString() === userId),
      reviews,
    });
  } catch (error) {
    next(error);
  }
};
