import React, { useContext } from "react";
import { CartContext } from "../context/CartContext";
import { ShoppingBasket } from "lucide-react";

const AddToCartButton = ({ product, className = "" }) => {
  const { addToCart } = useContext(CartContext);

  const soldOut = Number(product?.countInStock) === 0;

  return (
    <button
      type="button"
      onClick={() => addToCart(product)}
      disabled={soldOut}
      className={`add-to-cart mt-3 w-full min-w-0 overflow-hidden  px-2 py-2 text-[11px] sm:px-3 sm:text-sm ${className}`}
      aria-label={`Add ${product?.name || "Product"} to cart`}
    >
      <ShoppingBasket className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">
        {soldOut ? "Out of Stock" : "Add to Cart"}
      </span>
    </button>
  );
};

export default AddToCartButton;