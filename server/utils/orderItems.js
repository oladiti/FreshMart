// Validation helpers for cart/order line items, shared by the order and
// payment controllers so the two entry points can't drift apart.

// Upper bound on a single line's quantity. Guards against absurd values that
// would make the total/stock arithmetic meaningless.
export const MAX_ITEM_QUANTITY = 1000;

/**
 * Coerce a client-supplied quantity to a whole number in
 * [1, MAX_ITEM_QUANTITY]. Returns null when the value is invalid so callers
 * can respond with a 400. A missing/blank quantity defaults to 1 (a cart line
 * with no explicit amount), matching the previous behaviour.
 * @param {unknown} value
 * @returns {number|null}
 */
export const coerceQuantity = (value) => {
  if (value === undefined || value === null || value === '') return 1;
  const n = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_ITEM_QUANTITY) return null;
  return n;
};

/**
 * Aggregate requested quantities per product id. Duplicate lines for the same
 * product are summed so a caller cannot split a large order across several
 * lines to slip past the per-line stock check.
 * @param {Array<{ productId?: any, id?: any, quantity?: any }>} items
 * @returns {Map<string, number>} product id -> total quantity
 */
export const aggregateQuantities = (items) => {
  const totals = new Map();
  for (const item of items) {
    const id = String(item.productId ?? item.id ?? '');
    const quantity = coerceQuantity(item.quantity);
    if (quantity === null || !id) return null;
    totals.set(id, (totals.get(id) || 0) + quantity);
  }
  return totals;
};
