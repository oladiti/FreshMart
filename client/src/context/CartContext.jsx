// context/CartContext.jsx
import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthContext } from "./AuthContext";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { user, loading } = useContext(AuthContext) || {};

  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  //  Determine the cart storage key once the auth state is known so we never
  //  accidentally read/write the guest key while a logged-in user's account
  //  key should be used.
  const cartKey = !loading ? (user ? `cart_${user._id}` : "guest_cart") : null;

  //  Wait for auth to resolve before loading the cart so the correct
  //  (account-specific) key is used, matching what gets persisted.
  const [cart, setCart] = useState([]);

  useEffect(() => {
    if (cartKey === null) return;
    try {
      const savedCart = localStorage.getItem(cartKey);
      setCart(savedCart ? JSON.parse(savedCart) : []);
    } catch (error) {
      console.error("Failed to parse cart from localStorage:", error);
      setCart([]);
    }
  }, [cartKey]);

  //  Save cart when changed (only once auth is resolved)
  useEffect(() => {
    if (cartKey === null) return;
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch (error) {
      console.error("Failed to save cart to localStorage:", error);
    }
  }, [cart, cartKey]);

  //  Add or update item quantity
  // If the caller passes an explicit quantityChange (a delta), use it (may be
  // negative to reduce quantity). Otherwise fall back to the product's own
  // `quantity` field (e.g. the product details page), defaulting to 1.
  const addToCart = useCallback((product, quantityChange) => {
    const id = product._id || product.id;

    const toAdd =
      quantityChange !== undefined
        ? Number(quantityChange) || 0
        : Math.max(Number(product.quantity) || 1, 0);

    if (!id || toAdd === 0) return;

    showToast(`${product.name} added to cart`);

    setCart((prevCart) => {
      const normalizedProduct = {
        id,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        image: product.image || product.img || "",
        price: Number(product.price) || 0,
      };

      const existing = prevCart.find((item) => item.id === id);

      if (existing) {
        // Update quantity (no negatives)
        const updated = prevCart.map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: Math.max(item.quantity + toAdd, 0),
              }
            : item
        );
        return updated.filter((item) => item.quantity > 0);
      }

      // Add new item
      if (toAdd > 0) {
        return [...prevCart, { ...normalizedProduct, quantity: toAdd }];
      }

      return prevCart;
    });
  }, [showToast]);

  //  Set an item's quantity to an absolute value (0 removes the item)
  const updateQuantity = useCallback((productId, newQuantity) => {
    setCart((prevCart) => {
      const qty = Math.max(Number(newQuantity) || 0, 0);
      if (qty === 0) {
        return prevCart.filter((item) => item.id !== productId);
      }
      return prevCart.map((item) =>
        item.id === productId ? { ...item, quantity: qty } : item
      );
    });
  }, []);

  //  Remove a product completely
  const removeFromCart = useCallback((productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  }, []);

  //  Replace the whole cart (used to mirror the server-side AI cart into the
  //  visible cart so both stay in sync).
  const replaceCart = useCallback((items) => {
    setCart(Array.isArray(items) ? items : []);
  }, []);

  //  Clear entire cart (e.g., on logout or checkout). Removes the guest key
  //  AND every account-specific cart key so no stale copy survives a reload.
  const clearCart = useCallback(() => {
    setCart([]);
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key === "guest_cart" || key.startsWith("cart_")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error("Failed to clear cart:", error);
    }
  }, []);

  //  Derived cart values
  const { totalItems, totalAmount } = useMemo(() => {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    return { totalItems, totalAmount };
  }, [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        replaceCart,
        clearCart,
        totalItems,
        totalAmount,
        showToast,
      }}
    >
      {children}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </CartContext.Provider>
  );
};

function Toast({ toast, onClose }) {
  return (
    <AnimatePresence>
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4">
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            onClick={onClose}
            className={`pointer-events-auto flex w-full max-w-md cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 font-medium text-white shadow-2xl sm:gap-3 sm:px-5 sm:py-3 ${
              toast.type === "error"
                ? "bg-red-600"
                : "bg-success"
            }`}
            role="status"
            aria-live="polite"
          >
            <span className="shrink-0 text-lg leading-none">
              {toast.type === "error" ? "" : "Added"}
            </span>
            <span className="min-w-0 flex-1 break-words text-sm sm:text-base">
              {toast.message}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="ml-1 shrink-0 text-sm text-white/80 hover:text-white sm:ml-2"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
