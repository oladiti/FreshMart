// components/CartItem.jsx
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";

const CartItem = React.memo(function CartItem({
  item,
  updateQuantity,
  removeFromCart,
}) {
  //  Normalize fields
  const id = item.id || item._id; // Support both id and _id
  const productSlug = item.slug; // Slug-only links: never expose _id in URLs
  const productPath = productSlug ? `/products/${productSlug}` : null;
  const name = item.name || "Unnamed Product";
  const image = item.image || item.img || "/images/placeholder.jpg"; // Fallback image
  const rawPrice = Number(item.price);
  const price = Number.isNaN(rawPrice) ? 0 : rawPrice; //  Safe price
  const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1; //  Ensure at least 1
  const lineTotal = price * quantity;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
      className="product-card p-3 sm:p-5"
      role="listitem"
    >
      <div className="flex gap-3 sm:gap-4 min-w-0">
        {productPath ? (
          <Link
            to={productPath}
            className="shrink-0 overflow-hidden rounded-xl"
          >
            <img
              src={image}
              alt={name}
              loading="lazy"
              onError={(e) => (e.target.src = "/images/placeholder.jpg")}
              className="h-20 w-20 object-cover transition-transform duration-300 hover:scale-105 sm:h-28 sm:w-28"
            />
          </Link>
        ) : (
          <div className="shrink-0 overflow-hidden rounded-xl">
            <img
              src={image}
              alt={name}
              loading="lazy"
              onError={(e) => (e.target.src = "/images/placeholder.jpg")}
              className="h-20 w-20 object-cover sm:h-28 sm:w-28"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {productPath ? (
                <Link
                  to={productPath}
                  className="line-clamp-2 font-semibold text-gray-900 transition-colors hover:text-primary-700"
                >
                  {name}
                </Link>
              ) : (
                <span className="line-clamp-2 font-semibold text-gray-900">
                  {name}
                </span>
              )}
              <p className="mt-1 text-sm text-gray-500">
                £{price.toFixed(2)} each
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeFromCart(id)}
              className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-danger-soft hover:text-danger"
              aria-label={`Remove ${name} from cart`}
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
            <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white shrink-0">
              <button
                type="button"
                onClick={() => updateQuantity(id, quantity - 1)}
                disabled={quantity <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-l-xl text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Decrease quantity of ${name}`}
              >
                <Minus size={16} />
              </button>
              <span
                className="w-10 text-center text-sm font-semibold tabular-nums text-gray-900"
                aria-live="polite"
                aria-label={`Quantity of ${name}`}
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(id, quantity + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-r-xl text-gray-600 transition-colors hover:bg-gray-50"
                aria-label={`Increase quantity of ${name}`}
              >
                <Plus size={16} />
              </button>
            </div>

            <p
              className="text-right text-base font-semibold text-gray-900 tabular-nums"
              aria-label={`Line total for ${name}`}
            >
              £{lineTotal.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default CartItem;
