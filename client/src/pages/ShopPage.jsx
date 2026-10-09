// pages/ShopPage.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Pagination from "../components/Pagination";
import AddToCartButton from "../components/AddToCartButton";
import { PackageSearch, SlidersHorizontal, X } from "lucide-react";
import api from "../utils/api"; //  your axios instance

const categories = [
  "Fruits",
  "Vegetables",
  "Dairy",
  "Meat",
  "Fish",
  "Poultry",
  "Bakery",
  "Beverages",
  "Snacks",
  "Pantry",
  "Spices",
  "Ethnic Food",
  "Cooking Oil",
  "Cooking Essentials",
];
const priceRanges = [
  { label: "All", min: 0, max: Infinity },
  { label: "Under £2", min: 0, max: 2 },
  { label: "£2 - £3", min: 2, max: 3 },
  { label: "Above £3", min: 3, max: Infinity },
];
const dietaries = ["All", "Vegan", "Vegetarian", "Gluten-Free"];
const PAGE_SIZES = [12, 24, 48];

/**
 * The three filter groups (Category / Price Range / Dietaries), shared between
 * the desktop sidebar and the mobile bottom sheet so both stay in sync.
 * `compact` trades the tall category list for a two-column one with a
 * "Show all" toggle, keeping the sheet short on small screens.
 */
