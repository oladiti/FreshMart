import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import api from "../utils/api";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "./Button";
import AddToCartButton from "./AddToCartButton";
import Section from "./Section";
import SectionHeading from "./SectionHeading";

export default function NewArrivals() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsToShow, setItemsToShow] = useState(4);

  useEffect(() => {
    const fetchNewArrivals = async () => {
      try {
        const { data } = await api.get("/products/new");
        setProducts(Array.isArray(data) ? data : data?.products || []);
        setStatus("success");
      } catch (err) {
        console.error("Failed to load new arrivals:", err.message);
        setStatus("error");
      }
    };

    fetchNewArrivals();
  }, []);

  useEffect(() => {
    const updateItemsToShow = () => {
      if (window.innerWidth < 640) setItemsToShow(1);
      else if (window.innerWidth < 768) setItemsToShow(2);
      else if (window.innerWidth < 1024) setItemsToShow(3);
      else setItemsToShow(4);
    };

    updateItemsToShow();
    window.addEventListener("resize", updateItemsToShow);
    return () => window.removeEventListener("resize", updateItemsToShow);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex >= products.length - itemsToShow ? 0 : prevIndex + 1
    );
  }, [products.length, itemsToShow]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? products.length - itemsToShow : prevIndex - 1
    );
  }, [products.length, itemsToShow]);

  if (status === "loading") {
    return (
      <Section className="bg-cream">
        <div className="flex items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" />
        </div>
      </Section>
    );
  }

  if (status === "error" || products.length === 0) {
    return (
      <Section className="bg-cream">
        <SectionHeading
          eyebrow="Just In"
          title="New Arrivals"
          subtitle="Discover the latest additions to our shelves"
        />
        <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="font-medium text-rose-700">
            {status === "error"
              ? "Failed to load new arrivals"
              : "No new products available right now."}
          </p>
          {status === "error" && (
            <p className="mt-2 text-sm text-rose-600">
              Please try refreshing the page
            </p>
          )}
        </div>
      </Section>
    );
  }

  return (
    <Section className="bg-cream">
      <SectionHeading
        eyebrow="Just In"
        title="New Arrivals"
        subtitle="Discover the latest additions to our shelves"
      />

      <div className="relative">
        {products.length > itemsToShow && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous products"
              className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-primary-700 shadow-md ring-1 ring-gray-200 backdrop-blur transition-colors duration-200 hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next products"
              className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-primary-700 shadow-md ring-1 ring-gray-200 backdrop-blur transition-colors duration-200 hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        <div className="overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            >
              {products
                .slice(currentIndex, currentIndex + itemsToShow)
                .map((product, index) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    index={index}
                  />
                ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {products.length > itemsToShow && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {Array.from({
              length: Math.ceil(products.length / itemsToShow),
            }).map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => setCurrentIndex(index * itemsToShow)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  Math.floor(currentIndex / itemsToShow) === index
                    ? "w-6 bg-primary-600"
                    : "w-2 bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-12 text-center">
        <Link to="/new-arrivals">
          <Button>View All New Arrivals</Button>
        </Link>
      </div>
    </Section>
  );
}

function ProductCard({ product, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="product-card group"
    >
      <Link to={`/products/${product.slug}`} className="flex-1">
        <div className="relative overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onError={(e) => (e.target.src = "/images/placeholder.jpg")}
            className="h-56 w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {product.countInStock === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
              <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-gray-800">
                Sold out
              </span>
            </div>
          )}
        </div>

        <div className="p-5">
          <p className="text-lg font-bold text-gray-900">
            £{Number(product.price).toFixed(2)}
          </p>
          <p className="mt-1 line-clamp-2 text-gray-700 transition-colors group-hover:text-primary-700">
            {product.name}
          </p>
        </div>
      </Link>

      <div className="px-5 pb-5">
        <AddToCartButton product={product} />
      </div>
    </motion.div>
  );
}
