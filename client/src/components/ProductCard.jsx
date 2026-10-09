import React, { memo } from "react";
import AddToCartButton from "./AddToCartButton";

const ProductCard = memo(function ProductCard({ product }) {
  // Format price once (prevents recalculations on re-renders)
  const formattedPrice = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(product.price);

  const soldOut = product.countInStock === 0;

  return (
    <div
      className="product-card group"
      role="group"
      aria-label={product.name}
    >
      <figure className="relative m-2.5 overflow-hidden rounded-xl bg-cream/70">
        <img
          src={product.image}
          alt={product.name || "Product"}
          loading="lazy"
          onError={(e) => (e.target.src = "/images/placeholder.jpg")}
          className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
            <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-gray-800">
              Sold out
            </span>
          </div>
        )}
      </figure>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 transition-colors group-hover:text-primary-700">
          {product.name}
        </h3>
        <p className="mt-1 text-base font-bold text-leaf">{formattedPrice}</p>

        <AddToCartButton product={product} />
      </div>
    </div>
  );
});

export default ProductCard;