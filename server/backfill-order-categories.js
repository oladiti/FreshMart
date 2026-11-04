// server/backfill-order-categories.js
// Order items created before category snapshots existed have no category.
// Recover what we can from current products by matching the item SKU first,
// then the product name. Used by migrate-order-categories.js and at startup.
import Order from "./models/Order.js";
import Product from "./models/Product.js";

const normalizedSku = (sku) => String(sku || "").trim().toUpperCase();
const normalizedName = (name) => String(name || "").trim().toLowerCase();

export const backfillMissingOrderCategories = async () => {
  const orders = await Order.collection
    .find({
      items: {
        $elemMatch: { category: { $in: [null, ""] } },
      },
    })
    .project({ items: 1 })
    .toArray();

  if (!orders.length) return 0;

  const products = await Product.find({})
    .select("name sku category")
    .lean();

  const categoryBySku = new Map();
  const categoryByName = new Map();
  for (const product of products) {
    if (!product.category) continue;
    const sku = normalizedSku(product.sku);
    const name = normalizedName(product.name);
    if (sku && !categoryBySku.has(sku)) categoryBySku.set(sku, product.category);
    if (name && !categoryByName.has(name)) {
      categoryByName.set(name, product.category);
    }
  }

  const operations = [];
  for (const order of orders) {
    let changed = false;
    const items = (order.items || []).map((item) => {
      if (item.category) return item;
      const category =
        categoryBySku.get(normalizedSku(item.sku)) ||
        categoryByName.get(normalizedName(item.name));
      if (!category) return item;
      changed = true;
      return { ...item, category };
    });

    if (changed) {
      operations.push({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: { items } },
        },
      });
    }
  }

  if (!operations.length) return 0;
  await Order.collection.bulkWrite(operations);
  return operations.length;
};
