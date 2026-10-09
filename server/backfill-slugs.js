// server/backfill-slugs.js
// Guarantees every product has a URL-friendly slug so no product URL ever
// has to fall back to the raw MongoDB _id. Runs automatically at server
// startup and is reused by migrate-slugs.js and the API tests.
import Product from "./models/Product.js";
import Recipe from "./models/Recipe.js";

export const backfillMissingSlugs = async () => {
  const docs = await Product.find({ slug: { $in: [null, ""] } });
  let updated = 0;

  for (const doc of docs) {
    // pre("validate") hook generates the slug (with uniqueness suffixing)
    const saved = await doc.save();
    if (saved?.slug) updated += 1;
  }

  return updated;
};

// Guarantees every recipe has a URL-friendly slug so no recipe URL ever has
// to fall back to the raw MongoDB _id. Runs automatically at server startup
// and is reused by migrate-slugs.js and the API tests.
export const backfillMissingRecipeSlugs = async () => {
  const docs = await Recipe.find({ slug: { $in: [null, ""] } });
  let updated = 0;

  for (const doc of docs) {
    const saved = await doc.save();
    if (saved?.slug) updated += 1;
  }

  return updated;
};

// Guarantees every product has a merchant SKU (product code). Mirrors the slug
// backfill: runs pre("validate") via doc.save(), which auto-generates missing
// SKUs. Existing databases get codes automatically on the next server boot.
export const backfillMissingSkus = async () => {
  const docs = await Product.find({ sku: { $in: [null, ""] } });
  let updated = 0;

  for (const doc of docs) {
    const saved = await doc.save();
    if (saved?.sku) updated += 1;
  }

  return updated;
};