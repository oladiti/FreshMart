import { useEffect, useState } from "react";
import { Users, Search, RefreshCw, UserX } from "lucide-react";
import api from "../../utils/api";
import AdminTable from "../../components/AdminTable";
import { TableSkeleton } from "../../components/AdminSkeletons";

const currency = (n) =>
  `£${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [c, o] = await Promise.all([
        api.get("/admin/customers"),
        api.get("/admin/orders"),
      ]);
      setCustomers(Array.isArray(c.data) ? c.data : []);
      setOrders(Array.isArray(o.data) ? o.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Match orders to customers by email (orders store customer_email + populated user email)
  const customersWithStats = customers.map((customer) => {
    const customerOrders = orders.filter(
      (o) =>
        o.customer_email === customer.email ||
        o.user?.email === customer.email
    );
    const activeOrders = customerOrders.filter(
      (o) => o.status !== "cancelled"
    );
    const totalSpent = activeOrders.reduce(
      (sum, o) => sum + (o.total_amount || 0),
      0
    );
    return {
      ...customer,
      orderCount: customerOrders.length,
      totalSpent,
    };
  });

  const totalSpentAll = customersWithStats.reduce(
    (sum, c) => sum + c.totalSpent,
    0
  );

  const filtered = customersWithStats.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      key: "customer",
      header: "Customer",
      render: (c) => (
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-600 text-white font-bold text-sm shrink-0">
            {(c.name || "U").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate">{c.name}</p>
            <p className="text-xs text-gray-400 truncate break-all">{c.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      render: (c) => (
        <span className="text-gray-700">
          {new Date(c.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "orders",
      header: "Orders",
      render: (c) => <span className="text-gray-700">{c.orderCount}</span>,
    },
    {
      key: "spent",
      header: "Total Spent",
      render: (c) => (
        <span className="font-semibold text-gray-900">{currency(c.totalSpent)}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Customers
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Everyone who has registered on FreshMart.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 card-hover">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-600" /> Registered customers
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {customers.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 card-hover">
          <p className="text-sm text-gray-500">Total customer spend</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {currency(totalSpentAll)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 card-hover">
          <p className="text-sm text-gray-500">Orders placed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {orders.length}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="relative mb-5 max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-10 text-center text-gray-500">
          <UserX className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          {customers.length === 0
            ? "No registered customers yet."
            : "No customers match your search."}
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={filtered}
          keyFn={(c) => c._id}
          minWidth={760}
        />
      )}
    </div>
  );
}