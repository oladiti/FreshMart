// server/migrate-order-categories.js
// Backfills category snapshots for existing order items.
// Run with: npm run migrate:order-categories
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import { backfillMissingOrderCategories } from "./backfill-order-categories.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const updated = await backfillMissingOrderCategories();
  console.log(
    `Order category migration complete: ${updated} order(s) updated`
  );

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Order category migration failed:", err.message);
  process.exit(1);
});
