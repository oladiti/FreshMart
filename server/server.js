// server.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import app from './app.js';
import { backfillMissingSlugs, backfillMissingSkus, backfillMissingRecipeSlugs } from './backfill-slugs.js';
import Product from './models/Product.js';
import Order from './models/Order.js';
import { computeRecommendations } from './services/recommendations/computeRecommendations.js';

// Load server/.env relative to this file so `npm start` works from any cwd.
// On Render env vars are already injected, and dotenv does not override them.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Connect DB & start server
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    // Ensure every product has a slug so product URLs never expose the _id
    const backfilled = await backfillMissingSlugs();
    if (backfilled > 0) {
      console.log(`✅ Backfilled ${backfilled} missing product slug(s)`);
    }
    // Ensure every product has a merchant SKU/product code
    const skuBackfilled = await backfillMissingSkus();
    if (skuBackfilled > 0) {
      console.log(`✅ Backfilled ${skuBackfilled} missing product SKU(s)`);
    }
    // Ensure every recipe has a slug so recipe URLs never expose the _id
    const recipeSlugsBackfilled = await backfillMissingRecipeSlugs();
    if (recipeSlugsBackfilled > 0) {
      console.log(`✅ Backfilled ${recipeSlugsBackfilled} missing recipe slug(s)`);
    }

    // Build the query indexes the storefront relies on (Atlas may have
    // autoIndex disabled). Non-fatal: the app still runs if this fails.
    try {
      await Promise.all([Product.syncIndexes(), Order.syncIndexes()]);
      console.log('✅ Product & Order indexes synced');
    } catch (indexError) {
      console.error('⚠️  Index sync failed:', indexError.message);
    }

    // Warm the anonymous "popular" recommendation cache so the first visitor
    // doesn't pay the cold aggregation cost.
    try {
      await computeRecommendations({ user: null });
      console.log('✅ Recommendation cache warmed');
    } catch (warmError) {
      console.error('⚠️  Recommendation warm-up failed:', warmError.message);
    }

    app.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error('DB connection error:', err.message);
    process.exit(1);
  });
