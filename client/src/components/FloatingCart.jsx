import React, { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { CartContext } from "../context/CartContext";
import { MiniCartBody } from "./MiniCart";

// Mobile-only quick access to the cart. Desktop already has the header cart
// icon, so this stays hidden at md and up. It only appears once the cart has
// items, and opens the shared mini-cart as a bottom sheet.
export default function FloatingCart() {
  const { totalItems } = useContext(CartContext) || {};
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the sheet whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the sheet.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!totalItems) return null;

  const itemLabel = `${totalItems} item${totalItems === 1 ? "" : "s"}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Open cart, ${itemLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        className="fixed bottom-5 left-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-600/30 transition-transform hover:-translate-y-0.5 md:hidden"
      >
        <ShoppingCart className="h-6 w-6" />
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-white">
          {totalItems}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] md:hidden">
          <div
            className="absolute inset-0 bg-black/40 animate-fadeIn"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cart"
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
            }}
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-gray-100 bg-white p-4 shadow-2xl animate-fadeIn"
          >
            <MiniCartBody onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
