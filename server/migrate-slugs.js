// server/migrate-slugs.js
// Backfills URL-friendly slugs for existing products and recipes.
// Run with: npm run migrate:slugs
import dotenv from "dotenv";
import Product from "./models/Product.js";
import Recipe from "./models/Recipe.js";
import connectDB from "./config/db.js";
import {
  backfillMissingSlugs,
  backfillMissingRecipeSlugs,
} from "./backfill-slugs.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const totalProducts = await Product.countDocuments({});
  const updatedProducts = await backfillMissingSlugs();

  const totalRecipes = await Recipe.countDocuments({});
  const updatedRecipes = await backfillMissingRecipeSlugs();

  console.log(
    `✅ Slug migration complete: ${updatedProducts}/${totalProducts} products updated, ${updatedRecipes}/${totalRecipes} recipes updated`
  );
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Slug migration failed:", err.message);
  process.exit(1);
});