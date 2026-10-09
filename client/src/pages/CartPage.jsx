import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { CartContext } from "../context/CartContext";
import CartItem from "../components/CartItem";

export default function CartPage() {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalItems,
    totalAmount,
  } = useContext(CartContext);

  const isEmpty = !cart || cart.length === 0;
  const itemLabel = `${totalItems} item${totalItems === 1 ? "" : "s"}`;

  const handleClear = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Remove all items from your cart?")
    ) {
      clearCart();
    }
  };

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 py-10 lg:py-14">
        <nav
          className="mb-4 flex items-center gap-2 text-sm text-gray-500"
          aria-label="Breadcrumb"
        >
          <Link to="/" className="transition-colors hover:text-primary-700">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-gray-700">Cart</span>
        </nav>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gradient-green md:text-4xl">
              Your Cart
            </h1>
            <p className="mt-2 text-gray-600">
              {isEmpty ? "No items yet" : `${itemLabel} in your cart`}
            </p>
          </div>

          {!isEmpty && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-danger/30 hover:text-danger"
            >
              <Trash2 size={16} /> Clear cart
            </button>
          )}
        </div>

        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm"
          >
            <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <ShoppingBag size={30} />
            </span>
            <h2 className="text-xl font-semibold text-gray-900">
              Your cart is empty
            </h2>
            <p className="mt-2 text-gray-600">
              Looks like you haven&rsquo;t added anything yet. Start filling it
              with fresh groceries.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/shop"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-700"
              >
                Start shopping <ArrowRight size={18} />
              </Link>
              <Link
                to="/weekly-deals"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Browse weekly deals
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Cart items */}
            <div className="space-y-4" role="list" aria-label="Cart items">
              <AnimatePresence initial={false}>
                {cart.map((item) => (
                  <CartItem
                    key={item.id || item._id}
                    item={item}
                    updateQuantity={updateQuantity}
                    removeFromCart={removeFromCart}
                  />
                ))}
              </AnimatePresence>

              <Link
                to="/shop"
                className="inline-flex items-center gap-2 pt-1 text-sm font-medium text-primary-700 transition-colors hover:text-primary-800"
              >
                <ArrowRight className="rotate-180" size={16} /> Continue
                shopping
              </Link>
            </div>

            {/* Order Summary */}
            <aside className="h-fit lg:sticky lg:top-24">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">
                  Order Summary
                </h2>

                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <dt>Subtotal ({itemLabel})</dt>
                    <dd className="font-medium text-gray-900 tabular-nums">
                      £{Number(totalAmount || 0).toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <dt>Delivery</dt>
                    <dd className="font-medium text-success">Free</dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span className="tabular-nums">
                    £{Number(totalAmount || 0).toFixed(2)}
                  </span>
                </div>

                <Link
                  to="/checkout"
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-700"
                >
                  Proceed to Checkout <ArrowRight size={18} />
                </Link>

                <ul className="mt-5 space-y-2 text-xs text-gray-500">
                  <li className="flex items-center gap-2">
                    <ShieldCheck size={15} className="text-primary-600" />
                    Secure checkout
                  </li>
                  <li className="flex items-center gap-2">
                    <Truck size={15} className="text-primary-600" />
                    Free delivery on all orders
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
