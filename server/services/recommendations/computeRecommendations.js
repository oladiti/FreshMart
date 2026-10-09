// Recommendation engine (rule-based, deterministic).
//
// Turns the data the schema already stores into a short list of products the
// shopper is likely to want, each with a one-line human reason:
//
//   - signed-in shoppers are seeded from their own non-cancelled order items;
//   - "co-purchase" comes from what OTHER shoppers put in the same orders,
//   - "similar" comes from shared category/tags with the shopper's own items,
//   - everyone gets a "popular" baseline from overall order quantity,
//   - store flags (weekly deal / new arrival / rating) add a small boost.
//
// Every returned product is shaped by groundProduct() so the HTTP route and the
// AI tool share exactly the same trust boundary as the rest of the assistant.
//
// The engine is deliberately dependency-free (no LLM, no embeddings): results
// are reproducible and unit-testable.

import { Types } from "mongoose";
import ProductModel from "../../models/Product.js";
import OrderModel from "../../models/Order.js";
import { groundProduct } from "../assistant/tools/grounding.js";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 12;
const CACHE_TTL_MS = 5 * 60 * 1000;

export const REASONS = Object.freeze({
  CO_PURCHASE: "Bought together with items in your orders",
  SIMILAR: "Similar to items in your orders",
  POPULAR: "Popular right now",
  DEAL: "This week's deal",
  NEW: "A new arrival",
  RATED: "Highly rated",
  FEATURED: "A featured pick",
});

const toId = (value) => {
  if (value && typeof value === "object" && value._id !== undefined) value = value._id;
  return value === undefined || value === null ? null : String(value);
};
const isItemId = (value) => typeof value === "string" && value.length === 24;
// Aggregations bypass Mongoose's schema casting, so a 24-char string id will
// never equal the ObjectId stored on the document. Everything that reaches a
// $match/$in against a stored id goes through here first.
const toRef = (value) => {
  if (value && typeof value === "object" && value._id !== undefined) value = value._id;
  if (value === undefined || value === null || !Types.ObjectId.isValid(value)) return null;
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
};
const clampLimit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
};
const tagsOf = (doc) => new Set((doc.tags || []).map((tag) => String(tag).toLowerCase()));

function averageRating(doc) {
  const reviews = Array.isArray(doc.reviews) ? doc.reviews : [];
  const ratings = reviews
    .map((review) => Number(review?.rating))
    .filter((rating) => Number.isFinite(rating));
  return ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : null;
}

/**
 * A tiny TTL cache. The route/tool call this service on every request, but the
 * underlying aggregations only need to be recomputed every few minutes.
 */
export function createCache(ttlMs = CACHE_TTL_MS) {
  const store = new Map();
  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.at > ttlMs) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      store.set(key, { at: Date.now(), value });
    },
    clear() {
      store.clear();
    },
  };
}

/**
 * The cache the route and AI tool share. Exported so tests (and ops tooling)
 * can invalidate it instead of waiting out the TTL.
 */
export const defaultCache = createCache();

/**
 * Score every real product document once, then pick the top `limit`.
 *
 * The cache stores the ranked list (keyed on user + seed product, never on the
 * cart contents), so exclusion filtering happens after a cache hit too.
 *
 * @param {object} options
 * @param {{_id?: string}} [options.user] signed-in user or null/undefined
 * @param {number|string} [options.limit] max items to return (1..12, default 8)
 * @param {Array<string|object>} [options.excludedIds] product ids to skip
 * @param {string} [options.seedProductId] force a single seed (product page)
 * @returns {Promise<{recommendations: Array<{product: object, reason: string}>, personalized: boolean}>}
 */
export async function computeRecommendations({
  user,
  limit,
  excludedIds = [],
  seedProductId,
  Product = ProductModel,
  Order = OrderModel,
  cache = defaultCache,
} = {}) {
  const maxItems = clampLimit(limit);
  const exclude = new Set(
    [...(Array.isArray(excludedIds) ? excludedIds : []), seedProductId]
      .map(toId)
      .filter(isItemId)
  );

  // 1) Seeds from the shopper's own non-cancelled orders (or an explicit one).
  let seedIds = [];
  const seedRef = toRef(seedProductId);
  if (seedRef) {
    seedIds = [String(seedRef)];
  } else {
    const userRef = toRef(user?._id);
    if (userRef) {
      const rows = await Order.aggregate([
        { $match: { user: userRef, status: { $ne: "cancelled" } } },
        { $unwind: "$items" },
        { $group: { _id: "$items.product", qty: { $sum: "$items.quantity" } } },
        { $sort: { qty: -1, _id: 1 } },
        { $limit: 12 },
      ]);
      seedIds = rows.map((row) => toRef(row._id)).filter(Boolean).map(String);
    }
  }
  const personalized = seedIds.length > 0;
  seedIds.forEach((id) => exclude.add(id));

  const cacheKey = `user:${user?._id || "anon"}|seed:${seedProductId || "none"}`;
  const cached = cache.get(cacheKey);

  let ranked;
  if (cached) {
    ranked = cached;
  } else {
    ranked = await rankRecommendations({ seedIds, Product, Order });
    cache.set(cacheKey, ranked);
  }
  if (process.env.REC_DEBUG) console.error("DEBUG seeds", seedIds, "coCounts? + ranked", ranked.map((r) => ({ id: r.id, reason: r.reason, score: r.finalScore })));

  // 2) Exclusion filtering happens after scoring so cart additions don't evict
  //    the cache (and still drop correctly on a cache hit).
  const recommended = [];
  for (const entry of ranked) {
    if (recommended.length >= maxItems) break;
    if (exclude.has(entry.id)) continue;
    recommended.push({ product: entry.product, reason: entry.reason });
  }

  return { recommendations: recommended, personalized };
}

