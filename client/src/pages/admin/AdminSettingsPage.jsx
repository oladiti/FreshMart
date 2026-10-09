import { useEffect, useState } from "react";
import { Settings, Save, RefreshCw } from "lucide-react";
import api from "../../utils/api";
import { SkeletonRow } from "../../components/AdminSkeletons";

const FIELDS = [
  {
    key: "storeName",
    label: "Store name",
    type: "text",
    group: "Store",
    help: "Shown in the admin header and notifications.",
  },
  {
    key: "orderPrefix",
    label: "Order number prefix",
    type: "text",
    group: "Store",
    help: "Prepended to generated order numbers.",
  },
  {
    key: "announcement",
    label: "Announcement banner",
    type: "textarea",
    group: "Store",
    help: "Shown at the top of the storefront. Leave blank to hide.",
  },
  {
    key: "currencySymbol",
    label: "Currency symbol",
    type: "text",
    group: "Pricing",
    help: "Displayed next to prices.",
  },
  {
    key: "taxRate",
    label: "Tax rate (%)",
    type: "number",
    group: "Pricing",
    help: "Percentage added to orders at checkout.",
  },
  {
    key: "shippingFee",
    label: "Delivery fee (£)",
    type: "number",
    group: "Pricing",
    help: "Flat fee charged when the free-delivery threshold is not met.",
  },
  {
    key: "freeShippingThreshold",
    label: "Free delivery threshold (£)",
    type: "number",
    group: "Pricing",
    help: "Orders at or above this total get free delivery. 0 disables it.",
  },
  {
    key: "lowStockThreshold",
    label: "Low stock alert threshold",
    type: "number",
    group: "Inventory",
    help: "Products at or below this stock level are flagged on the dashboard.",
  },
  {
    key: "deliveryTimeEstimate",
    label: "Delivery time estimate",
    type: "text",
    group: "Delivery",
    help: "Shown to customers on the delivery info page.",
  },
  {
    key: "supportEmail",
    label: "Support email",
    type: "email",
    group: "Contact",
    help: "Customer support inbox.",
  },
  {
    key: "supportPhone",
    label: "Support phone",
    type: "text",
    group: "Contact",
    help: "Customer support phone number.",
  },
];

const GROUPS = ["Store", "Pricing", "Inventory", "Delivery", "Contact"];

const inputClass =
  "w-full border border-gray-300 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-400";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/settings");
      setSettings(data || {});
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {};
      FIELDS.forEach((f) => {
        const raw = settings[f.key] ?? "";
        payload[f.key] =
          f.type === "number" && raw !== "" ? Number(raw) : raw;
      });
      const { data } = await api.put("/admin/settings", payload);
      setSettings(data || {});
      setNotice("Settings saved.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-7 h-7 text-gray-700" />
            Settings
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure your storefront, pricing, inventory and support details.
          </p>
        </div>
        <button
          onClick={fetchSettings}
          disabled={loading}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Discard changes
        </button>
      </div>

      {loading ? (
        <div className="max-w-3xl space-y-6">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <SkeletonRow className="h-5 w-44" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <SkeletonRow className="h-3.5 w-32" />
                  <SkeletonRow className="mt-2 h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <SkeletonRow className="h-5 w-32" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i}>
                  <SkeletonRow className="h-3.5 w-40" />
                  <SkeletonRow className="mt-2 h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-3xl">
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

          {GROUPS.map((group) => {
            const groupFields = FIELDS.filter((f) => f.group === group);
            if (groupFields.length === 0) return null;
            return (
              <section
                key={group}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5"
              >
                <h2 className="font-semibold text-gray-900 mb-4">{group}</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {groupFields.map((field) => (
                    <div
                      key={field.key}
                      className={field.type === "textarea" ? "sm:col-span-2" : ""}
                    >
                      <label
                        htmlFor={field.key}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        {field.label}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          id={field.key}
                          name={field.key}
                          rows={2}
                          value={settings[field.key] ?? ""}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      ) : (
                        <input
                          id={field.key}
                          name={field.key}
                          type={field.type}
                          value={settings[field.key] ?? ""}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      )}
                      {field.help && (
                        <p className="text-xs text-gray-400 mt-1">{field.help}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}