import AIProductCard from "./AIProductCard";

/**
 * A labelled block of AI-recommended products, used inside assistant replies.
 */
export default function AIProductRecommendation({
  products,
  title,
  addedIds,
  onAdd,
  onAddAll,
}) {
  if (!Array.isArray(products) || products.length === 0) return null;

  const addable = products.some(
    (product) => Number(product.countInStock) > 0
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title || "Products"}
        </p>
        {addable && onAddAll && (
          <button
            type="button"
            onClick={() => onAddAll(products)}
            className="rounded-full border border-primary-200 bg-white px-2.5 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50"
          >
            Add all to cart
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {products.map((product) => (
          <AIProductCard
            key={product._id}
            product={product}
            onAdd={onAdd}
            added={addedIds?.has(product._id)}
          />
        ))}
      </ul>
    </div>
  );
}