/**
 * Compute the ranked list of { id, product, reason } for a seed set.
 * Split out so caching can reuse it wholesale.
 */
async function rankRecommendations({ seedIds, Product = ProductModel, Order = OrderModel }) {
  const seedRefs = seedIds.map(toRef).filter(Boolean);

  // Popularity baseline across every non-cancelled order.
  const popularRows = await Order.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", qty: { $sum: "$items.quantity" } } },
    { $sort: { qty: -1, _id: 1 } },
    { $limit: 80 },
  ]);
  const popularQty = new Map(
    popularRows.map((row) => [toId(row._id), Number(row.qty) || 0])
  );
  const maxPopular = Math.max(0, ...popularQty.values());

  // Content signals from the seed products' own category/tags.
  const seedDocs = seedRefs.length
    ? await Product.find({ _id: { $in: seedRefs } }).lean()
    : [];
  const seedCats = new Set(seedDocs.map((doc) => doc.category).filter(Boolean));
  const seedTags = new Set(seedDocs.flatMap((doc) => doc.tags || []).map((tag) => String(tag).toLowerCase()));

  let contentIds = [];
  if (seedCats.size || seedTags.size) {
    const or = [];
    if (seedCats.size) or.push({ category: { $in: [...seedCats] } });
    if (seedTags.size) or.push({ tags: { $in: [...seedTags] } });
    const docs = await Product.find({ $or: or }).select("_id").limit(200).lean();
    contentIds = docs.map((doc) => toId(doc._id));
  }

  // Store-curated products (featured/deals/new) are always eligible, so a
  // fresh deal can surface before it has a sales footprint.
  const boostDocs = await Product.find({
    $or: [{ isWeeklyDeal: true }, { isNewArrival: true }, { isFeatured: true }],
  })
    .select("_id")
    .limit(60)
    .lean();
  const boostIds = boostDocs.map((doc) => toId(doc._id));

  // Co-purchase: other products found in orders that also contain a seed item.
  const coCounts = new Map();
  if (seedRefs.length) {
    const coRows = await Order.aggregate([
      { $match: { status: { $ne: "cancelled" }, "items.product": { $in: seedRefs } } },
      { $unwind: "$items" },
      { $group: { _id: "$_id", inOrder: { $addToSet: "$items.product" } } },
      { $unwind: "$inOrder" },
      { $match: { inOrder: { $nin: seedRefs } } },
      { $group: { _id: "$inOrder", orders: { $sum: 1 } } },
    ]);
    for (const row of coRows) coCounts.set(toId(row._id), Number(row.orders) || 0);
  }
  const maxCo = Math.max(0, ...coCounts.values());

  // Fetch full documents for every candidate in one round trip.
  const candidateIds = new Set([
    ...contentIds,
    ...popularQty.keys(),
    ...coCounts.keys(),
    ...boostIds,
  ]);
  const docs = candidateIds.size
    ? await Product.find({ _id: { $in: [...candidateIds] } }).lean()
    : [];
  const byId = new Map(docs.map((doc) => [toId(doc._id), doc]));

  const scored = [];
  for (const doc of docs) {
    const id = toId(doc._id);
    if (Number(doc.countInStock ?? 0) <= 0) continue;

    const co = coCounts.get(id) || 0;
    const popular = popularQty.get(id) || 0;

    let content = 0;
    if (seedCats.has(doc.category)) content += 0.6;
    if (seedTags.size) {
      const tags = tagsOf(doc);
      const overlap = [...seedTags].filter((tag) => tags.has(tag)).length;
      const union = new Set([...seedTags, ...tags]);
      if (union.size) content += 0.4 * (overlap / union.size);
    }

    const avg = averageRating(doc);
    const deal = Boolean(doc.isWeeklyDeal);
    const isNew = Boolean(doc.isNewArrival);
    const rated = avg !== null && avg >= 4;
    let boost = 0;
    if (deal) boost += 0.6;
    if (isNew) boost += 0.3;
    if (rated) boost += 0.3;

    const coNorm = maxCo ? co / maxCo : 0;
    const popularNorm = maxPopular ? popular / maxPopular : 0;
    const finalScore = coNorm + content * 0.8 + popularNorm * 0.4 + boost;

    let reason = REASONS.POPULAR;
    if (coNorm > content && coNorm > 0) reason = REASONS.CO_PURCHASE;
    else if (content > 0 && content >= coNorm) reason = REASONS.SIMILAR;
    else if (deal && popularNorm === 0) reason = REASONS.DEAL;
    else if (isNew && popularNorm === 0) reason = REASONS.NEW;
    else if (rated && popularNorm === 0) reason = REASONS.RATED;
    else if (avg !== null && avg >= 4.5 && popularNorm > 0) reason = REASONS.RATED;

    scored.push({ id, product: groundProduct(doc), reason, finalScore });
  }

  scored.sort(
    (a, b) => b.finalScore - a.finalScore || String(a.id).localeCompare(String(b.id))
  );
  // Slice comfortably above the cap so exclusion filtering still fills `limit`.
  return scored.slice(0, MAX_LIMIT + 8);
}

export default computeRecommendations;