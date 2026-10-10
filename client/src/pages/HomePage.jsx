import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FaQuoteLeft, FaEnvelope, FaStar } from "react-icons/fa";
import WeeklyDealCard from "../components/WeeklyDealCard";
import Button from "../components/Button";
import AddToCartButton from "../components/AddToCartButton";
import api from "../utils/api";
import NewArrivals from "../components/NewArrivals";
import RecommendedProducts from "../components/RecommendedProducts";
import Section from "../components/Section";
import SectionHeading from "../components/SectionHeading";
import useNewsletter from "../hooks/useNewsletter";
import { containerVariants, fadeUp } from "../utils/animations";
import FreshMartBanner from "../components/FreshMartBanner";
import CategorySection from "../components/CategorySection";


const testimonials = [
  {
    name: "Sarah Johnson",
    review:
      "I love how quick and fresh my groceries arrive! Definitely my go-to grocery store.",
  },
  {
    name: "David Smith",
    review:
      "Excellent service and the best prices. I recommend this to all my friends!",
  },
  {
    name: "Mary K.",
    review:
      "Fast delivery and top-quality products. It’s like shopping at a market from home!",
  },
];

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [weeklyDeals, setWeeklyDeals] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Only the featured row is shown here, so ask for just those products
        // instead of downloading the whole catalogue.
        const { data } = await api.get("/products/featured");
        let productList = Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
          ? data.products
          : [];

        // If the store hasn't flagged anything as featured, fall back to the
        // three newest products rather than leaving the row empty.
        if (productList.length === 0) {
          const { data: fallback } = await api.get("/products?limit=3");
          productList = Array.isArray(fallback)
            ? fallback
            : Array.isArray(fallback?.products)
            ? fallback.products
            : [];
        }

        setProducts(productList);
      } catch (err) {
        console.error("Failed to fetch products:", err.message);
        setProducts([]);
      }
    };

    const fetchWeeklyDeals = async () => {
      try {
        const { data } = await api.get("/products/weekly-deals");
        const deals = Array.isArray(data) ? data : data?.deals || [];
        setWeeklyDeals(deals);
      } catch (err) {
        console.error("Failed to fetch weekly deals:", err.message);
        setWeeklyDeals([]);
      }
    };

    fetchProducts();
    fetchWeeklyDeals();
  }, []);

  const featured = products.filter((p) => p.isFeatured);
  const featuredProducts = featured.length
    ? featured.slice(0, 3)
    : products.slice(0, 3);
  const previewDeals = weeklyDeals.slice(0, 4);

  const {
    email,
    changeEmail,
    status: newsletterStatus,
    submitting: subscribing,
    subscribe: handleSubscribe,
  } = useNewsletter("home");

  return (
    <motion.div
      className="min-h-screen bg-cream text-gray-800"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <FreshMartBanner />
      <CategorySection />

      <Section className="bg-white">
        <SectionHeading
          eyebrow="Top Picks"
          title="Featured Products"
          subtitle="Handpicked favourites our customers love"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {featuredProducts.length > 0 ? (
            featuredProducts.map((product) => (
              <motion.div
                key={product._id || product.name}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="product-card group"
              >
                <Link to={`/products/${product.slug}`} className="flex-1">
                  <div className="relative overflow-hidden">
                    <img
                      src={
                        product.image ||
                        product.img ||
                        product.imageUrl ||
                        "/images/placeholder.jpg"
                      }
                      alt={product.name}
                      loading="lazy"
                      onError={(e) =>
                        (e.target.src = "/images/placeholder.jpg")
                      }
                      className="h-56 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {product.category && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-leaf shadow-sm backdrop-blur-sm">
                        {product.category}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="line-clamp-1 text-lg font-semibold text-gray-900 transition-colors group-hover:text-primary-700">
                      {product.name}
                    </h3>
                    <p className="mt-2 text-xl font-bold text-leaf">
                      £{Number(product.price).toFixed(2)}
                    </p>
                  </div>
                </Link>

                <div className="px-5 pb-5">
                  <AddToCartButton product={product} />
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-gray-500">
              No featured products available
            </div>
          )}
        </motion.div>

        <div className="mt-12 text-center">
          <Link to="/shop">
            <Button>View All Products</Button>
          </Link>
        </div>
      </Section>

      <NewArrivals />

      <RecommendedProducts />

      <Section className="bg-white">
        <SectionHeading
          eyebrow="Save More"
          title="Weekly Deals"
          subtitle="Fresh savings on your weekly essentials"
        />

        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4"
        >
          {previewDeals.length > 0 ? (
            previewDeals.map((deal) => (
              <WeeklyDealCard product={deal} key={deal._id || deal.name} />
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-gray-500">
              No weekly deals available
            </div>
          )}
        </motion.div>

        {weeklyDeals.length > 3 && (
          <div className="mt-12 text-center">
            <Link to="/weekly-deals">
              <Button>View All Deals</Button>
            </Link>
          </div>
        )}
      </Section>

      <Section className="bg-cream">
        <SectionHeading
          eyebrow="Testimonials"
          title="What Our Customers Say"
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              whileHover={{ y: -5 }}
              className="product-card p-7 text-center"
            >
              <div className="flex items-center justify-center gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, s) => (
                  <FaStar key={s} className="h-4 w-4" />
                ))}
              </div>
              <FaQuoteLeft className="mx-auto mt-4 text-2xl text-primary-200" />
              <p className="mt-3 italic leading-relaxed text-gray-600">
                “{t.review}”
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white shadow-md">
                  {t.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900">{t.name}</h4>
                  <p className="text-xs text-gray-400">Verified Customer</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section className="relative overflow-hidden bg-gray-900">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative">
          <SectionHeading
            tone="light"
            eyebrow="Newsletter"
            title="Join Our Newsletter"
            subtitle="Subscribe to get exclusive discounts and updates on our latest deals."
          />

          <form
            onSubmit={handleSubscribe}
            className="mx-auto flex max-w-xl flex-col items-center gap-4 md:flex-row"
          >
            <label htmlFor="home-newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="home-newsletter-email"
              type="email"
              placeholder="Enter your email"
              required
              value={email}
              onChange={(e) => changeEmail(e.target.value)}
              aria-label="Email address"
              className="w-full rounded-full border border-white/15 bg-white/10 px-5 py-3 text-white caret-primary-300 placeholder:text-gray-400 backdrop-blur-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/60 md:flex-1"
            />
            <button
              type="submit"
              disabled={subscribing}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-7 py-3 text-base font-semibold text-gray-900 shadow-lg shadow-amber-500/30 transition hover:from-amber-300 hover:to-amber-400 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:opacity-60"
            >
              <FaEnvelope className="h-4 w-4" />
              {subscribing ? "Subscribing…" : "Subscribe"}
            </button>
          </form>

          {newsletterStatus && (
            <p
              role="status"
              className={`mx-auto mt-4 max-w-xl text-center text-sm ${
                newsletterStatus.type === "success"
                  ? "text-primary-200"
                  : "text-red-300"
              }`}
            >
              {newsletterStatus.text}
            </p>
          )}

          <p className="mt-4 text-center text-xs text-gray-500">
            No spam — just fresh offers and seasonal picks.
          </p>
        </div>
      </Section>
    </motion.div>
  );
};

export default HomePage;
