import React from "react";
import { Link } from "react-router-dom";
import AddToCartButton from "./AddToCartButton";

const WeeklyDealCard = ({ product }) => {
  const soldOut = product.countInStock === 0;

  return (
    <div className="product-card group p-3">
      <Link
        to={`/products/${product.slug}`}
        className="flex flex-1 flex-col text-center"
      >
        <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-cream/70 py-4">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onError={(e) => (e.target.src = "/images/placeholder.jpg")}
            className="h-28 w-28 rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {soldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
              <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-gray-800">
                Sold out
              </span>
            </div>
          )}
        </div>
        <h4 className="mt-3 line-clamp-1 font-semibold text-gray-900 transition-colors group-hover:text-primary-700">
          {product.name}
        </h4>
        <p className="mt-1 font-bold text-leaf">
          £{Number(product.price).toFixed(2)}
        </p>
      </Link>

      <AddToCartButton product={product} />
    </div>
  );
};

export default WeeklyDealCard;