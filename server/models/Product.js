import mongoose from "mongoose";
import { slugify } from "../utils/slugify.js";

export { slugify };

// Build a readable, collab-resistant merchant SKU (Stock Keeping Unit).
// Format: FM-<CATEGORY-3><RANDOM-4> (e.g. FM-FRU-K7D2). Never derived from
// the Mongo _id. Exported so seeders/tests can generate the same format.
const SKU_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const makeSku = (category = "", name = "") => {
  const cat =
    (category || name || "GEN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) ||
    "GEN";
  const suffix = Array.from(
    { length: 4 },
    () => SKU_CHARS[Math.floor(Math.random() * SKU_CHARS.length)]
  ).join("");
  return `FM-${cat}-${suffix}`;
};

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    category: { type: String },
    image: { type: String, required: true }, // main image
    isFeatured: { type: Boolean, default: false },
    isWeeklyDeal: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    images: [String], // gallery
    // category: String, // ✅ Important for filtering
    tags: [String],
    nutrition: {
      calories: String,
      fat: String,
      carbs: String,
      protein: String,
    },
    reviews: [reviewSchema],
    related: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    // ✅ Add stock tracking
    countInStock: { type: Number, required: true, default: 10 },
    slug: { type: String, unique: true, sparse: true },
    brand: { type: String }, // optional
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true, // merchant product code; auto-generated when blank
    },
  },
  { timestamps: true }
);

// Indexes for storefront filtering and the recommendation engine. Without
// these, category/tag/flag lookups and the newest-first sort scan the whole
// collection on every request.
productSchema.index({ category: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ isWeeklyDeal: 1 });
productSchema.index({ isNewArrival: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ countInStock: 1 });
productSchema.index({ createdAt: -1 });

// Auto-generate a URL-friendly slug from the product name
productSchema.pre("validate", async function (next) {
  // Auto-generate a unique merchant SKU when none was provided
  if (!this.sku) {
    let sku = makeSku(this.category, this.name);
    let suffix = 1;
    while (await mongoose.models.Product.exists({ sku, _id: { $ne: this._id } })) {
      sku = `${makeSku(this.category, this.name)}-${suffix++}`;
    }
    this.sku = sku;
  }

  if (!this.isModified("name") && this.slug) return next();

  const baseSlug = this.name ? slugify(this.name) : this._id?.toString() || "product";
  let slug = baseSlug;
  let suffix = 1;

  while (await mongoose.models.Product.exists({ slug, _id: { $ne: this._id } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  this.slug = slug;
  next();
});

export default mongoose.model("Product", productSchema);
