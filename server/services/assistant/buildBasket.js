// Greedy budget basket builder.
//
// Shared by the rule-based assistant (assistantController) and the AI shopping
// tools, so both fill a basket with the same variety-first rule: pick the
// best-rated, cheapest items first, never more than a couple from any one
// category, and never let the running total exceed the budget. The caller owns
// what each product looks like on the way out; this module only reads `price`,
// `category` and `averageRating` and never touches the database.

const round2 = (value) => Number(value.toFixed(2));

/**
 * Fill a basket from a pool of products within a budget.
 *
 * @param {Array<object>} products candidate products (already grounded by the caller)
 * @param {number} budget the hard ceiling
 * @param {{maxPerCategory?: number, maxItems?: number, mapItem?: (product: object) => object}} [options]
 * @returns {{items: object[], total: number, budget: number, remaining: number}}
 */
export function buildBasket(products, budget, options = {}) {
  const maxPerCategory = Number(options.maxPerCategory) > 0 ? Number(options.maxPerCategory) : 2;
  const maxItems = Number(options.maxItems) > 0 ? Number(options.maxItems) : 8;
  const mapItem = typeof options.mapItem === "function" ? options.mapItem : (product) => product;

  const perCategory = new Map();
  const items = [];
  let total = 0;

  // averageRating comes from the product's own reviews via the grounding layer.
  const pool = [...(Array.isArray(products) ? products : [])].sort((a, b) => {
    const ratingDiff = (b.averageRating ?? 0) - (a.averageRating ?? 0);
    if (ratingDiff !== 0) return ratingDiff;
    return (a.price || 0) - (b.price || 0);
  });

  for (const product of pool) {
    const price = Number(product?.price || 0);
    if (items.length >= maxItems) break;
    if (total + price > budget) continue;
    const category = product?.category || "Other";
    const used = perCategory.get(category) || 0;
    if (used >= maxPerCategory) continue;
    perCategory.set(category, used + 1);
    total = round2(total + price);
    items.push({ ...mapItem(product), lineTotal: total });
  }

  return {
    items,
    total,
    budget,
    remaining: round2(budget - total),
  };
}

export default buildBasket;
