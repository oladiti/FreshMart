// POST /api/assistant/query
//
// Orchestrates: parse the message -> resolve against the catalogue -> compose a
// reply plus structured data for the client to render. All language handling
// lives in services/assistant; this file only coordinates I/O.
 
import Product from "../models/Product.js";
import Recipe from "../models/Recipe.js";
import { INTENTS, parseQuery, tokenize } from "../services/assistant/parseQuery.js";
import { searchProducts } from "../services/assistant/tools/index.js";
import { groundProduct } from "../services/assistant/tools/grounding.js";
import { createMatcher, matchRecipe } from "../services/assistant/recipeMatch.js";
import { buildBasket } from "../services/assistant/buildBasket.js";
 
const MAX_QUERY_LENGTH = 300;
const MAX_RESULTS = 24;
 
/**
 * Shape a grounded product for the client (mirrors the storefront ProductCard
 * needs). Reads only fields the tool verified against the Product document.
 */
const toCard = (p) => ({
  _id: p._id,
  name: p.name,
  price: p.price,
  image: p.image,
  category: p.category ?? null,
  slug: p.slug,
  sku: p.sku,
  countInStock: p.countInStock,
  isWeeklyDeal: Boolean(p.isWeeklyDeal),
  isFeatured: Boolean(p.isFeatured),
  reviewCount: p.reviewCount ?? 0,
});
 
