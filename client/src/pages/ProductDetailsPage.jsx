import React, { useState, useEffect, useContext, useCallback } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Star } from "lucide-react";
import api from "../utils/api";
import { CartContext } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import RecommendedProducts from "../components/RecommendedProducts";

const MAX_COMMENT_LENGTH = 1000;

//  Shared motion language for every image on this page. One easing curve and a
//  small set of springs keep the feel consistent (and tunable in one place).
const EASE_OUT = [0.22, 1, 0.36, 1];
const SPRING = { type: "spring", stiffness: 140, damping: 20 };
const THUMB_SPRING = { type: "spring", stiffness: 320, damping: 26 };
const HOVER_SPRING = { type: "spring", stiffness: 300, damping: 24 };

//  Swap in the placeholder at most once per element so a missing placeholder
//  can never trigger an infinite error loop.
const handleImageError = (e) => {
  const el = e.currentTarget;
  if (el.dataset.fallbackApplied) return;
  el.dataset.fallbackApplied = "true";
  el.src = "/images/placeholder.jpg";
};

const galleryVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: EASE_OUT,
      staggerChildren: 0.07,
      delayChildren: 0.25,
    },
  },
};

const thumbVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1, transition: THUMB_SPRING },
};

const relatedVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const relatedCardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: SPRING },
};

const formatReviewDate = (value) => {
  if (!value) return "No date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleDateString();
};

