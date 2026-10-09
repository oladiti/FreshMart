import { useEffect, useState } from "react";
import { Trash2, Search, RefreshCw, PackageOpen } from "lucide-react";
import api from "../../utils/api";
import AdminTable from "../../components/AdminTable";
import { TableSkeleton } from "../../components/AdminSkeletons";

const ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];

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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    setError("");
    setNotice("");
    try {
      await api.put(`/admin/orders/${id}/status`, { status });
      setOrders((prev) =>
        prev.map((o) => (o._id === id ? { ...o, status } : o))
      );
      setNotice("Order status updated.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteOrder = async (id) => {
    if (!window.confirm("Delete this order permanently?")) return;
    setDeletingId(id);
    setError("");
    setNotice("");
    try {
      await api.delete(`/orders/${id}`);
      setOrders((prev) => prev.filter((o) => o._id !== id));
      setNotice("Order deleted.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete order.");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = orders.filter((order) => {
    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      order.customer_email.toLowerCase().includes(q) ||
      order._id.toLowerCase().includes(q) ||
      order.user?.name?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const columns = [
    {
      key: "order",
      header: "Order",
      render: (o) => (
        <div>
          <p className="font-semibold text-gray-800">#{o._id.slice(-8)}</p>
          <p className="text-xs text-gray-400">
            {new Date(o.createdAt).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => (
        <div>
          <p className="text-gray-800 break-all">{o.customer_email}</p>
          <p className="text-xs text-gray-400">{o.user?.name || "Guest"}</p>
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (o) => (
        <div>
          <p className="text-gray-700">
            {o.items.reduce((sum, i) => sum + (i.quantity || 0), 0)} items
          </p>
          <p className="text-xs text-gray-400 max-w-[180px] truncate">
            {o.items.map((i) => i.name).join(", ")}
          </p>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      render: (o) => (
        <span className="font-semibold text-gray-900">
          {currency(o.total_amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => (
        <div>
          <span
            className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold uppercase ${statusStyles[o.status]}`}
          >
            {o.status}
          </span>
          <select
            value={o.status}
            disabled={updatingId === o._id}
            onChange={(e) => updateStatus(o._id, e.target.value)}
            className="mt-1.5 block w-full sm:w-32 text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (o) => (
        <button
          onClick={() => deleteOrder(o._id)}
          disabled={deletingId === o._id}
          aria-label={`Delete order ${o._id}`}
          className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 disabled:opacity-50 text-xs font-semibold"
        >
          {deletingId === o._id ? (
            "Deleting..."
          ) : (
            <>
              <Trash2 className="w-4 h-4" /> Delete
            </>
          )}
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Manage Orders
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            View, update the status or remove customer orders.
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="bg-primary-50 border border-primary-200 text-primary-700 px-4 py-2 rounded-lg mb-4 text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or order ID..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-10 text-center text-gray-500">
          <PackageOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          {orders.length === 0
            ? "No orders have been placed yet."
            : "No orders match your filters."}
        </div>
      ) : (
        <AdminTable columns={columns} rows={filtered} keyFn={(o) => o._id} minWidth={900} />
      )}
    </div>
  );
}