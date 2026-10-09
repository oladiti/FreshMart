import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Search,
  X,
  Pencil,
  UtensilsCrossed,
} from "lucide-react";
import api from "../../utils/api";
import AdminTable from "../../components/AdminTable";
import { TableSkeleton } from "../../components/AdminSkeletons";

const DIET_OPTIONS = ["none", "vegan", "vegetarian", "gluten-free", "keto"];

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "",
  diet: "none",
  image: "",
  ingredients: "",
  steps: "",
};

const toLines = (value) =>
  String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export default function AdminRecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState(null);

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

    const fetchRecipes = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/admin/recipes");
        if (ignore) return;
        setRecipes(Array.isArray(data) ? data : []);
      } catch (err) {
        if (ignore) return;
        setError(err.response?.data?.message || "Failed to load recipes.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchRecipes();
  }, [refresh]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (recipe) => {
    setEditing(recipe);
    setForm({
      title: recipe.title || "",
      description: recipe.description || "",
      category: recipe.category || "",
      diet: recipe.diet || "none",
      image: recipe.image || "",
      ingredients: (recipe.ingredients || []).join("\n"),
      steps: (recipe.steps || []).join("\n"),
    });
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        diet: form.diet,
        image: form.image,
        ingredients: toLines(form.ingredients),
        steps: toLines(form.steps),
      };
      if (editing) {
        await api.put(`/admin/recipes/${editing._id}`, payload);
        setNotice("Recipe updated.");
      } else {
        await api.post("/admin/recipes", payload);
        setNotice("Recipe created.");
      }
      setRefresh((r) => r + 1);
      setModalOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save recipe.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRecipe = async (id) => {
    if (!window.confirm("Delete this recipe permanently?")) return;
    setSavingId(id);
    setError("");
    setNotice("");
    try {
      await api.delete(`/admin/recipes/${id}`);
      setRefresh((r) => r + 1);
      setNotice("Recipe deleted.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete recipe.");
    } finally {
      setSavingId(null);
    }
  };

  const query = search.trim().toLowerCase();
  const visibleRecipes = query
    ? recipes.filter(
        (r) =>
          (r.title || "").toLowerCase().includes(query) ||
          (r.category || "").toLowerCase().includes(query)
      )
    : recipes;

  const columns = [
    {
      key: "recipe",
      header: "Recipe",
      render: (r) => (
        <div className="flex items-center gap-3">
          <img
            src={r.image || "/images/placeholder.jpg"}
            onError={(e) => (e.target.src = "/images/placeholder.jpg")}
            alt={r.title}
            className="w-10 h-10 object-cover rounded shrink-0"
          />
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate max-w-[220px]">
              {r.title}
            </p>
            <p className="text-xs text-gray-400 truncate max-w-[220px]">
              {r.description}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (r) => <span className="text-gray-700">{r.category || "—"}</span>,
    },
    {
      key: "diet",
      header: "Diet",
      render: (r) => (
        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 capitalize">
          {r.diet || "none"}
        </span>
      ),
    },
    {
      key: "image",
      header: "Image",
      render: (r) => (
        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700 truncate max-w-[200px] inline-block align-middle">
          {r.image || "—"}
        </code>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (r) => (
        <div className="inline-flex items-center gap-4 whitespace-nowrap">
          <button
            onClick={() => openEdit(r)}
            disabled={savingId === r._id}
            aria-label={`Edit ${r.title}`}
            className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-900 disabled:opacity-50 text-xs font-semibold"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => deleteRecipe(r._id)}
            disabled={savingId === r._id}
            aria-label={`Delete ${r.title}`}
            className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 disabled:opacity-50 text-xs font-semibold"
          >
            {savingId === r._id ? (
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
            Manage Recipes
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Add, edit and remove recipes from your collection.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Recipe
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : visibleRecipes.length === 0 ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-10 text-center text-gray-500">
          <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          {query
            ? "No recipes match your search."
            : "No recipes in your collection yet."}
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={visibleRecipes}
          keyFn={(r) => r._id}
          minWidth={820}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !submitting && setModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? "Edit Recipe" : "Add New Recipe"}
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
                    Title *
                  </label>
                  <input
                    name="title"
                    required
                    value={form.title}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <input
                    name="category"
                    required
                    value={form.category}
                    onChange={handleChange}
                    placeholder="e.g. Main"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diet
                  </label>
                  <select
                    name="diet"
                    value={form.diet}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    {DIET_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
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
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={form.image || "/images/placeholder.jpg"}
                      onError={(e) => (e.target.src = "/images/placeholder.jpg")}
                      alt="Recipe preview"
                      className="w-16 h-16 object-cover rounded border border-gray-200"
                    />
                    <p className="text-xs text-gray-400">
                      Preview — falls back to the placeholder if the URL is
                      invalid.
                    </p>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={2}
                    value={form.description}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ingredients * <span className="text-gray-400 font-normal">(one per line)</span>
                  </label>
                  <textarea
                    name="ingredients"
                    rows={4}
                    required
                    value={form.ingredients}
                    onChange={handleChange}
                    placeholder={"Rice\nTomato\nOnion"}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Steps * <span className="text-gray-400 font-normal">(one per line)</span>
                  </label>
                  <textarea
                    name="steps"
                    rows={4}
                    required
                    value={form.steps}
                    onChange={handleChange}
                    placeholder={"Boil the rice\nAdd the sauce"}
                    className={inputClass}
                  />
                </div>
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
                    : "Create Recipe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