export default function ProductDetailsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeImage, setActiveImage] = useState(null);

  //  Srcs whose pixels are decoded and cached. Drives the load-gated
  //  crossfade so the gallery never animates in a blank frame.
  const [loadedSrcs, setLoadedSrcs] = useState(() => new Set());
  const markImageLoaded = useCallback((src) => {
    setLoadedSrcs((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
  }, []);

  //  Review form state. `showReviewForm` starts collapsed so the "Be the first
  //  to review" call-to-action stays the visible entry point.
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewStatus, setReviewStatus] = useState({ type: null, text: "" });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setActiveImage(null);
        const response = await api.get(`/products/${slug}`);

        //  The API returns the product as a flat object in response.data
        if (!response.data) {
          setError("Product not found");
        } else {
          // Canonicalize the URL: id-based links (e.g. /products/<_id>) point
          // at the slug so the address bar always shows the clean slug.
          if (response.data.slug && response.data.slug !== slug) {
            navigate(`/products/${response.data.slug}`, { replace: true });
          }
          setProduct(response.data);
        }
      } catch (err) {
        console.error("API Error:", err);
        setError("Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug, navigate]);

  //  Warm the browser cache (and the ready-set) for every gallery image up
  //  front so switching thumbnails crossfades instantly instead of waiting
  //  on the network.
  useEffect(() => {
    if (!product) return;
    const srcs = new Set(
      [product.image, ...(product.images || [])].filter(Boolean)
    );
    srcs.forEach((src) => {
      const img = new window.Image();
      img.onload = () =>
        setLoadedSrcs((prev) =>
          prev.has(src) ? prev : new Set(prev).add(src)
        );
      img.src = src;
    });
  }, [product]);

  //  Safe data extraction
  const getProductData = () => {
    if (!product) return {};

    return {
      name: product.name || "Unnamed Product",
      price: product.price || 0,
      description: product.description || "No description available",
      image: product.image || (product.images && product.images[0]) || "/images/placeholder.jpg",
      images: product.images || [],
      nutrition: product.nutrition || {},
      reviews: product.reviews || [],
      related: product.related || [],
      category: product.category,
      inStock: product.countInStock,
    };
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart(
        {
          id: product._id || product.id,
          name: product.name,
          image: product.image || (product.images && product.images[0]) || "",
          price: product.price,
        },
        quantity
      );
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    }
  };

  //  The current user's own review, if any. Used to switch the form into
  //  "edit" mode and to label their entry in the list.
  const ownReview = (product?.reviews || []).find(
    (r) => r.user?._id && r.user._id === user?._id
  );

  const openReviewForm = () => {
    if (ownReview) {
      setRating(ownReview.rating);
      setComment(ownReview.comment || "");
    } else {
      setRating(0);
      setComment("");
    }
    setReviewStatus({ type: null, text: "" });
    setShowReviewForm(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setReviewStatus({ type: "error", text: "Please choose a star rating." });
      return;
    }
    if (!comment.trim()) {
      setReviewStatus({ type: "error", text: "Please write a short review." });
      return;
    }

    setSubmittingReview(true);
    setReviewStatus({ type: null, text: "" });
    try {
      const { data } = await api.post(`/products/${product._id}/reviews`, {
        rating,
        comment: comment.trim(),
      });
      //  The endpoint returns the full review list, so swap it in rather than
      //  refetching the whole product.
      if (Array.isArray(data.reviews)) {
        setProduct((prev) => ({ ...prev, reviews: data.reviews }));
      }
      setReviewStatus({
        type: "success",
        text: data.message || "Thanks for your review!",
      });
      setShowReviewForm(false);
    } catch (err) {
      setReviewStatus({
        type: "error",
        text:
          err.response?.data?.message ||
          "Something went wrong saving your review. Please try again.",
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div
        className="container mx-auto px-4 py-4 animate-pulse"
        aria-busy="true"
        aria-label="Loading product"
      >
        <div className="mb-6 flex items-center gap-2">
          <div className="h-4 w-14 rounded bg-gray-200" />
          <span aria-hidden="true">/</span>
          <div className="h-4 w-14 rounded bg-gray-200" />
          <span aria-hidden="true">/</span>
          <div className="h-4 w-24 rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="h-72 md:h-96 rounded-lg bg-gray-200" />
            <div className="mt-4 flex gap-3">
              <div className="h-20 w-20 rounded-lg bg-gray-200" />
              <div className="h-20 w-20 rounded-lg bg-gray-200" />
              <div className="h-20 w-20 rounded-lg bg-gray-200" />
            </div>
          </div>
          <div className="flex flex-col justify-center space-y-4">
            <div className="h-8 w-3/4 rounded bg-gray-200" />
            <div className="h-6 w-24 rounded bg-gray-300" />
            <div className="mt-2 space-y-2">
              <div className="h-3 w-full rounded bg-gray-200" />
              <div className="h-3 w-5/6 rounded bg-gray-200" />
              <div className="h-3 w-2/3 rounded bg-gray-200" />
            </div>
            <div className="h-11 w-44 rounded-lg bg-gray-200" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-48 rounded-lg bg-gray-200" />
          <div className="h-48 rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold text-red-600">
          {error || "Product not found"}
        </h2>
        <p className="text-gray-600 mt-2">
          The product you're looking for doesn't exist or is unavailable.
        </p>
        <button
          onClick={() => navigate("/shop")}
          className="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg"
        >
          Back to Shop
        </button>
      </div>
    );
  }

  const {
    name,
    price,
    description,
    image,
    images,
    nutrition,
    reviews,
    related
  } = getProductData();

  const currentImage =
    activeImage && images.includes(activeImage) ? activeImage : image;
  const isImageReady = loadedSrcs.has(currentImage);

  return (
    <MotionConfig reducedMotion="user">
    <div className="container mx-auto px-4 py-4">
      <nav
        className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-500"
        aria-label="Breadcrumb"
      >
        <Link to="/" className="transition-colors hover:text-primary-700">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          to="/shop"
          className="transition-colors hover:text-primary-700"
        >
          Shop
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-gray-700 line-clamp-1">{name}</span>
      </nav>
      {/* Product Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image Section */}
        <motion.div
          variants={galleryVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="relative w-full h-72 md:h-96 rounded-lg shadow-md overflow-hidden bg-gray-100">
            {/* Shimmer stands in until the current image's pixels are ready,
                so the crossfade never reveals an empty frame. */}
            {!isImageReady && (
              <div
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden bg-gray-200"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                />
              </div>
            )}
            <AnimatePresence>
              <motion.img
                key={currentImage}
                src={currentImage}
                alt={name}
                draggable={false}
                onError={handleImageError}
                onLoad={() => markImageLoaded(currentImage)}
                ref={(el) => {
                  //  Belt-and-braces: a cached image can finish decoding
                  //  before React attaches onLoad.
                  if (el && el.complete && el.naturalWidth > 0) {
                    markImageLoaded(currentImage);
                  }
                }}
                initial={{ opacity: 0, scale: 1.06 }}
                animate={
                  isImageReady
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 1.06 }
                }
                exit={{
                  opacity: 0,
                  scale: 0.97,
                  transition: { duration: 0.35, ease: "easeOut" },
                }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
                whileHover={{ scale: 1.04 }}
                className="absolute inset-0 h-full w-full object-cover select-none"
              />
            </AnimatePresence>
          </div>

          {/* Thumbnail Gallery */}
          {images && images.length > 1 && (
            <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <motion.button
                  key={idx}
                  type="button"
                  variants={thumbVariants}
                  onClick={() => setActiveImage(img)}
                  aria-label={`View image ${idx + 1} of ${name}`}
                  aria-pressed={img === currentImage}
                  whileHover={{ scale: 1.08, y: -3, transition: HOVER_SPRING }}
                  whileTap={{ scale: 0.94, transition: { duration: 0.1 } }}
                  className="relative shrink-0 rounded-lg bg-gray-100 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <img
                    src={img}
                    alt={`${name} ${idx + 1}`}
                    draggable={false}
                    onError={handleImageError}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  {img === currentImage && (
                    <motion.span
                      layoutId="active-thumbnail-ring"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                      className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary-600"
                    />
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Product Info Section */}
        <div className="flex flex-col justify-center">
          <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
          <p className="text-primary-600 text-xl font-semibold mt-2">
            £{typeof price === 'number' ? price.toFixed(2) : price}
          </p>
          
          {/*  Description Section - Now should show actual data */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-gray-800">Description</h3>
            <p className="text-gray-700 mt-2 leading-relaxed whitespace-pre-line">
              {description}
            </p>
          </div>

          {/* Quantity + Add to Cart */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="quantity" className="text-gray-700 font-medium">
                  Quantity:
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  max={product.countInStock || 999}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(
                        1,
                        parseInt(e.target.value) ||
                          1
                      )
                    )
                  }
                  className="w-20 px-2 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-center"
                />
              </div>
              <button
                onClick={handleAddToCart}
                className="flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg shadow-md shadow-primary-600/20 transition font-medium"
              >
                Add to Cart
              </button>
            </div>
            {addedToCart && (
              <p className="mt-3 text-success font-medium">
                {quantity} × {name} added to cart ✓
              </p>
            )}
        </div>
      </div>

      {/* Additional Product Details */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Nutrition Facts */}
        {nutrition && Object.keys(nutrition).length > 0 && (
          <div className="bg-gray-50 rounded-lg p-6 shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">
              Nutrition Facts
            </h2>
            <ul className="text-gray-700 space-y-2">
              {Object.entries(nutrition).map(([key, value]) => (
                <li key={key} className="flex justify-between border-b pb-2">
                  <span className="capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="text-primary-600">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Product Features */}
        <div className="bg-white rounded-lg p-6 shadow border">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">
            Product Details
          </h2>
          <ul className="text-gray-700 space-y-2">
            <li className="flex justify-between border-b pb-2">
              <span className="font-medium">SKU:</span>
              <span>{product.sku || "N/A"}</span>
            </li>
            {product.brand && (
              <li className="flex justify-between border-b pb-2">
                <span className="font-medium">Brand:</span>
                <span>{product.brand}</span>
              </li>
            )}
          </ul>
        {/* </div> */}
          
          <ul className="text-gray-700 space-y-2">
            <li className="flex justify-between border-b pb-2">
              <span className="font-medium">Category:</span>
              <span>{product.category || "N/A"}</span>
            </li>
            <li className="flex justify-between border-b pb-2">
              <span className="font-medium">In Stock:</span>
              <span>
                {Number(product.countInStock) > 0 ? "Yes" : "No"}
                {Number(product.countInStock) > 0 &&
                  ` (${product.countInStock})`}
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Customer Reviews */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Customer Reviews
        </h2>

        {reviewStatus.text && (
          <p
            role="status"
            className={`mb-4 rounded-lg border p-3 text-sm ${
              reviewStatus.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {reviewStatus.text}
          </p>
        )}

        {reviews && reviews.length > 0 ? (
          <div className="space-y-6">
            {reviews.map((review) => (
              <div key={review._id} className="bg-white p-4 rounded-lg shadow border">
                <div className="flex justify-between items-start">
                  <p className="text-gray-900 font-semibold">
                    {review.user?.name || "Anonymous"}
                    {review.user?._id && review.user._id === user?._id && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        (your review)
                      </span>
                    )}
                  </p>
                  <p className="text-yellow-500 text-sm">
                    Rating: {review.rating || 0}/5
                  </p>
                </div>
                <p className="text-gray-700 mt-2">{review.comment}</p>
                <p className="text-gray-500 text-sm mt-2">
                  {formatReviewDate(review.createdAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No reviews yet.</p>
            {user ? (
              !showReviewForm && (
                <button
                  type="button"
                  onClick={openReviewForm}
                  className="mt-2 text-primary-600 hover:text-primary-700 font-medium"
                >
                  Be the first to review
                </button>
              )
            ) : (
              <p className="mt-2">
                <Link
                  to="/login"
                  state={{ from: location }}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Log in to write a review
                </Link>
              </p>
            )}
          </div>
        )}

        {/*  CTA shown once reviews already exist */}
        {reviews && reviews.length > 0 && !showReviewForm && (
          <div className="mt-6">
            <button
              type="button"
              onClick={openReviewForm}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              {ownReview ? "Edit your review" : "Write a review"}
            </button>
          </div>
        )}

        {showReviewForm && (
          <form
            onSubmit={handleReviewSubmit}
            aria-label={ownReview ? "Edit your review" : "Write a review"}
            className="mt-6 bg-white p-4 rounded-lg shadow border space-y-4"
          >
            <fieldset>
              <legend className="text-gray-800 font-medium">
                Your rating
                <span className="text-red-500 ml-1">*</span>
              </legend>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label
                    key={value}
                    className="cursor-pointer p-1 text-yellow-500"
                    title={`${value} star${value > 1 ? "s" : ""}`}
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={value}
                      checked={rating === value}
                      onChange={() => setRating(value)}
                      className="sr-only"
                    />
                    <Star
                      size={26}
                      aria-hidden="true"
                      fill={value <= rating ? "currentColor" : "none"}
                    />
                    <span className="sr-only">{value} out of 5</span>
                  </label>
                ))}
                <span className="ml-2 text-sm text-gray-600">
                  {rating ? `${rating}/5` : "Select a rating"}
                </span>
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="review-comment"
                className="block text-gray-800 font-medium"
              >
                Your review
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                id="review-comment"
                rows={4}
                value={comment}
                maxLength={MAX_COMMENT_LENGTH}
                onChange={(e) => {
                  setComment(e.target.value);
                  setReviewStatus({ type: null, text: "" });
                }}
                className="mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <p className="mt-1 text-right text-xs text-gray-500">
                {comment.length}/{MAX_COMMENT_LENGTH}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submittingReview}
                className="bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg font-medium"
              >
                {submittingReview
                  ? "Saving…"
                  : ownReview
                    ? "Update review"
                    : "Submit review"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReviewForm(false);
                  setReviewStatus({ type: null, text: "" });
                }}
                className="px-5 py-2 rounded-lg border font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Related Products */}
      {related && related.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            You Might Also Like
          </h2>
          <motion.div
            variants={relatedVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {related.map((item, index) => (
              <motion.div
                key={item._id || item.id || index}
                variants={relatedCardVariants}
                onClick={() => navigate(`/products/${item.slug}`)}
                whileHover={{ y: -6, transition: HOVER_SPRING }}
                className="bg-white rounded-lg shadow hover:shadow-lg transition p-3 cursor-pointer"
              >
                <div className="overflow-hidden rounded">
                  <motion.img
                    src={
                      item.image || 
                      (item.images && item.images[0]) ||
                      "/images/placeholder.jpg"
                    }
                    alt={item.name}
                    draggable={false}
                    onError={handleImageError}
                    whileHover={{ scale: 1.08, transition: HOVER_SPRING }}
                    className="w-full h-32 object-cover select-none"
                  />
                </div>
                <h3 className="text-sm font-medium mt-2">
                  {item.name}
                </h3>
                <p className="text-primary-600 text-sm font-semibold">
                  £{typeof item.price === 'number' ? item.price.toFixed(2) : item.price || 0}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/*  Same engine as the home row, seeded with this product so the picks
          relate to what the shopper is looking at. Only shown when the
          catalogue has no hand-picked `related` set to display. */}
      {(!related || related.length === 0) && product._id && (
        <RecommendedProducts seedProductId={product._id} />
      )}
    </div>
    </MotionConfig>
  );
}
