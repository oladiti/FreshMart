// Single source of truth for price formatting.
//
// The storefront currently hardcodes "£" in ~35 places across three different
// mechanisms (inline toFixed, a copy-pasted toLocaleString helper, and one
// Intl.NumberFormat). Everything new goes through here so there is one place to
// change. Existing call sites are deliberately left alone to keep this change
// scoped — ProductCard uses Intl with GBP, which renders identically.

export const CURRENCY_CODE = "GBP";
export const CURRENCY_SYMBOL = "£";

const formatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a number as a price.
 * @example formatPrice(12.5) // "£12.50"
 */
export function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${CURRENCY_SYMBOL}0.00`;
  return formatter.format(amount);
}

export default formatPrice;
