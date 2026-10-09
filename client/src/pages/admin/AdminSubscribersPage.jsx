import { useEffect, useMemo, useState } from "react";
import { Mail, RefreshCw, UserX, Search, Download, Globe, LayoutGrid } from "lucide-react";
import api from "../../utils/api";
import AdminTable from "../../components/AdminTable";
import { TableSkeleton } from "../../components/AdminSkeletons";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

const SOURCE_LABELS = {
  home: { label: "Home page", icon: LayoutGrid },
  footer: { label: "Footer", icon: Globe },
};

const sourceMeta = (source) =>
  SOURCE_LABELS[source] || { label: source || "Unknown", icon: Mail };

// RFC 4180 escaping: wrap anything containing a delimiter, quote or newline, and
// double up any embedded quotes.
const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /["\r\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function AdminSubscribersPage() {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/newsletter");
      // The endpoint returns { success, subscribers, total }.
      setSubscribers(Array.isArray(data?.subscribers) ? data.subscribers : []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load newsletter subscribers."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const since = Date.now() - WEEK_MS;
    return {
      total: subscribers.length,
      home: subscribers.filter((s) => s.source === "home").length,
      footer: subscribers.filter((s) => s.source === "footer").length,
      recent: subscribers.filter(
        (s) => s.createdAt && new Date(s.createdAt).getTime() >= since
      ).length,
    };
  }, [subscribers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter(
      (s) =>
        (s.email || "").toLowerCase().includes(q) ||
        (s.source || "").toLowerCase().includes(q)
    );
  }, [subscribers, search]);

  const exportCsv = () => {
    const header = ["email", "source", "subscribed_at"];
    const rows = filtered.map((s) => [s.email, s.source, s.createdAt]);
    // Leading BOM so Excel opens the UTF-8 file without mangling it.
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `newsletter-subscribers-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: "email",
      header: "Subscriber",
      render: (s) => (
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-600 text-white font-bold text-sm shrink-0">
            {(s.email || "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate break-all">
              {s.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (s) => {
        const { label, icon: Icon } = sourceMeta(s.source);
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
            <Icon className="w-3.5 h-3.5" />
            {label}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      header: "Subscribed",
      render: (s) => (
        <span className="text-gray-700">{formatDate(s.createdAt)}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Newsletter Subscribers
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Everyone who signed up through the home page banner or the footer
            form.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 card-hover">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary-600" /> Total subscribers
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats.total}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 card-hover">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-primary-600" /> From home page
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.home}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 card-hover">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary-600" /> From footer
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats.footer}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 card-hover">
          <p className="text-sm text-gray-500">Last 7 days</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats.recent}
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
        <label htmlFor="subscriber-search" className="sr-only">
          Search subscribers
        </label>
        <input
          id="subscriber-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or source..."
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-10 text-center text-gray-500">
          <UserX className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          {subscribers.length === 0
            ? "No newsletter subscribers yet."
            : "No subscribers match your search."}
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={filtered}
          keyFn={(s) => s._id}
          minWidth={640}
        />
      )}
    </div>
  );
}