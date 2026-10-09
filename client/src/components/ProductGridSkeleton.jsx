export default function ProductGridSkeleton({
  count = 20,
  gridClass = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6",
}) {
  return (
    <div className={gridClass} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-lg border border-gray-100 bg-white p-3 shadow-sm sm:p-4"
        >
          <div className="h-32 w-full rounded-md bg-gray-200 animate-pulse" />
          <div className="mt-3 h-4 w-3/4 rounded bg-gray-200 animate-pulse" />
          <div className="mt-2 h-4 w-1/3 rounded bg-gray-300 animate-pulse" />
          <div className="mt-4 h-9 w-full rounded-full bg-gray-200 animate-pulse" />
        </div>
      ))}
    </div>
  );
}