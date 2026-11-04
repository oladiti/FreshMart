import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, X } from "lucide-react";
import { CartContext } from "../context/CartContext";
import SafeImage from "./SafeImage";

// Inner contents of the cart preview, shared by the desktop header dropdown
// (see Navbar) and the mobile floating cart sheet (see FloatingCart). The
// caller owns positioning/width; this renders only the header, item list,
// totals and actions.
export function MiniCartBody({ onClose }) {
  const { cart, removeFromCart } = useContext(CartContext);

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <ShoppingCart className="h-4 w-4 text-primary-600" />
          Your Cart ({totalQuantity})
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cart"
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {cart.length === 0 ? (
        <p className="py-4 text-center text-gray-500">Your cart is empty</p>
      ) : (
        <>
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {cart.map((item) => (
              <div
                key={item.id || item._id}
                className="flex items-center justify-between border-b pb-2"
              >
                <div className="flex items-center gap-2">
                  <SafeImage
                    src={item.image}
                    alt={item.name}
                    className="h-12 w-12 rounded object-cover"
                  />
                  <div>
                    <p className="font-medium text-gray-700">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      £{item.price.toLocaleString()} × {item.quantity}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove ${item.name} from your cart?`)) {
                      removeFromCart(item.id || item._id, item.name);
                    }
                  }}
                  className="text-sm text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t pt-3">
            <div className="flex justify-between font-semibold text-gray-800">
              <span>Total:</span>
              <span>£{totalAmount.toLocaleString()}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                to="/cart"
                onClick={onClose}
                className="flex-1 rounded-full bg-gray-100 py-2 text-center font-semibold text-gray-700 transition-colors hover:bg-gray-200"
              >
                View Cart
              </Link>
              <Link
                to="/checkout"
                onClick={onClose}
                className="flex-1 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 py-2 text-center font-semibold text-white transition-colors hover:from-primary-700 hover:to-primary-800"
              >
                Checkout
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default MiniCartBody;
