import { useCallback, useContext, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "../utils/api";
import { CartContext } from "../context/CartContext";
import AddToCartButton from "./AddToCartButton";
import Section from "./Section";
import SectionHeading from "./SectionHeading";
import { containerVariants, fadeUp } from "../utils/animations";

/**
 * "Recommended for you" (or "Popular right now" for guests) product row.
 *
 * Backed by GET /api/recommendations, which is personalised for signed-in
 * shoppers and safe to render for anonymous visitors. Renders nothing at all
 * while loading, on error, or when the store has no picks worth showing.
 */
export default function RecommendedProducts({ seedProductId }) {
  const { cart } = useContext(CartContext) || {};
  const [items, setItems] = useState([]);
  const [personalized, setPersonalized] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsToShow, setItemsToShow] = useState(4);

  // Only the *ids* of the cart matter for exclusion. Deriving a primitive
  // string key means quantity changes don't retrigger the fetch.
  const cartIds = (Array.isArray(cart) ? cart : [])
    .map((item) => item?.id)
    .filter((id) => typeof id === "string" && id)
    .join(",");

  useEffect(() => {
    let active = true;
    setReady(false);

    const params = new URLSearchParams();
    params.set("limit", "8");
    if (seedProductId) params.set("seed", seedProductId);
    if (cartIds) params.set("exclude", cartIds);

    api
      .get(`/recommendations?${params.toString()}`)
      .then(({ data }) => {
        if (!active) return;
        setItems(Array.isArray(data.recommendations) ? data.recommendations : []);
        setPersonalized(Boolean(data.personalized));
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setReady(true);
      });

    return () => {
      active = false;
    };
  }, [seedProductId, cartIds]);

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

  useEffect(() => {
    setCurrentIndex(0);
  }, [items.length, itemsToShow]);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex >= items.length - itemsToShow ? 0 : prevIndex + 1
    );
  }, [items.length, itemsToShow]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? items.length - itemsToShow : prevIndex - 1
    );
  }, [items.length, itemsToShow]);

  if (!ready) {
    return (
      <Section className="bg-cream">
        <SectionHeading
          eyebrow="Picks Just For You"
          title="Recommended for you"
          subtitle="Finding the best picks for your basket"
        />
        <div
          data-testid="rec-skeleton"
          aria-hidden="true"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="product-card animate-pulse">
              <div className="h-56 w-full bg-gray-200" />
              <div className="space-y-2 p-5">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-4 w-1/3 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (items.length === 0) return null;

  const title = seedProductId
    ? "You may also like"
    : personalized
    ? "Recommended for you"
    : "Popular right now";

  const eyebrow = seedProductId
    ? "Pairs Well"
    : personalized
    ? "Picks Just For You"
    : "Trending";

  const subtitle = seedProductId
    ? "Shoppers who bought this often pick these too"
    : personalized
    ? "Based on what you’ve ordered before"
    : "Favourites our customers love right now";

  return (
    <Section className="bg-cream">
      <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />

      <div className="relative">
        {items.length > itemsToShow && (
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
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            >
              {items
                .slice(currentIndex, currentIndex + itemsToShow)
                .map((entry) => (
                  <motion.div
                    key={entry.product._id}
                    variants={fadeUp}
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="product-card group"
                  >
                    <Link
                      to={`/products/${entry.product.slug}`}
                      className="flex-1"
                    >
                      <div className="relative overflow-hidden">
                        <img
                          src={entry.product.image || "/images/placeholder.jpg"}
                          alt={entry.product.name}
                          loading="lazy"
                          onError={(e) =>
                            (e.target.src = "/images/placeholder.jpg")
                          }
                          className="h-56 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {Number(entry.product.countInStock) === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
                            <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-gray-800">
                              Sold out
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 transition-colors group-hover:text-primary-700">
                          {entry.product.name}
                        </h3>
                        <p className="mt-1.5 text-lg font-bold text-leaf">
                          £{Number(entry.product.price).toFixed(2)}
                        </p>
                        {entry.reason && (
                          <p className="mt-1 text-xs text-gray-400">
                            {entry.reason}
                          </p>
                        )}
                      </div>
                    </Link>
                    <div className="px-5 pb-5">
                      <AddToCartButton product={entry.product} />
                    </div>
                  </motion.div>
                ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {items.length > itemsToShow && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {Array.from({
              length: Math.ceil(items.length / itemsToShow),
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
    </Section>
  );
}