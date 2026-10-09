import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  Clock,
  ArrowRight,
  Trophy,
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

const statusStyles = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-primary-100 text-primary-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [o, p, c, b] = await Promise.all([
          api.get("/admin/orders"),
          api.get("/admin/products"),
          api.get("/admin/customers"),
          api.get("/admin/best-sellers"),
        ]);
        setOrders(Array.isArray(o.data) ? o.data : []);
        setProducts(Array.isArray(p.data) ? p.data : []);
        setCustomers(Array.isArray(c.data) ? c.data : []);
        setBestSellers(Array.isArray(b.data) ? b.data : []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const revenue = activeOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const lowStock = products.filter((p) => (p.countInStock ?? 0) < 10);
  const statuses = ["pending", "paid", "shipped", "delivered", "cancelled"];
  const statusCounts = statuses.map((s) => ({
    status: s,
    count: orders.filter((o) => o.status === s).length,
  }));

  const stats = [
    {
      label: "Total Revenue",
      value: currency(revenue),
      icon: TrendingUp,
      color: "from-primary-600 to-primary-600",
    },
    {
      label: "Total Orders",
      value: orders.length,
      icon: ShoppingCart,
      color: "from-blue-600 to-indigo-600",
      sub: `${pendingCount} pending`,
    },
    {
      label: "Products",
      value: products.length,
      icon: Package,
      color: "from-amber-500 to-orange-600",
    },
    {
      label: "Low Stock",
      value: lowStock.length,
      icon: AlertTriangle,
      color: "from-red-500 to-rose-600",
      sub: "under 10 in stock",
    },
    {
      label: "Customers",
      value: customers.length,
      icon: Users,
      color: "from-purple-600 to-fuchsia-600",
    },
  ];

  if (loading) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <SkeletonRow className="h-8 w-56" />
            <SkeletonRow className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <SkeletonRow className="h-10 w-32 rounded-lg" />
        </div>

        <StatCardsSkeleton count={5} />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
            <SkeletonRow className="h-4 w-32" />
            <div className="mt-4 divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-4">
                  <div className="min-w-0 space-y-2">
                    <SkeletonRow className="h-3.5 w-56 max-w-full" />
                    <SkeletonRow className="h-3 w-32" />
                  </div>
                  <SkeletonRow className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <SkeletonRow className="h-4 w-36" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i}>
                  <div className="mb-1 flex justify-between">
                    <SkeletonRow className="h-3 w-16" />
                    <SkeletonRow className="h-3 w-6" />
                  </div>
                  <SkeletonRow className="h-2 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Business Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            A live overview of your grocery store&apos;s performance.
          </p>
        </div>
        <Link
          to="/admin/orders"
          className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Manage Orders
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 card-hover"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {s.value}
                  </p>
                  {s.sub && (
                    <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
                  )}
                </div>
                <span
                  className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} text-white shadow-md`}
                >
                  <Icon className="w-6 h-6" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-600" />
              Recent Orders
            </h2>
            <Link
              to="/admin/orders"
              className="text-sm text-primary-700 hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="text-gray-500 text-center py-10">
              No orders have been placed yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {orders.slice(0, 5).map((order) => (
                <li
                  key={order._id}
                  className="flex items-center justify-between px-5 py-3.5 text-sm hover:bg-gray-50"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-gray-800 truncate">
                      {order.customer_email}
                    </span>
                    <span className="text-gray-400 text-xs">
                      #{order._id.slice(-8)} ·{" "}
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-gray-900">
                      {currency(order.total_amount)}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase px-2.5 py-1 rounded-full ${statusStyles[order.status]}`}
                    >
                      {order.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Status breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Orders by Status</h2>
          <div className="space-y-3">
            {statusCounts.map(({ status, count }) => (
              <div key={status}>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span className="capitalize">{status}</span>
                  <span className="font-semibold">{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-600"
                    style={{
                      width: orders.length
                        ? `${(count / orders.length) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {lowStock.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Low Stock Alert
              </h3>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {lowStock.slice(0, 5).map((p) => (
                  <li
                    key={p._id}
                    className="flex items-center justify-between text-sm bg-amber-50 rounded-lg px-3 py-2"
                  >
                    <span className="text-gray-700 truncate">{p.name}</span>
                    <span className="font-semibold text-amber-700 ml-2 shrink-0">
                      {p.countInStock} left
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <TopSellersSection bestSellers={bestSellers} />
        </div>
      </div>
    </div>
  );
}

function TopSellersSection({ bestSellers }) {
  const top = bestSellers.slice(0, 5);
  const maxUnits = top.length ? top[0].unitsSold : 0;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Top Sellers
        </h3>
        <Link
          to="/admin/best-sellers"
          className="text-sm text-primary-700 hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {top.length === 0 ? (
        <p className="text-gray-400 text-sm">No sales yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {top.map((s, i) => {
            const pct = maxUnits
              ? Math.round(((s.unitsSold || 0) / maxUnits) * 100)
              : 0;
            return (
              <li key={s.productId || `${s.name}-${i}`}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700 truncate">
                    <span className="font-bold text-gray-400 mr-1.5">
                      #{i + 1}
                    </span>
                    {s.name}
                  </span>
                  <span className="font-semibold text-gray-900 shrink-0 ml-2">
                    {s.unitsSold}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
    </div>
  );
}