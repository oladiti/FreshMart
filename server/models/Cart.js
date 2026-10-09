// Server-side per-user cart.
//
// The storefront cart is localStorage (CartContext), but the AI assistant runs
// server-side, where there is no localStorage. These cart tools therefore own a
// Mongo-backed cart keyed by the authenticated user id - the AI can never
// address another user's cart because the identity always comes from the JWT.
//
// Items store only a product reference + quantity. Price/stock/name are read
// from the live Product document at read time so the assistant never quotes a
// stale or fabricated price.

import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1, max: 99 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

/** Get the user's cart, creating an empty one on first contact. */
cartSchema.statics.findOrCreateFor = async function (userId) {
  const existing = userId ? await this.findOne({ user: userId }) : null;
  if (existing) return existing;
  return this.create({ user: userId, items: [] });
};

/**
 * Serialize the cart for display, enriched with live product documents.
 * Lines whose product has been deleted are dropped rather than quoted, so the
 * assistant never shows a product that no longer exists.
 */
cartSchema.methods.toClientView = async function () {
  const Product = mongoose.model("Product");

  if (!this.items.length) {
    return { items: [], totalItems: 0, total: 0 };
  }

  const docs = await Product.find({
    _id: { $in: this.items.map((item) => item.product) },
  }).lean();
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));

  const items = [];
  for (const item of this.items) {
    const product = byId.get(String(item.product));
    if (!product) continue;
    const price = Number(product.price);
    items.push({
      product: {
        _id: String(product._id),
        name: product.name,
        price,
        image: product.image,
        category: product.category ?? null,
        slug: product.slug,
        sku: product.sku,
        countInStock: product.countInStock,
      },
      quantity: item.quantity,
      lineTotal: Number((price * item.quantity).toFixed(2)),
    });
  }

  return {
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    total: Number(
      items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
    ),
  };
};

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;