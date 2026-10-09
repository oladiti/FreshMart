import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Section from "./Section";
import SectionHeading from "./SectionHeading";
import { categories } from "../data/categories";
import { containerVariants, fadeUp } from "../utils/animations";

const CategoryTile = ({ category }) => {
  const Icon = category.icon;

  return (
    <motion.li
      variants={fadeUp}
      className="w-24 shrink-0 snap-start sm:w-auto"
    >
      <NavLink
        to={`/${category.slug}`}
        className={({ isActive }) =>
          `group flex h-full flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            isActive
              ? "border-primary-300 bg-primary-50 text-primary-700"
              : "border-gray-100 bg-gray-50 text-gray-700 hover:border-primary-200 hover:bg-white hover:text-primary-700"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                isActive
                  ? "bg-primary-600 text-white"
                  : "bg-primary-50 text-primary-700 group-hover:bg-primary-600 group-hover:text-white"
              }`}
            >
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold sm:w-full">
              {category.name}
            </span>
          </>
        )}
      </NavLink>
    </motion.li>
  );
};

const CategorySection = () => {
  const scrollerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < maxScroll - 2);
  }, []);

  // Recompute arrow availability on mount, on resize and whenever the row's
  // own size changes (e.g. fonts loading, orientation change).
  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    window.addEventListener("resize", updateArrows);

    let observer;
    if (el && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateArrows);
      observer.observe(el);
    }

    return () => {
      window.removeEventListener("resize", updateArrows);
      observer?.disconnect();
    };
  }, [updateArrows]);

  const scrollByPage = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <Section padding="compact" className="bg-white">
      <SectionHeading eyebrow="Explore" title="Products by Category" />
      <nav aria-label="Shop by category" className="relative">
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Scroll categories left"
          disabled={!canScrollLeft}
          className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-primary-700 shadow-md ring-1 ring-gray-200 backdrop-blur transition-opacity duration-200 disabled:pointer-events-none disabled:opacity-0 sm:hidden"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <motion.ul
          ref={scrollerRef}
          onScroll={updateArrows}
          variants={containerVariants}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
        >
          {categories.map((category) => (
            <CategoryTile key={category.slug} category={category} />
          ))}
        </motion.ul>

        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Scroll categories right"
          disabled={!canScrollRight}
          className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-primary-700 shadow-md ring-1 ring-gray-200 backdrop-blur transition-opacity duration-200 disabled:pointer-events-none disabled:opacity-0 sm:hidden"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </nav>
    </Section>
  );
};

export default CategorySection;
