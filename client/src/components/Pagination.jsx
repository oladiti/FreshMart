import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const ELLIPSIS = "ellipsis";

function getPageItems(currentPage, totalPages, siblingCount) {
  const totalPageNumbers = siblingCount * 2 + 5;

  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items = [1];
  const left = Math.max(2, currentPage - siblingCount);
  const right = Math.min(totalPages - 1, currentPage + siblingCount);

  if (left > 2) items.push(ELLIPSIS);
  for (let page = left; page <= right; page++) items.push(page);
  if (right < totalPages - 1) items.push(ELLIPSIS);

  items.push(totalPages);
  return items;
}

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  total,
  pageSize,
  siblingCount = 1,
  showEdges = true,
  showSummary = true,
  disabled = false,
  className = "",
}) {
  if (totalPages <= 1) return null;

  const items = getPageItems(currentPage, totalPages, siblingCount);
  const hasSummary = showSummary && typeof total === "number" && !!pageSize;
  const start = hasSummary ? (currentPage - 1) * pageSize + 1 : 0;
  const end = hasSummary ? Math.min(total, currentPage * pageSize) : 0;

  const goTo = (page) => {
    if (disabled) return;
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange?.(page);
  };

  const navButton =
    "inline-flex h-10 items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none disabled:cursor-not-allowed";
  const enabled = "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-primary-50 hover:text-primary-700";
  const disabledCls = "bg-white text-gray-300 ring-1 ring-gray-100 cursor-not-allowed";
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  return (
    <div className={`mt-10 ${className}`}>
      {hasSummary && (
        <p className="mb-3 text-center text-sm text-gray-500">
          Showing{" "}
          <span className="font-semibold text-gray-700">
            {start}–{end}
          </span>{" "}
          of <span className="font-semibold text-gray-700">{total}</span>{" "}
          products
        </p>
      )}

      <nav
        aria-label="Pagination"
        className="flex flex-wrap items-center justify-center gap-2"
      >
        {showEdges && (
          <button
            type="button"
            onClick={() => goTo(1)}
            disabled={disabled || isFirst}
            aria-label="First page"
            className={`${navButton} hidden sm:inline-flex ${
              isFirst ? disabledCls : enabled
            }`}
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => goTo(currentPage - 1)}
          disabled={disabled || isFirst}
          aria-label="Previous page"
          className={`${navButton} ${isFirst ? disabledCls : enabled}`}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {items.map((item, index) =>
          item === ELLIPSIS ? (
            <span
              key={`ellipsis-${index}`}
              className="px-1 text-sm text-gray-400 select-none"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => goTo(item)}
              disabled={disabled}
              aria-label={`Go to page ${item}`}
              aria-current={item === currentPage ? "page" : undefined}
              className={`${navButton} min-w-10 ${
                item === currentPage
                  ? "bg-primary-600 text-white shadow-md shadow-primary-600/25"
                  : enabled
              }`}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => goTo(currentPage + 1)}
          disabled={disabled || isLast}
          aria-label="Next page"
          className={`${navButton} ${isLast ? disabledCls : enabled}`}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>

        {showEdges && (
          <button
            type="button"
            onClick={() => goTo(totalPages)}
            disabled={disabled || isLast}
            aria-label="Last page"
            className={`${navButton} hidden sm:inline-flex ${
              isLast ? disabledCls : enabled
            }`}
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}
      </nav>
    </div>
  );
}