const gbp = (n) =>
  `£${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
 
/** Cheapest and dearest in the catalogue, for honest budget messaging. */
async function getCatalogRange() {
  const [min, max, productCount] = await Promise.all([
    Product.findOne({}, { price: 1 }).sort({ price: 1 }).lean(),
    Product.findOne({}, { price: 1 }).sort({ price: -1 }).lean(),
    Product.countDocuments({}),
  ]);
  return {
    minPrice: min?.price ?? null,
    maxPrice: max?.price ?? null,
    productCount,
  };
}
/**
 * Resolve products for an intent.
 *
 * Everything goes through the `searchProducts` tool, so every product fact in a
 * reply is a projected, verified copy of a real Product document. The slots the
 * parser produced are translated into tool arguments; the tool owns filtering,
 * sorting, pagination and grounding.
 */
async function resolveProducts(slots, { limit = MAX_RESULTS } = {}) {
  const result = await searchProducts({
    keyword: slots.query || undefined,
    category: slots.categories?.length ? slots.categories : undefined,
    minPrice: slots.minPrice ?? undefined,
    maxPrice: slots.maxPrice ?? undefined,
    availability: slots.inStock ? "in_stock" : undefined,
    sort: slots.sort && slots.sort !== "relevance" ? slots.sort : undefined,
    pageSize: Math.min(limit, 50),
  });
 
  if (!result.ok) {
    // The parser produced something the tool refused; treat it as no matches
    // rather than reaching for the collection directly.
    return [];
  }
  return result.results;
}
 
/** Find the recipe whose title best matches the dish the shopper named. */
async function findRecipe(dishText) {
  if (!dishText) return null;
  const tokens = tokenize(dishText).filter((t) => t.length > 2);
  if (!tokens.length) return null;
 
  const candidates = await Recipe.find({}).lean();
  if (!candidates.length) return null;
 
  let best = null;
  let bestScore = 0;
  for (const recipe of candidates) {
    const title = String(recipe.title || "").toLowerCase();
    const tokensHit = tokens.filter((t) => title.includes(t)).length;
    const score = tokensHit / tokens.length;
    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }
  return bestScore >= 0.5 ? best : null;
}
 
const SUGGESTIONS = {
  [INTENTS.PRODUCT_SEARCH]: ["Show me snacks", "What's in stock?", "Find cheap rice"],
  [INTENTS.VALUE_FIND]: ["Show me rice", "Snacks under my budget", "What's on offer?"],
  [INTENTS.BUDGET_BASKET]: ["Show me rice", "Ingredients for jollof rice"],
  [INTENTS.RECIPE_INGREDIENTS]: ["What can I buy with a set budget?", "Show me spices"],
  [INTENTS.AVAILABILITY]: ["Show me vegetables", "Find cheap cooking oil"],
  [INTENTS.BUNDLE]: ["Ingredients for egusi soup", "Show me drinks"],
  [INTENTS.UNCLEAR]: [
    "Show me rice",
    "Find cheap cooking oil",
    "Ingredients for jollof rice",
  ],
};
 
export const queryAssistant = async (req, res) => {
  try {
    const raw = req.body?.query;
    const text = typeof raw === "string" ? raw.trim() : "";
 
    if (!text) {
      return res.status(400).json({ message: "Please type what you are looking for." });
    }
    if (text.length > MAX_QUERY_LENGTH) {
      return res
        .status(400)
        .json({ message: `Please keep it under ${MAX_QUERY_LENGTH} characters.` });
    }
 
    const { intent, slots, confidence } = parseQuery(text);
    const catalog = await getCatalogRange();
 
    const notes = [];
    let reply = "";
    let products = [];
    let basket = null;
    let recipe = null;
    let clarifyingQuestion = null;
 
    // A budget above the dearest item filters nothing, so say so rather than
    // silently returning the whole shop.
    const cap = slots.maxPrice ?? slots.budget;
    if (cap !== null && catalog.maxPrice !== null && cap >= catalog.maxPrice) {
      notes.push("budget-above-range");
    }
 
    // Nothing to search on. Running the query would build an empty Mongo
    // filter and return the entire catalogue, which is never the answer.
    const hasTarget =
      Boolean(slots.query) ||
      slots.categories.length > 0 ||
      slots.minPrice !== null ||
      slots.maxPrice !== null ||
      slots.budget !== null ||
      Boolean(slots.occasion);
 
    if (intent === INTENTS.UNCLEAR || !hasTarget) {
      reply =
        "Tell me what you're after - a product, a category, a price limit or a budget - and I'll find it.";
      clarifyingQuestion = "What are you looking for?";
    } else {
      switch (intent) {
        case INTENTS.RECIPE_INGREDIENTS: {
          const found = await findRecipe(slots.recipeQuery || slots.query);
          if (!found) {
            notes.push("recipe-not-found");
            products = await resolveProducts(slots);
            reply = products.length
              ? `I couldn't find that recipe, but here's what matches "${slots.query}".`
              : `I couldn't find a recipe or product for "${slots.query}".`;
            if (!products.length) clarifyingQuestion = "What dish or ingredient were you after?";
            break;
          }
 
          // Match against in-stock products only: suggesting something we cannot
          // sell is worse than admitting a gap.
          const candidates = await Product.find({ countInStock: { $gt: 0 } }).lean();
          const matcher = createMatcher(candidates);
 
          const result = matchRecipe(found, candidates, matcher.context);
 
          // Recipe matches come from raw documents, so ground them before any of
          // it can be quoted. `allProducts` is every product the result points
          // at - the primary matches *and* the alternatives shown beside them.
          const grounded = new Map(
            result.allProducts.map((doc) => [String(doc._id), groundProduct(doc)])
          );
          // A miss here would hand `toCard` an undefined product and either 500
          // or, worse, quote a blank row. Fail loudly instead.
          const ground = (doc) => {
            const hit = grounded.get(String(doc?._id));
            if (!hit) {
              throw new Error(
                `Assistant grounding missed product ${doc?._id ?? "<unknown>"}`
              );
            }
            return hit;
          };
 
          recipe = {
            _id: result.recipe._id,
            title: result.recipe.title,
            category: result.recipe.category,
            matched: result.matched.map((line) => ({
              ingredient: line.ingredient,
              product: toCard(ground(line.matches[0].product)),
              confidence: line.matches[0].confidence,
              ambiguous: line.matches[0].ambiguous,
              matchedOn: line.matchedOn,
              alternatives: line.matches.slice(1, 4).map((m) => toCard(ground(m.product))),
            })),
            unmatched: result.unmatched.map((line) => line.ingredient),
            duplicates: result.duplicates.map((line) => ({
              ingredient: line.ingredient,
              duplicateOf: line.duplicateOf,
            })),
          };
          products = result.products.map((doc) => toCard(ground(doc)));
 
          const foundCount = recipe.matched.length;
          reply = foundCount
            ? `${foundCount} of ${foundCount + result.unmatched.length} ingredients for ${found.title} are in our catalogue.`
            : `I found the recipe for ${found.title}, but none of its ingredients are in stock right now.`;
          if (result.unmatched.length) {
            notes.push("some-ingredients-unavailable");
          }
          break;
        }
 
        case INTENTS.BUDGET_BASKET: {
          const budget = Number(slots.budget ?? slots.maxPrice ?? 0);
          if (!budget || budget <= 0) {
            reply = "Tell me a budget and I'll fill a basket with it.";
            clarifyingQuestion = "What's your budget?";
            break;
          }
          const affordable = await resolveProducts(
            { ...slots, maxPrice: budget, inStock: true },
            { limit: 200 }
          );
          basket = buildBasket(affordable, budget, { mapItem: toCard });
          products = basket.items;
          reply = basket.items.length
            ? `Here's ${basket.items.length} items for ${gbp(basket.total)}, leaving ${gbp(basket.remaining)} of your ${gbp(budget)}.`
            : `Nothing in the shop fits within ${gbp(budget)}.`;
          if (!basket.items.length) clarifyingQuestion = "Would you like to raise the budget?";
          break;
        }
 
        case INTENTS.BUNDLE: {
          const staples = await resolveProducts(
            {
              ...slots,
              categories: slots.categories,
              inStock: true,
            },
            { limit: 50 }
          );
          products = staples.slice(0, 12).map(toCard);
          reply = products.length
            ? `Here are some staples for ${slots.occasion}. Tell me how many people and I'll narrow it down.`
            : "I couldn't find anything for that. Try naming a dish or ingredient.";
          clarifyingQuestion = "How many people are you feeding, and how long do you need it for?";
          break;
        }
 
        case INTENTS.AVAILABILITY: {
          const inStock = await resolveProducts({ ...slots, inStock: true });
          const all = await resolveProducts(slots);
          const outOfStock = all.filter(
            (p) => !(inStock.find((s) => String(s._id) === String(p._id)))
          );
          products = inStock.slice(0, 12).map(toCard);
          reply = products.length
            ? `Yes — ${products.length} option${products.length === 1 ? "" : "s"} in stock.`
            : `Nothing matching "${slots.query || "that"}" is in stock right now.`;
          if (outOfStock.length) {
            notes.push(`${outOfStock.length} matching product(s) are sold out`);
          }
          if (!products.length) {
            clarifyingQuestion = "Would you like something similar instead?";
          }
          break;
        }
 
        case INTENTS.VALUE_FIND: {
          products = (await resolveProducts(slots)).slice(0, 12).map(toCard);
          reply = products.length
            ? `Here are the cheapest matches for ${slots.query || "your request"}.`
            : `Nothing matched "${slots.query}".`;
          if (!products.length) {
            clarifyingQuestion = "Could you name a product or category?";
          }
          break;
        }
 
        default: {
          products = (await resolveProducts(slots)).slice(0, 12).map(toCard);
          if (!products.length) {
            // Low-confidence text that matched nothing is a clarification, not a
            // confident "no results".
            if (confidence < 0.5) {
              reply = `I didn't quite get that. I can search by product, category or price.`;
              clarifyingQuestion = "What are you looking for?";
            } else {
              reply = `Nothing matched "${slots.query}".`;
            }
          } else {
            reply = `Found ${products.length} match${products.length === 1 ? "" : "es"}.`;
          }
        }
        }
      }
 
    if (notes.includes("budget-above-range") && products.length) {
      reply += ` Our prices currently run ${gbp(catalog.minPrice)} to ${gbp(catalog.maxPrice)}, so that budget covers everything.`;
    }
 
    return res.json({
      success: true,
      reply,
      intent,
      confidence,
      understood: {
        query: slots.query || null,
        categories: slots.categories,
        occasion: slots.occasion,
        minPrice: slots.minPrice,
        maxPrice: slots.maxPrice,
        budget: slots.budget,
        quantity: slots.quantity,
        inStock: slots.inStock,
        sort: slots.sort,
      },
      products,
      basket,
      recipe,
      notes,
      clarifyingQuestion,
      suggestions: SUGGESTIONS[intent] || SUGGESTIONS[INTENTS.UNCLEAR],
      catalog,
    });
  } catch (error) {
    console.error("❌ Assistant query failed:", error);
    res.status(500).json({ message: "The assistant could not handle that. Please try again." });
  }
};
 
export default queryAssistant;
 