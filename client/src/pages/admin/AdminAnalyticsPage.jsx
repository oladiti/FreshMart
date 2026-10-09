import { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Users,
  PoundSterling,
  Package,
  Crown,
  CalendarRange,
} from "lucide-react";
import api from "../../utils/api";
import {
  SkeletonRow,
  StatCardsSkeleton,
} from "../../components/AdminSkeletons";

const currency = (n) =>
  `£${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const DAY_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const statusStyles = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-primary-100 text-primary-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnalytics = async (range) => {
    setLoading(true);
    setError("");
    try {
      const { data: payload } = await api.get(
        `/admin/analytics?days=${range}`
      );
      setData(payload);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(days);
  }, [days]);

  const summary = data?.summary || {};
  const series = data?.series || [];
  const maxRevenue = Math.max(...series.map((d) => d.revenue), 0);
  const maxOrders = Math.max(...series.map((d) => d.orders), 0);

  const stats = [
    {
      label: "Revenue",
      value: currency(summary.totalRevenue),
      icon: PoundSterling,
      color: "from-primary-600 to-emerald-600",
    },
    {
      label: "Orders",
      value: summary.totalOrders ?? 0,
      icon: ShoppingCart,
      color: "from-blue-600 to-indigo-600",
      sub: `${summary.cancelledOrders ?? 0} cancelled`,
    },
    {
      label: "Avg. Order Value",
      value: currency(summary.averageOrderValue),
      icon: TrendingUp,
      color: "from-amber-500 to-orange-600",
    },
    {
      label: "Units Sold",
      value: summary.unitsSold ?? 0,
      icon: Package,
      color: "from-purple-600 to-fuchsia-600",
    },
    {
      label: "Active Customers",
      value: summary.activeCustomers ?? 0,
      icon: Users,
      color: "from-cyan-600 to-teal-600",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary-600" />
            Analytics
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Performance trends, categories and top customers across your store.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
          <CalendarRange className="w-4 h-4 text-gray-400 ml-2" />
          {DAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                days === opt.value
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div>
          <StatCardsSkeleton count={stats.length} />

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <SkeletonRow className="h-4 w-32" />
                <div className="mt-5 space-y-3">
                  <SkeletonRow className="h-3 w-full" />
                  <SkeletonRow className="h-3 w-full" />
                  <SkeletonRow className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <SkeletonRow className="h-4 w-36" />
            <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-gray-50 px-4 py-3 text-center">
                  <SkeletonRow className="mx-auto h-4 w-20 rounded-full" />
                  <SkeletonRow className="mx-auto mt-3 h-6 w-10 bg-gray-300" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-6">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 card-hover"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-500">{s.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1 truncate">
                        {s.value}
                      </p>
                      {s.sub && (
                        <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
                      )}
                    </div>
                    <span
                      className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} text-white shadow-md shrink-0`}
                    >
                      <Icon className="w-6 h-6" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue per day */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Revenue per day</h2>
              <BarChart
                data={series.map((d) => ({ date: d.date, value: d.revenue }))}
                maxValue={maxRevenue}
                formatValue={currency}
                colorClass="bg-gradient-to-t from-primary-600 to-lime-400"
                emptyText="No revenue recorded in this period."
              />
            </section>

            {/* Orders per day */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Orders per day</h2>
              <BarChart
                data={series.map((d) => ({ date: d.date, value: d.orders }))}
                maxValue={maxOrders}
                formatValue={(n) => String(n)}
                colorClass="bg-gradient-to-t from-blue-500 to-indigo-400"
                emptyText="No orders placed in this period."
              />
            </section>

            {/* Top categories */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary-600" />
                Performance by category
              </h2>
              {data.topCategories.length === 0 ? (
                <p className="text-gray-400 text-sm py-10 text-center">
                  No category data yet.
                </p>
              ) : (
                <ul className="space-y-4">
                  {data.topCategories.map((c) => {
                    const pct = maxRevenue
                      ? Math.round(((c.revenue || 0) / maxRevenue) * 100)
                      : 0;
                    return (
                      <li key={c.category}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 capitalize">
                            {c.category}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {currency(c.revenue)}{" "}
                            <span className="text-xs text-gray-400 font-normal">
                              · {c.units} units
                            </span>
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary-600 to-lime-400"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Top customers */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                Top customers
              </h2>
              {data.topCustomers.length === 0 ? (
                <p className="text-gray-400 text-sm py-10 text-center">
                  No customer activity yet.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.topCustomers.map((c, i) => (
                    <li
                      key={c.email}
                      className="flex items-center justify-between py-3 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 text-xs font-bold shrink-0">
                          #{i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate">
                            {c.name || c.email}
                          </p>
                          {c.name && (
                            <p className="text-xs text-gray-400 truncate">
                              {c.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-semibold text-gray-900">
                          {currency(c.spend)}
                        </p>
                        <p className="text-xs text-gray-400">{c.orders} orders</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Order status breakdown */}
          <section className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Orders by status</h2>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {data.statusCounts.map(({ status, count }) => (
                <div
                  key={status}
                  className="bg-gray-50 rounded-lg px-4 py-3 text-center"
                >
                  <span
                    className={`inline-block text-xs font-semibold uppercase px-2.5 py-1 rounded-full ${statusStyles[status]}`}
                  >
                    {status}
                  </span>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {count}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function BarChart({ data, maxValue, formatValue, colorClass, emptyText }) {
  if (data.every((d) => d.value === 0)) {
    return (
      <p className="text-gray-400 text-sm py-10 text-center">{emptyText}</p>
    );
  }

  return (
    <div className="flex items-end gap-1 h-32 sm:h-40">
      {data.map((d) => (
        <div
          key={d.date}
          className="flex-1 flex flex-col items-stretch h-full min-w-0"
          title={`${d.date}: ${formatValue(d.value)}`}
        >
          <span className="hidden sm:block text-[10px] text-gray-500 text-center truncate">
            {d.value > 0 ? formatValue(d.value) : ""}
          </span>
          <div className="flex-1 flex items-end">
            <div
              className={`w-full rounded-t ${colorClass}`}
              style={{
                height: maxValue
                  ? `${Math.max((d.value / maxValue) * 100, 2)}%`
                  : "2%",
              }}
            />
          </div>
          <span className="text-[10px] text-gray-400 text-center truncate">
            {d.date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}