import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Search,
  X,
  Pencil,
  PackagePlus,
} from "lucide-react";
import api from "../../utils/api";
import AdminTable from "../../components/AdminTable";
import { TableSkeleton } from "../../components/AdminSkeletons";
import Pagination from "../../components/Pagination";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];
const PER_PAGE_STORAGE_KEY = "adminProductsPerPage";

const currency = (n) =>
  `£${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const EMPTY_FORM = {
  name: "",
  price: "",
  description: "",
  category: "",
  image: "",
  countInStock: 10,
  brand: "",
  sku: "",
  isFeatured: false,
  isWeeklyDeal: false,
  isNewArrival: false,
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = Number(localStorage.getItem(PER_PAGE_STORAGE_KEY));
    return ITEMS_PER_PAGE_OPTIONS.includes(saved) ? saved : ITEMS_PER_PAGE_OPTIONS[0];
  });
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // product being edited
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState(null);

  // Debounce the search box so we only hit the API after the user pauses.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Lock background scrolling while the add/edit modal is open.
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modalOpen]);

  useEffect(() => {
    let ignore = false;

    const fetchProducts = async () => {
      setLoading(true);
      setError("");
      try {
        const query = search
          ? `&search=${encodeURIComponent(search)}`
          : "";
        const { data } = await api.get(
          `/admin/products?page=${page}&limit=${itemsPerPage}${query}`
        );
        if (ignore) return;

        const nextTotalPages = Math.max(1, Number(data.totalPages) || 1);
        if (page > nextTotalPages) {
          setPage(nextTotalPages);
          return;
        }

        setProducts(Array.isArray(data.products) ? data.products : []);
        setTotal(Number(data.total) || 0);
        setTotalPages(nextTotalPages);
      } catch (err) {
        if (ignore) return;
        setError(err.response?.data?.message || "Failed to load products.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchProducts();
  }, [page, search, itemsPerPage, refresh]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name: product.name || "",
      price: product.price ?? "",
      description: product.description || "",
      category: product.category || "",
      image: product.image || "",
      countInStock: product.countInStock ?? 10,
      brand: product.brand || "",
      sku: product.sku || "",
      isFeatured: product.isFeatured || false,
      isWeeklyDeal: product.isWeeklyDeal || false,
      isNewArrival: product.isNewArrival || false,
    });
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        countInStock: Number(form.countInStock),
      };
      if (editing) {
        await api.put(`/admin/products/${editing._id}`, payload);
        setNotice("Product updated.");
      } else {
        await api.post("/admin/products", payload);
        setNotice("Product created.");
      }
      setRefresh((r) => r + 1);
      setModalOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Delete this product permanently?")) return;
    setSavingId(id);
    setError("");
    setNotice("");
    try {
      await api.delete(`/admin/products/${id}`);
      if (products.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        setRefresh((r) => r + 1);
      }
      setNotice("Product deleted.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete product.");
    } finally {
      setSavingId(null);
    }
  };

  const handleItemsPerPage = (e) => {
    const value = Number(e.target.value);
    localStorage.setItem(PER_PAGE_STORAGE_KEY, String(value));
    setItemsPerPage(value);
    setPage(1);
  };

  const flagsFor = (p) => {
    const flags = [];
    if (p.isFeatured) flags.push(<Flag key="f" className="bg-purple-100 text-purple-700">Featured</Flag>);
    if (p.isWeeklyDeal) flags.push(<Flag key="d" className="bg-amber-100 text-amber-700">Deal</Flag>);
    if (p.isNewArrival) flags.push(<Flag key="n" className="bg-blue-100 text-blue-700">New</Flag>);
    return flags.length ? <div className="flex gap-1 flex-wrap">{flags}</div> : <span className="text-gray-400 text-xs">—</span>;
  };

  const columns = [
    {
      key: "product",
      header: "Product",
      render: (p) => (
        <div className="flex items-center gap-3">
          <img
            src={p.image || "/images/placeholder.jpg"}
            onError={(e) => (e.target.src = "/images/placeholder.jpg")}
            alt={p.name}
            className="w-10 h-10 object-cover rounded shrink-0"
          />
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate max-w-[220px]">
              {p.name}
            </p>
            <p className="text-xs text-gray-400 truncate max-w-[220px]">
              {p.description}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (p) => <span className="text-gray-700">{p.category || "—"}</span>,
    },
    {
      key: "sku",
      header: "SKU",
      render: (p) => (
        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
          {p.sku || "—"}
        </code>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (p) => (
        <span className="font-semibold text-gray-900">{currency(p.price)}</span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      render: (p) => (
        <span
          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
            (p.countInStock ?? 0) < 10
              ? "bg-amber-100 text-amber-700"
              : "bg-primary-100 text-primary-700"
          }`}
        >
          {p.countInStock ?? 0}
        </span>
      ),
    },
    { key: "flags", header: "Flags", render: flagsFor },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (p) => (
        <div className="inline-flex items-center gap-4 whitespace-nowrap">
          <button
            onClick={() => openEdit(p)}
            disabled={savingId === p._id}
            aria-label={`Edit ${p.name}`}
            className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-900 disabled:opacity-50 text-xs font-semibold"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => deleteProduct(p._id)}
            disabled={savingId === p._id}
            aria-label={`Delete ${p.name}`}
            className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 disabled:opacity-50 text-xs font-semibold"
          >
            {savingId === p._id ? (
              "Deleting..."
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </>
            )}
          </button>
        </div>
      ),
    },
  ];

  const inputClass =
    "w-full border border-gray-300 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-400";

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Manage Products
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Add, edit and remove products from your catalog.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Product
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

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-52 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Show
          <select
            value={itemsPerPage}
            onChange={handleItemsPerPage}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {ITEMS_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          per page
        </label>
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : products.length === 0 ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-10 text-center text-gray-500">
          <PackagePlus className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          {search
            ? "No products match your search."
            : "No products in your catalog yet."}
        </div>
      ) : (
        <AdminTable columns={columns} rows={products} keyFn={(p) => p._id} minWidth={860} />
      )}

      {!loading && products.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={itemsPerPage}
          className="mt-6"
        />
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !submitting && setModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? "Edit Product" : "Add New Product"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                aria-label="Close"
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    name="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (£) *
                  </label>
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.price}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock *
                  </label>
                  <input
                    name="countInStock"
                    type="number"
                    min="0"
                    required
                    value={form.countInStock}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    placeholder="e.g. Fruits"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <input
                    name="brand"
                    value={form.brand}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SKU (Product Code)
                  </label>
                  <input
                    name="sku"
                    value={form.sku}
                    onChange={handleChange}
                    placeholder="Leave blank to auto-generate"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image URL
                  </label>
                  <input
                    name="image"
                    value={form.image}
                    onChange={handleChange}
                    placeholder="/images/placeholder.jpg"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    value={form.description}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    checked={form.isFeatured}
                    onChange={handleChange}
                    className="w-4 h-4 accent-primary-600"
                  />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="isWeeklyDeal"
                    checked={form.isWeeklyDeal}
                    onChange={handleChange}
                    className="w-4 h-4 accent-primary-600"
                  />
                  Weekly deal
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="isNewArrival"
                    checked={form.isNewArrival}
                    onChange={handleChange}
                    className="w-4 h-4 accent-primary-600"
                  />
                  New arrival
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : editing
                    ? "Save Changes"
                    : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Flag({ className = "", children }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}