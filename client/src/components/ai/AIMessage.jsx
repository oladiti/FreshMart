import { Link } from "react-router-dom";
import { Bot, ShoppingBag, ChefHat, PackageSearch, ShieldAlert, AlertTriangle } from "lucide-react";
import { formatPrice } from "../../utils/currency";
import AIProductRecommendation from "./AIProductRecommendation";
import AIProductCard from "./AIProductCard";

/** Status badge colours for orders. */
const ORDER_STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-blue-50 text-blue-700",
  shipped: "bg-indigo-50 text-indigo-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

function ProductRecommendations({ data, onAdd, onAddAll, addedIds }) {
  return (
    <AIProductRecommendation
      title="Products"
      products={data.products}
      addedIds={addedIds}
      onAdd={onAdd}
      onAddAll={onAddAll}
    />
  );
}

function RecommendationsBlock({ recommendations, personalized, onAdd, addedIds }) {
  const entries = Array.isArray(recommendations)
    ? recommendations.filter((entry) => entry && entry.product)
    : [];
  if (entries.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {personalized ? "Recommended for you" : "Popular right now"}
      </p>
      <ul className="space-y-2">
        {entries.map(({ product, reason }) => (
          <li key={product._id} className="space-y-0.5">
            <AIProductCard
              product={product}
              onAdd={onAdd}
              added={addedIds?.has(product._id)}
            />
            {reason && <p className="px-1 text-[11px] text-gray-400">{reason}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CartSummary({ cart }) {
  if (!cart) return null;
  if (!cart.items?.length) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
        Your cart is empty.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
      <div className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <ShoppingBag className="h-3.5 w-3.5" />
        Your cart
      </div>
      <ul className="divide-y divide-gray-100 px-3 py-1">
        {cart.items.map((item) => (
          <li key={item.product._id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="min-w-0 truncate text-gray-800">
              {item.product.name}
              <span className="text-gray-400"> × {item.quantity}</span>
            </span>
            <span className="shrink-0 font-medium text-gray-900">
              {formatPrice(item.lineTotal)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900">
        <span>Total</span>
        <span>{formatPrice(cart.total)}</span>
      </div>
      <Link
        to="/cart"
        className="block bg-primary-500 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-primary-600"
      >
        Go to checkout
      </Link>
    </div>
  );
}

function RecipeBlock({ recipeData }) {
  const recipe = recipeData.recipe;
  const hasList = Array.isArray(recipeData.lines);
  const hasFull = recipe && Array.isArray(recipe.ingredients);
  const hasMatched = Array.isArray(recipeData.matched);

  // Rule-based assistant answer: ingredient -> product matches rather than a
  // full method. Every line is grounded, so quote the product it landed on.
  if (hasMatched) {
    const unmatched = Array.isArray(recipeData.unmatched) ? recipeData.unmatched : [];
    const duplicates = Array.isArray(recipeData.duplicates) ? recipeData.duplicates : [];

    return (
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <ChefHat className="h-3.5 w-3.5" />
          Recipe
        </div>
        <div className="px-3 py-2">
          <p className="text-sm font-semibold text-gray-900">{recipeData.title}</p>
          {recipeData.category && (
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {recipeData.category}
            </p>
          )}
          {recipeData.matched.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-100">
              {recipeData.matched.map((line, index) => (
                <li key={`${line.ingredient}-${index}`} className="py-1.5">
                  <p className="text-sm text-gray-800">{line.ingredient}</p>
                  {line.product ? (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {line.product.name} ·{" "}
                      <span className="font-medium text-gray-700">
                        {formatPrice(line.product.price)}
                      </span>
                      {line.ambiguous ? " · best guess" : ""}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-red-500">Not in our catalogue</p>
                  )}
                  {line.alternatives?.length > 0 && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      Also: {line.alternatives.map((alt) => alt.name).join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {unmatched.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">Not stocked: {unmatched.join(", ")}</p>
          )}
          {duplicates.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Counted once: {duplicates.map((line) => line.ingredient).join(", ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (hasFull && !hasList) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <ChefHat className="h-3.5 w-3.5" />
          Recipe
        </div>
        <div className="px-3 py-2">
          <p className="text-sm font-semibold text-gray-900">{recipe.title}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
            Ingredients
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-gray-700">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>{ingredient}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (hasList) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <ShoppingBag className="h-3.5 w-3.5" />
          Shopping list
        </div>
        <ul className="divide-y divide-gray-100 px-3 py-1">
          {recipeData.lines.map((line) => (
            <li key={line.ingredient} className="py-1.5">
              <p className="text-sm text-gray-800">{line.ingredient}</p>
              {line.product ? (
                <p className="mt-0.5 text-xs text-gray-500">
                  {line.product.name} ·{" "}
                  <span className="font-medium text-gray-700">
                    {formatPrice(line.product.price)}
                  </span>
                  {line.confidence === "low" ? " · best guess" : ""}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-red-500">Not in our catalogue</p>
              )}
            </li>
          ))}
        </ul>
        {recipeData.total > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900">
            <span>Estimated total</span>
            <span>{formatPrice(recipeData.total)}</span>
          </div>
        )}
        {recipeData.unmatched?.length > 0 && (
          <p className="border-t border-gray-100 px-3 py-2 text-xs text-amber-700">
            Not stocked: {recipeData.unmatched.join(", ")}
          </p>
        )}
        {recipeData.note && (
          <p className="px-3 py-1.5 text-xs text-gray-400">{recipeData.note}</p>
        )}
      </div>
    );
  }

  return null;
}

function OrdersBlock({ orders, title }) {
  if (!Array.isArray(orders) || orders.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
      <div className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <PackageSearch className="h-3.5 w-3.5" />
        {title || "Orders"}
      </div>
      <ul className="divide-y divide-gray-100 px-3 py-1">
        {orders.map((order) => (
          <li key={order._id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">
                {order.reference || order._id?.slice(-8)}
              </p>
              {order.createdAt && (
                <p className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                  ORDER_STATUS_STYLES[order.status] || "bg-gray-100 text-gray-600"
                }`}
              >
                {order.status}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {formatPrice(order.total)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminBlock({ admin }) {
  if (!admin) return null;

  if (admin.type === "sales_summary") {
    const s = admin.summary;
    const cells = [
      ["Revenue", formatPrice(s.totalRevenue)],
      ["Orders", s.totalOrders],
      ["Avg order", formatPrice(s.averageOrderValue)],
      ["Units sold", s.unitsSold],
      ["Customers", s.activeCustomers],
      ["Cancelled", s.cancelledOrders],
    ];
    return (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">
          Sales · last {admin.days} days
        </p>
        <div className="grid grid-cols-2 gap-2">
          {cells.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-white p-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
              <p className="text-sm font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (admin.type === "low_stock") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
          Low stock ({admin.threshold} or below)
        </p>
        <ul className="divide-y divide-amber-100">
          {admin.products?.map((product) => (
            <li key={product._id} className="flex justify-between gap-2 py-1 text-sm">
              <span className="truncate text-gray-800">{product.name}</span>
              <span className="shrink-0 font-medium text-gray-700">
                {product.countInStock} left
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (admin.type === "top_products") {
    return (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">
          Top sellers
        </p>
        <ul className="divide-y divide-indigo-100">
          {admin.products?.map((product, index) => (
            <li key={product.name} className="flex justify-between gap-2 py-1 text-sm">
              <span className="truncate text-gray-800">
                {index + 1}. {product.name}
              </span>
              <span className="shrink-0 font-medium text-gray-700">
                {product.unitsSold} sold
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-gray-700">
      <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(admin, null, 2)}</pre>
    </div>
  );
}

function ConfirmBanner({ needsConfirmation, onConfirm }) {
  if (!needsConfirmation) return null;
  const summary = needsConfirmation.summary || {};
  const isClear = summary.reason === "clear_cart";
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="flex items-start gap-1.5 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {isClear
          ? "Clear the whole cart?"
          : `Add ${summary.quantity ?? ""} of ${summary.name ?? "this item"}?`}
      </p>
      {onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
        >
          Confirm
        </button>
      )}
    </div>
  );
}

/**
 * One chat bubble. Assistant messages render their structured `data` blocks
 * (products, cart, recipe, orders, admin stats, confirmation prompts).
 */
export default function AIMessage({
  message,
  onAdd,
  onAddAll,
  addedIds,
  onConfirm,
}) {
  const isUser = message.role === "user";
  const data = message.data || {};

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary-500 px-3.5 py-2 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
        <Bot className="h-4 w-4" />
      </span>
      <div className="min-w-0 max-w-[85%] space-y-2">
        <div className="rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm text-gray-800 shadow-sm ring-1 ring-gray-100">
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.degraded && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
              <ShieldAlert className="h-3 w-3" />
              Running in basic mode
            </p>
          )}
        </div>

        {data.products?.length > 0 && (
          <ProductRecommendations
            data={data}
            onAdd={onAdd}
            onAddAll={onAddAll}
            addedIds={addedIds}
          />
        )}
        <RecommendationsBlock
          recommendations={data.recommendations}
          personalized={Boolean(data.personalized)}
          onAdd={onAdd}
          addedIds={addedIds}
        />
        {data.basket && data.basket.items?.length > 0 && (
          <AIProductRecommendation
            title={data.basket.kind === "reorder" ? "Reorder list" : "Proposed basket"}
            products={data.basket.items}
            addedIds={addedIds}
            onAdd={onAdd}
          />
        )}
        {data.basket?.missing?.length > 0 && (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Not available:{" "}
            {data.basket.missing.map((entry) => entry.name || entry).join(", ")}
          </p>
        )}
        <CartSummary cart={data.cart} />
        <RecipeBlock recipeData={data.recipe || {}} />
        <OrdersBlock orders={data.orders} />
        <OrdersBlock orders={data.history} title="Purchase history" />
        <AdminBlock admin={data.admin} />
        <ConfirmBanner
          needsConfirmation={data.needsConfirmation}
          onConfirm={onConfirm}
        />
        {data.authRequired && (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
            This needs you to be signed in. Head to your account to get started.
          </p>
        )}
        {data.notSupported && (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
            {typeof data.notSupported === "string"
              ? data.notSupported
              : "That isn't available yet."}
          </p>
        )}
        {data.basket?.items?.length === 0 && data.basket?.budget > 0 && (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Nothing fit within that budget just now.
          </p>
        )}
        {data.basket?.items?.length === 0 && data.basket?.kind === "reorder" && (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
            None of those items are available right now.
          </p>
        )}
      </div>
    </div>
  );
}