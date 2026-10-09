import mongoose from "mongoose";
import { slugify } from "../utils/slugify.js";

const recipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    ingredients: [{ type: String, required: true }],
    steps: [{ type: String, required: true }],
    category: { type: String, required: true },
    diet: { type: String, enum: ["vegan", "vegetarian", "gluten-free", "keto", "none"], default: "none" },
    image: { type: String, default: "" },
    slug: { type: String, unique: true, sparse: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-generate a URL-friendly slug from the recipe title so links use slugs
// (like /recipes/jollof-rice) instead of exposing the Mongo _id.
recipeSchema.pre("validate", async function (next) {
  if (!this.isModified("title") && this.slug) return next();

  const baseSlug = this.title
    ? slugify(this.title)
    : this._id?.toString() || "recipe";
  let slug = baseSlug;
  let suffix = 1;

  while (await mongoose.models.Recipe.exists({ slug, _id: { $ne: this._id } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  this.slug = slug;
  next();
});

const Recipe = mongoose.model("Recipe", recipeSchema);

export default Recipe;
