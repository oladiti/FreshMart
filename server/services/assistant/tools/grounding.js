// Grounding layer for product data.
//
// No product fact leaves the server unless it was projected from a real Mongo
// document by groundProduct(), and verifyGroundedProducts() re-reads those
// documents so a value that changed (or was invented) between the query and
// the reply is caught before it can be quoted. This module is the only way
// assistant/AI code is allowed to shape a product for display.

/**
 * The only fields a grounded product may carry. Every value is a primitive, so
 * a grounded copy can be compared field-by-field against a fresh read.
 */
export const GROUNDED_FIELDS = Object.freeze([
  "_id",
  "name",
  "price",
  "image",
  "category",
  "description",
  "brand",
  "slug",
  "sku",
  "countInStock",
  "isFeatured",
  "isWeeklyDeal",
  "isNewArrival",
  "reviewCount",
  "averageRating",
]);

/**
 * Project a Product document onto the whitelisted card shape.
 *
 * Missing fields stay missing (or null for `category`, which shoppers see as
 * "uncategorised" rather than a guess): nothing is inferred, defaulted from
 * another product, or rounded into existence.
 *
 * @param {object} doc a (lean) Product document
 * @returns {object} the grounded projection
 */
export function groundProduct(doc) {
  if (!doc || typeof doc !== "object" || doc._id === undefined || doc._id === null) {
    throw new Error("groundProduct: expected a product document with an _id.");
  }

  const reviews = Array.isArray(doc.reviews) ? doc.reviews : [];
  const ratings = reviews
    .map((review) => Number(review?.rating))
    .filter((rating) => Number.isFinite(rating));
  const averageRating = ratings.length
    ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(2))
    : null;

  return {
    _id: String(doc._id),
    name: doc.name,
    price: Number(doc.price ?? 0),
    image: doc.image,
    category: doc.category ?? null,
    description: doc.description,
    brand: doc.brand,
    slug: doc.slug,
    sku: doc.sku,
    countInStock: Number(doc.countInStock ?? 0),
    isFeatured: Boolean(doc.isFeatured),
    isWeeklyDeal: Boolean(doc.isWeeklyDeal),
    isNewArrival: Boolean(doc.isNewArrival),
    reviewCount: reviews.length,
    averageRating,
  };
}

/**
 * Re-read every grounded product from Mongo and compare it field-by-field.
 *
 * @param {Array<object>} results grounded products
 * @param {object} Product the Product model (or an equivalent query surface)
 * @returns {Promise<{ok: boolean, checked: number, problems: Array<object>}>}
 */
export async function verifyGroundedProducts(results, Product) {
  const report = { ok: true, checked: 0, problems: [] };
  if (!Array.isArray(results) || !results.length) return report;

  if (typeof Product?.find !== "function") {
    return {
      ok: false,
      checked: 0,
      problems: [{ field: "(root)", message: "Grounding verification needs a Product model." }],
    };
  }

  const ids = results
    .map((result) => result?._id)
    .filter((id) => id !== undefined && id !== null);
  const fresh = await Product.find({ _id: { $in: ids } }).lean();
  const byId = new Map(fresh.map((doc) => [String(doc._id), doc]));

  report.checked = results.length;

  for (const grounded of results) {
    const doc = byId.get(String(grounded?._id));
    if (!doc) {
      report.problems.push({
        id: grounded?._id ?? null,
        field: "_id",
        message: "Product no longer exists in the catalogue.",
      });
      continue;
    }

    const expected = groundProduct(doc);
    for (const field of GROUNDED_FIELDS) {
      if (!Object.is(expected[field], grounded[field])) {
        report.problems.push({
          id: grounded._id,
          field,
          expected: expected[field],
          actual: grounded[field],
        });
      }
    }
  }

  report.ok = report.problems.length === 0;
  return report;
}

/**
 * Throw unless a verification report confirms every value.
 *
 * @param {{ok: boolean, problems?: Array<object>}} report
 * @param {string} context tool name, used in the error message
 */
export function assertGrounded(report, context = "tool") {
  if (report?.ok) return report;

  const problems = Array.isArray(report?.problems) ? report.problems : [];
  const detail = problems
    .slice(0, 3)
    .map((problem) => `${problem.field ?? "?"}@${problem.id ?? "?"}`)
    .join(", ");
  const error = new Error(
    `${context} returned ungrounded product data: ${detail || "verification failed"}`
  );
  error.problems = problems;
  throw error;
}
