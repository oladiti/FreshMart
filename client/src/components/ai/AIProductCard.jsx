import { Link } from "react-router-dom";
import { Plus, Check, ExternalLink } from "lucide-react";
import { formatPrice } from "../../utils/currency";

/**
 * Compact product card for AI assistant results.
 *
 * Deliberately not the storefront ProductCard: this sits in a narrow chat popup
 * and needs an inline add-to-cart affordance. Prices and stock are grounded by
 * the server (they are copies of real Product documents), but rendering trusts
 * those values as-is.
 */
export default function AIProductCard({ product, onAdd, added }) {
  const soldOut = Number(product?.countInStock) <= 0;
  const href = `/products/${product.slug || product._id}`;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
      <Link to={href} className="group flex min-w-0 flex-1 items-center gap-3">
        <img
          src={product.image}
          alt=""
          className="h-14 w-14 shrink-0 rounded-lg object-cover bg-gray-100"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-800 group-hover:text-primary-600">
            {product.name}
          </span>
          <span className="block truncate text-xs text-gray-500">
            {product.category}
            {Number(product.reviewCount) > 0
              ? ` · ${product.reviewCount} reviews`
              : ""}
          </span>
          <span className="mt-0.5 block text-sm font-semibold text-gray-900">
            {formatPrice(product.price)}
          </span>
        </span>
      </Link>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <Link
          to={href}
          aria-label={`View ${product.name}`}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View
        </Link>
        {onAdd ? (
          <button
            type="button"
            onClick={() => onAdd(product)}
            disabled={soldOut}
            aria-pressed={added}
            aria-label={
              soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`
            }
            className={`flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              added ? "bg-green-500" : "bg-primary-500 hover:bg-primary-600"
            }`}
          >
            {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {added ? "Added" : "Add"}
          </button>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              soldOut ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
            }`}
          >
            {soldOut ? "Sold out" : "In stock"}
          </span>
        )}
      </span>
    </li>
  );
}