function FilterControlSections({
  selectedCategories,
  selectedPrice,
  selectedDietary,
  onToggleCategory,
  onSelectPrice,
  onSelectDietary,
  compact = false,
}) {
  const [showAll, setShowAll] = useState(false);
  const hasMany = compact && categories.length > 6;
  const visible = compact && !showAll ? categories.slice(0, 6) : categories;

  return (
    <>
      {/* Categories */}
      <div className="mb-6">
        <h4 className="mb-2.5 text-sm font-semibold text-gray-900">Category</h4>
        <ul
          className={
            compact
              ? "grid grid-cols-2 gap-x-3 gap-y-0.5"
              : "space-y-1.5"
          }
        >
          {visible.map((cat) => (
            <li key={cat}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-primary-50 hover:text-gray-900">
                <input
                  type="checkbox"
                  aria-label={cat}
                  checked={selectedCategories.includes(cat)}
                  onChange={() => onToggleCategory(cat)}
                  className="h-4 w-4 shrink-0 rounded border-gray-300 accent-primary-600"
                />
                <span className="min-w-0 truncate">{cat}</span>
              </label>
            </li>
          ))}
        </ul>
        {hasMany && (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="mt-2 text-xs font-semibold text-primary-700 hover:text-primary-900"
          >
            {showAll
              ? "Show fewer categories"
              : `Show all categories (${categories.length})`}
          </button>
        )}
      </div>

      {/* Price Ranges */}
      <div className="mb-6">
        <h4 className="mb-2.5 text-sm font-semibold text-gray-900">Price Range</h4>
        <div className="flex flex-wrap gap-2">
          {priceRanges.map((range) => (
            <button
              key={range.label}
              type="button"
              onClick={() => onSelectPrice(range)}
              aria-pressed={selectedPrice.label === range.label}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                selectedPrice.label === range.label
                  ? "bg-leaf text-white shadow-md shadow-leaf/25"
                  : "bg-cream text-gray-600 hover:bg-primary-100 hover:text-gray-900"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dietaries */}
      <div>
        <h4 className="mb-2.5 text-sm font-semibold text-gray-900">Dietaries</h4>
        <div className="flex flex-wrap gap-2">
          {dietaries.map((diet) => (
            <button
              key={diet}
              type="button"
              onClick={() => onSelectDietary(diet)}
              aria-pressed={selectedDietary === diet}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                selectedDietary === diet
                  ? "bg-leaf text-white shadow-md shadow-leaf/25"
                  : "bg-cream text-gray-600 hover:bg-primary-100 hover:text-gray-900"
              }`}
            >
              {diet}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

const ShopPage = ({ searchQuery = "" }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  //  Read the `?search=` query param from the URL (set by navbar search submit)
  const activeSearch = searchParams.get("search") || searchQuery;
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const hasLoadedRef = useRef(false);
  const gridRef = useRef(null);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedPrice, setSelectedPrice] = useState(priceRanges[0]);
  const [selectedDietary, setSelectedDietary] = useState("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterTriggerRef = useRef(null);
  const filterSheetRef = useRef(null);

  //  Pagination lives in the URL so it survives refresh and back/forward.
  const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
  const requestedPage =
    Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const perPageParam = Number.parseInt(searchParams.get("perPage") || "", 10);
  const itemsPerPage = PAGE_SIZES.includes(perPageParam) ? perPageParam : 12;

  const updateParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          });
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  //  Fetch one page of products from the backend. All filtering/sorting happens
  //  server-side, so we never download the whole catalogue to filter it here.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchProducts = async () => {
      if (!hasLoadedRef.current) setLoading(true);
      else setFetching(true);

      try {
        const params = new URLSearchParams();
        params.set("page", String(requestedPage));
        params.set("limit", String(itemsPerPage));
        if (activeSearch) params.set("search", activeSearch);
        if (selectedCategories.length)
          params.set("categories", selectedCategories.join(","));
        if (selectedPrice.min > 0)
          params.set("minPrice", String(selectedPrice.min));
        if (selectedPrice.max !== Infinity)
          params.set("maxPrice", String(selectedPrice.max));
        if (selectedDietary !== "All") params.set("dietary", selectedDietary);

        const { data } = await api.get(`/products?${params.toString()}`, {
          signal: controller.signal,
        });
        if (cancelled) return;

        const list = Array.isArray(data) ? data : data?.products || [];
        setProducts(list);
        setTotal(Array.isArray(data) ? list.length : data?.total ?? list.length);
        hasLoadedRef.current = true;
      } catch (error) {
        if (cancelled || error.code === "ERR_CANCELED") return;
        console.error("Failed to fetch products:", error);
        setProducts([]);
        setTotal(0);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setFetching(false);
        }
      }
    };

    fetchProducts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    activeSearch,
    selectedCategories,
    selectedPrice,
    selectedDietary,
    requestedPage,
    itemsPerPage,
  ]);

  const resetPage = useCallback(() => {
    updateParams({ page: undefined });
  }, [updateParams]);

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedPrice(priceRanges[0]);
    setSelectedDietary("All");
    resetPage();
  };

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedPrice.label !== priceRanges[0].label ||
    selectedDietary !== "All";

  const activeFilterCount =
    selectedCategories.length +
    (selectedPrice.label !== priceRanges[0].label ? 1 : 0) +
    (selectedDietary !== "All" ? 1 : 0);

  const closeFilters = useCallback(() => {
    setIsFilterOpen(false);
    filterTriggerRef.current?.focus();
  }, []);

  //  While the mobile filter sheet is open: lock body scroll, close on Escape
  //  and focus the sheet so assistive tech lands somewhere meaningful.
  useEffect(() => {
    if (!isFilterOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeFilters();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => filterSheetRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [isFilterOpen, closeFilters]);

  const selectPrice = useCallback(
    (range) => {
      setSelectedPrice(range);
      resetPage();
    },
    [resetPage]
  );

  const selectDietary = useCallback(
    (diet) => {
      setSelectedDietary(diet);
      resetPage();
    },
    [resetPage]
  );

  const toggleCategory = (cat) => {
    resetPage();
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  //  The server already filtered + paginated, so what it returned is the page.
  const totalItems = total;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const currentItems = products;

  //  Keep the URL honest if filters shrink the result set below the current page.
  useEffect(() => {
    if (requestedPage > totalPages) {
      updateParams({ page: totalPages > 1 ? totalPages : undefined });
    }
  }, [requestedPage, totalPages, updateParams]);

  const goToPage = useCallback(
    (page) => {
      if (page < 1 || page > totalPages || page === currentPage) return;
      updateParams({ page: page === 1 ? undefined : page });
      gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [currentPage, totalPages, updateParams]
  );

  if (loading) {
    return (
      <div
        className="p-4 lg:px-10 grid grid-cols-1 lg:grid-cols-4 gap-6 animate-pulse"
        aria-busy="true"
        aria-label="Loading products"
      >
        <div className="space-y-4 lg:col-span-1">
          <div className="h-9 w-28 rounded-full bg-gray-200" />
          <div className="hidden lg:block h-fit rounded-2xl border border-[#ddd8c4] bg-white p-5">
            <div className="h-6 w-24 rounded bg-gray-200" />
            <div className="mt-4 space-y-3">
              <div className="h-4 w-full rounded bg-gray-200" />
              <div className="h-4 w-full rounded bg-gray-200" />
              <div className="h-4 w-2/3 rounded bg-gray-200" />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <div className="h-8 w-20 rounded-full bg-gray-200" />
              <div className="h-8 w-24 rounded-full bg-gray-200" />
              <div className="h-8 w-16 rounded-full bg-gray-200" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-4 w-full rounded bg-gray-200" />
              <div className="h-4 w-1/2 rounded bg-gray-200" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-5 w-40 rounded bg-gray-200" />
            <div className="h-9 w-32 rounded-lg bg-gray-200" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
              >
                <div className="h-40 w-full bg-gray-200" />
                <div className="p-4">
                  <div className="h-3.5 w-3/4 rounded bg-gray-200" />
                  <div className="mt-2 h-4 w-1/3 rounded bg-gray-200" />
                </div>
                <div className="px-4 pb-4">
                  <div className="h-9 w-full rounded-full bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:px-10 grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left rail: Back to Home + filters, pinned together on lg+ (hidden on
          mobile - the filters live in the bottom sheet instead) */}
      <div className="hidden space-y-4 lg:col-span-1 lg:sticky lg:top-24 lg:h-fit lg:block">
        {/* Back to home */}
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm ring-1 ring-gray-100 transition-all hover:-translate-y-0.5 hover:bg-primary-50 hover:shadow-md"
          >
            <span aria-hidden="true">←</span>
            Back to Home
          </Link>
        </div>

        {/* Sidebar filters */}
        <div className="h-fit rounded-2xl border border-[#ddd8c4] bg-white p-5 shadow-[0_10px_30px_-18px_rgba(5,79,49,0.18)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Filter By</h3>
              <div className="mt-1.5 w-10 rounded-full bg-gradient-to-r from-primary-600 to-primary-400 h-1"></div>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-primary-700 hover:text-primary-900"
              >
                Clear all
              </button>
            )}
          </div>

          <FilterControlSections
            selectedCategories={selectedCategories}
            selectedPrice={selectedPrice}
            selectedDietary={selectedDietary}
            onToggleCategory={toggleCategory}
            onSelectPrice={selectPrice}
            onSelectDietary={selectDietary}
          />
        </div>
      </div>

      {/* Products */}
      <div className="lg:col-span-3">
        {/* Back to home, compact, mobile only */}
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm ring-1 ring-gray-100 lg:hidden"
        >
          <span aria-hidden="true">←</span>
          Back to Home
        </Link>

        {/* Mobile filter bar: sticky, with the active filters one tap away */}
        <div className="sticky top-24 z-30 mb-4 lg:hidden">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#ddd8c4] bg-white/95 p-2 shadow-[0_10px_30px_-18px_rgba(5,79,49,0.18)] backdrop-blur">
            <button
              ref={filterTriggerRef}
              type="button"
              onClick={() => setIsFilterOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={isFilterOpen}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {selectedCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700"
              >
                <span className="truncate">{cat}</span>
                <X className="h-3 w-3 shrink-0" />
              </button>
            ))}
            {selectedPrice.label !== priceRanges[0].label && (
              <button
                type="button"
                onClick={() => selectPrice(priceRanges[0])}
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700"
              >
                {selectedPrice.label}
                <X className="h-3 w-3" />
              </button>
            )}
            {selectedDietary !== "All" && (
              <button
                type="button"
                onClick={() => selectDietary("All")}
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700"
              >
                {selectedDietary}
                <X className="h-3 w-3" />
              </button>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto px-1 text-xs font-semibold text-primary-700 hover:text-primary-900"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
            {activeSearch ? (
              <>
                Results for "
                <span className="text-primary-700">{activeSearch}</span>"
                <span className="text-gray-500 text-sm font-normal ml-2">
                  ({totalItems} found)
                </span>
              </>
            ) : (
              <>
                Shop All Products
                <span className="text-gray-500 text-sm font-normal ml-2">
                  ({totalItems} products)
                </span>
              </>
            )}
          </h2>

          <div className="flex items-center gap-3">
            {activeSearch && (
              <button
                onClick={() => updateParams({ search: undefined, page: undefined })}
                className="text-sm text-primary-700 hover:text-primary-900 font-medium"
              >
                ✕ Clear search
              </button>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="hidden sm:inline">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) =>
                  updateParams({
                    perPage:
                      Number(e.target.value) === 12
                        ? undefined
                        : e.target.value,
                    page: undefined,
                  })
                }
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                aria-label="Products per page"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="hidden sm:inline">per page</span>
            </label>
          </div>
        </div>

        <div
          ref={gridRef}
          aria-busy={fetching}
          className={`grid grid-cols-2 sm:grid-cols-3 gap-4 scroll-mt-24 transition-opacity ${
            fetching ? "opacity-60" : "opacity-100"
          }`}
        >
          {currentItems.length > 0 ? (
            currentItems.map((item) => (
              <div
                key={item._id}
                className="product-card group"
              >
                <Link
                  to={`/products/${item.slug}`}
                  className="flex-1"
                >
                  <div className="relative overflow-hidden">
                    <img
                      src={item.image || item.img || "/images/placeholder.jpg"}
                      alt={item.name}
                      onError={(e) => (e.target.src = "/images/placeholder.jpg")}
                      className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {item.category && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-leaf shadow-sm backdrop-blur-sm">
                        {item.category}
                      </span>
                    )}
                    {Number(item.countInStock) === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-gray-800">
                          Sold out
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 transition-colors group-hover:text-primary-700">
                      {item.name}
                    </h4>
                    <p className="mt-1.5 text-base font-bold text-leaf">
                      £{Number(item.price).toFixed(2)}
                    </p>
                  </div>
                </Link>

                <div className="px-4 pb-4">
                  <AddToCartButton product={item} />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd8c4] bg-white/60 py-16 text-center">
              <PackageSearch className="h-12 w-12 text-primary-300" />
              <p className="mt-4 text-base font-semibold text-gray-800">
                No products found
              </p>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Try adjusting your search or filters.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition hover:bg-primary-700"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          total={totalItems}
          pageSize={itemsPerPage}
        />
      </div>

      {/* Mobile filter bottom sheet */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div
              key="filter-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              role="presentation"
              className="fixed inset-0 z-[75] bg-black/40"
              onClick={closeFilters}
              aria-hidden="true"
            />
            <motion.div
              key="filter-sheet"
              ref={filterSheetRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-[80] flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none"
            >
              <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-gray-200" />
              <div className="flex shrink-0 items-center justify-between p-5 pb-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Filters</h3>
                  <div className="mt-1.5 w-10 rounded-full bg-gradient-to-r from-primary-600 to-primary-400 h-1"></div>
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-xs font-semibold text-primary-700 hover:text-primary-900"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeFilters}
                    aria-label="Close filters"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-2 pt-2">
                <FilterControlSections
                  compact
                  selectedCategories={selectedCategories}
                  selectedPrice={selectedPrice}
                  selectedDietary={selectedDietary}
                  onToggleCategory={toggleCategory}
                  onSelectPrice={selectPrice}
                  onSelectDietary={selectDietary}
                />
              </div>

              <div className="shrink-0 border-t border-gray-100 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={closeFilters}
                  className="w-full rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition hover:bg-primary-700"
                >
                  Show {totalItems} {totalItems === 1 ? "product" : "products"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShopPage;
