import { useEffect, useState } from "react";
import {
  Trophy,
  ShoppingCart,
  PoundSterling,
  Package,
  Crown,
} from "lucide-react";
import api from "../../utils/api";
import { SkeletonRow } from "../../components/AdminSkeletons";

const currency = (n) =>
  `£${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const MEDALS = [
  "bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-md",
  "bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-md",
  "bg-gradient-to-br from-orange-300 to-amber-600 text-white shadow-md",
];

export default function AdminBestSellersPage() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/admin/best-sellers");
        setSellers(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load best sellers.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const maxUnits = sellers.length ? sellers[0].unitsSold : 0;
  const totalUnits = sellers.reduce((sum, s) => sum + (s.unitsSold || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-500" />
          Best Sellers
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Products ranked by units sold across all non-cancelled orders.
        </p>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-center gap-4">
                <SkeletonRow className="h-10 w-10 shrink-0 rounded-full" />
                <SkeletonRow className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonRow className="h-4 w-2/3 max-w-56" />
                  <SkeletonRow className="h-3 w-24" />
                </div>
                <div className="hidden sm:block space-y-2 text-right">
                  <SkeletonRow className="ml-auto h-3 w-16" />
                  <SkeletonRow className="ml-auto h-5 w-14 bg-gray-300" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <SkeletonRow className="h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {!loading && !error && sellers.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center card-hover">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="mt-4 text-gray-500">
            No orders yet — best-selling products will appear here once customers
            start ordering.
          </p>
        </div>
      )}

      {!loading && !error && sellers.length > 0 && (
        <div className="space-y-3">
          {sellers.map((seller, index) => {
            const rank = index + 1;
            const pct = maxUnits
              ? Math.round(((seller.unitsSold || 0) / maxUnits) * 100)
              : 0;

            return (
              <div
                key={seller.productId || `${seller.name}-${index}`}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4 min-w-0">
                    <span
                      className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shrink-0 ${
                        MEDALS[rank - 1] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {rank === 1 ? <Crown className="w-5 h-5" /> : rank}
                    </span>

                    <img
                      src={seller.image || "/images/placeholder.jpg"}
                      alt={seller.name}
                      onError={(e) => (e.target.src = "/images/placeholder.jpg")}
                      className="h-14 w-14 rounded-lg object-cover shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">
                        {seller.name}
                      </p>
                      {seller.category && (
                        <span className="inline-block mt-0.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-full px-2 py-0.5">
                          {seller.category}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 sm:shrink-0 sm:ml-auto">
                    <div className="text-right">
                      <p className="text-sm text-gray-500 flex items-center gap-1 justify-end">
                        <ShoppingCart className="w-3.5 h-3.5" /> Units sold
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        {seller.unitsSold}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 flex items-center gap-1 justify-end">
                        <PoundSterling className="w-3.5 h-3.5" /> Revenue
                      </p>
                      <p className="text-lg font-semibold text-gray-900">
                        {currency(seller.revenue)}
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-gray-500 flex items-center gap-1 justify-end">
                        <Package className="w-3.5 h-3.5" /> In stock
                      </p>
                      <p className="text-lg font-semibold text-gray-900">
                        {seller.countInStock ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-600 to-lime-400"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {pct}% of top seller
                  </span>
                </div>
              </div>
            );
          })}

          <p className="text-xs text-gray-400 pt-1">
            {sellers.length} products · {totalUnits} units sold
          </p>
        </div>
      )}
    </div>
  );
}