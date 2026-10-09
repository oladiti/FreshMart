export function SkeletonRow({ className = "" }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-4 border-b border-gray-100 px-5 py-4">
        <SkeletonRow className="h-4 w-32" />
        <SkeletonRow className="hidden sm:block h-4 w-24" />
        <SkeletonRow className="hidden md:block h-4 w-20" />
        <SkeletonRow className="ml-auto h-4 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0"
        >
          <SkeletonRow className="h-10 w-10 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonRow className="h-3.5 w-2/3 max-w-56" />
            <SkeletonRow className="h-3 w-1/3 max-w-36" />
          </div>
          <SkeletonRow className="hidden sm:block h-3.5 w-24" />
          <SkeletonRow className="hidden md:block h-3.5 w-16" />
          <SkeletonRow className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function StatCardsSkeleton({
  count = 5,
  gridClass = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
}) {
  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <SkeletonRow className="h-4 w-24" />
          <SkeletonRow className="mt-3 h-7 w-24 bg-gray-300" />
        </div>
      ))}
    </div>
  );
}