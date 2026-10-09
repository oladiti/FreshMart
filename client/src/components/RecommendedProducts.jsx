import { useContext, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
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
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="product-card animate-pulse">
              <div className="h-40 w-full bg-gray-200 sm:h-44" />
              <div className="space-y-2 p-4">
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

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        {items.map((entry) => (
          <motion.div
            key={entry.product._id}
            variants={fadeUp}
            whileHover={{ y: -5 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="product-card group"
          >
            <Link to={`/products/${entry.product.slug}`} className="flex-1">
              <div className="relative overflow-hidden">
                <img
                  src={entry.product.image || "/images/placeholder.jpg"}
                  alt={entry.product.name}
                  loading="lazy"
                  onError={(e) => (e.target.src = "/images/placeholder.jpg")}
                  className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105 sm:h-44"
                />
                {Number(entry.product.countInStock) === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-gray-800">
                      Sold out
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 transition-colors group-hover:text-primary-700">
                  {entry.product.name}
                </h3>
                <p className="mt-1.5 text-base font-bold text-leaf">
                  £{Number(entry.product.price).toFixed(2)}
                </p>
                {entry.reason && (
                  <p className="mt-1 text-xs text-gray-400">{entry.reason}</p>
                )}
              </div>
            </Link>
            <div className="px-4 pb-4">
              <AddToCartButton product={entry.product} />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}