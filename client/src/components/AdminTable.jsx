import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Responsive admin data table.
 * - md+: renders a classic table (horizontally scrollable if needed).
 * - Mobile: renders each row as an expandable card so wide tables never
 *   force horizontal scrolling.
 *
 * columns: [{ key, header, render: (row) => ReactNode, align: "right" }]
 * rows: array of data items
 * keyFn: (row) => unique key
 * minWidth: min width for the desktop table (px)
 */
export default function AdminTable({ columns, rows, keyFn, minWidth = 800 }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggle = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3 ${col.align === "right" ? "text-right" : ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={keyFn(row)} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-3 ${
                      col.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => {
          const id = keyFn(row);
          const open = expandedId === id;
          const primary = columns[0];

          return (
            <div
              key={id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  {primary.render ? primary.render(row) : row[primary.key]}
                </div>
                <span className="shrink-0 text-gray-400">
                  {open ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </button>

              {open && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                  {columns.slice(1).map((col) => (
                    <div key={col.key}>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        {col.header}
                      </p>
                      <div className="mt-0.5 text-sm text-gray-800">
                        {col.render ? col.render(row) : row[col.key]}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}