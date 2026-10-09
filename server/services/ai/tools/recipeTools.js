// AI recipe tools.
//
// Recipes live in Mongo with free-text ingredients, so matching a dish to the
// catalogue reuses the assistant's proven ingredient matcher (recipeMatch.js).
// Every product quoted from a recipe is grounded against a real Product
// document first.

import RecipeModel from "../../../models/Recipe.js";
import ProductModel from "../../../models/Product.js";
import { createMatcher, matchRecipe, matchIngredient } from "../../assistant/recipeMatch.js";
import { groundProduct } from "../../assistant/tools/grounding.js";
import { asString, asPositiveInt, asStringArray, ensurePlainObject } from "./helpers.js";

const recipeCard = (recipe) => ({
  _id: String(recipe._id),
  title: recipe.title,
  category: recipe.category ?? null,
  diet: recipe.diet ?? null,
  image: recipe.image ?? null,
  slug: recipe.slug ?? null,
  description: recipe.description ?? null,
  ingredientCount: Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0,
});

const recipeFull = (recipe) => ({
  _id: String(recipe._id),
  title: recipe.title,
  category: recipe.category ?? null,
  diet: recipe.diet ?? null,
  image: recipe.image ?? null,
  slug: recipe.slug ?? null,
  description: recipe.description ?? null,
  ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
  steps: Array.isArray(recipe.steps) ? recipe.steps : [],
});

async function loadRecipe(recipeId, { cards = false } = {}) {
  if (!recipeId) return null;
  const matcher = { $or: [{ _id: recipeId }, { slug: recipeId }] };
  try {
    const doc = await RecipeModel.findOne(matcher).lean();
    if (!doc) return null;
    return cards ? recipeCard(doc) : recipeFull(doc);
  } catch (error) {
    return null;
  }
}

/** In-stock products only: suggesting something we cannot sell is worse than a gap. */
async function inStockCatalogue() {
  return ProductModel.find({ countInStock: { $gt: 0 } }).lean();
}

/** Ground every product a match result points at (primary + alternatives). */
async function groundedMatchView(result) {
  const grounded = new Map();
  for (const doc of result.allProducts) {
    grounded.set(String(doc._id), groundProduct(doc));
  }
  const ground = (doc) => {
    const hit = grounded.get(String(doc?._id));
    if (!hit) {
      throw new Error(`AI recipe grounding missed product ${doc?._id ?? "<unknown>"}`);
    }
    return hit;
  };

  const lines = result.matched.map((line) => ({
    ingredient: line.ingredient,
    quantity: "as needed",
    product: ground(line.matches[0].product),
    confidence: line.matches[0].confidence,
    ambiguous: line.matches[0].ambiguous,
    alternatives: line.matches.slice(1, 3).map((m) => ground(m.product)),
  }));

  // Line totals are real catalogue unit prices; no price is invented.
  const total = Number(
    lines.reduce((sum, line) => sum + Number(line.product.price || 0), 0).toFixed(2)
  );

  return {
    recipe: result.recipe
      ? { _id: String(result.recipe._id), title: result.recipe.title, category: result.recipe.category ?? null, slug: result.recipe.slug ?? null }
      : null,
    lines,
    matchedCount: lines.length,
    unmatched: result.unmatched.map((line) => line.ingredient),
    duplicates: result.duplicates.map((line) => ({ ingredient: line.ingredient, duplicateOf: line.duplicateOf })),
    total,
  };
}

/* ------------------------------------------------------------------ *
 * searchRecipes
 * ------------------------------------------------------------------ */

export const SEARCH_RECIPES_TOOL = {
  name: "searchRecipes",
  description: "Search real recipes from the store's recipe collection by keyword or category. Returns titles, categories and dietary tags only from the database.",
  requiresAuth: false,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      keyword: { type: "string", maxLength: 120, description: "Free text matched against recipe title, description and ingredients." },
      category: { type: "string", maxLength: 60 },
      limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
    },
  },
  runner: async (_ctx, rawArgs) => {
    const errors = [];
    ensurePlainObject(rawArgs, errors);
    const keyword = asString(rawArgs?.keyword, "keyword", errors, { max: 120 });
    const category = asString(rawArgs?.category, "category", errors, { max: 60 });
    const limit = asPositiveInt(rawArgs?.limit, "limit", errors, { fallback: 10, max: 20 });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors, results: [] };

    const filter = {};
    if (keyword) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { ingredients: { $regex: escaped, $options: "i" } },
      ];
    }
    if (category) filter.category = category;

    const docs = await RecipeModel.find(filter).sort({ createdAt: -1, _id: 1 }).limit(limit).lean();
    return {
      ok: true,
      status: docs.length ? "ok" : "no_results",
      results: docs.map(recipeCard),
      notes: docs.length ? [] : ["no_recipes_found"],
    };
  },
};

/* ------------------------------------------------------------------ *
 * getRecipe
 * ------------------------------------------------------------------ */

export const GET_RECIPE_TOOL = {
  name: "getRecipe",
  description: "Fetch one real recipe by its MongoDB _id or slug, including its ingredient list and steps. Never invents a recipe.",
  requiresAuth: false,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      recipeId: { type: "string", description: "Recipe _id or slug." },
    },
    required: ["recipeId"],
  },
  runner: async (_ctx, rawArgs) => {
    const errors = [];
    const recipeId = asString(rawArgs?.recipeId, "recipeId", errors, { required: true });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors };

    const recipe = await loadRecipe(recipeId);
    if (!recipe) return { ok: true, status: "not_found", recipe: null, notes: ["recipe_not_found"] };
    return { ok: true, status: "ok", recipe };
  },
};

/* ------------------------------------------------------------------ *
 * generateShoppingListFromRecipe (with real prices)
 * ------------------------------------------------------------------ */

export const GENERATE_SHOPPING_LIST_TOOL = {
  name: "generateShoppingListFromRecipe",
  description:
    "Turn a real recipe into a shopping list of real in-stock catalogue products, with the real unit price of each matched product and a real total. Unmatched ingredients are reported honestly. Never invents prices or products.",
  requiresAuth: false,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      recipeId: { type: "string", description: "Recipe _id or slug." },
      people: { type: "integer", minimum: 1, maximum: 50, default: 2, description: "How many people to cook for; scales the estimate." },
    },
    required: ["recipeId"],
  },
  runner: async (_ctx, rawArgs) => {
    const errors = [];
    ensurePlainObject(rawArgs, errors);
    const recipeId = asString(rawArgs?.recipeId, "recipeId", errors, { required: true });
    const people = asPositiveInt(rawArgs?.people, "people", errors, { fallback: 2, max: 50 });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors };

    const recipe = await loadRecipe(recipeId);
    if (!recipe) return { ok: true, status: "not_found", recipe: null, notes: ["recipe_not_found"] };

    const catalogue = await inStockCatalogue();
    if (!catalogue.length) {
      return { ok: true, status: "no_stock", recipe: { title: recipe.title }, lines: [], matchedCount: 0, unmatched: recipe.ingredients, total: 0, notes: ["no_in_stock_products"] };
    }

    const matcher = createMatcher(catalogue);
    const result = matchRecipe(recipe, catalogue, matcher.context);
    const view = await groundedMatchView(result);

    return {
      ok: true,
      status: "ok",
      ...view,
      people,
      note: "Each matched ingredient maps to one real catalogue unit; scale quantities up when you shop. Prices are the live unit prices.",
    };
  },
};

/* ------------------------------------------------------------------ *
 * matchRecipeIngredientsToProducts
 * ------------------------------------------------------------------ */

export const MATCH_RECIPE_INGREDIENTS_TOOL = {
  name: "matchRecipeIngredientsToProducts",
  description:
    "Match a shopper's own free-text ingredient list against real in-stock catalogue products. Reports each match with the real product, its live price, and an honest confidence level; never invents a product.",
  requiresAuth: false,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      ingredients: {
        type: "array",
        items: { type: "string", maxLength: 200 },
        maxItems: 25,
        minItems: 1,
        description: "The shopper's ingredient lines exactly as they wrote them.",
      },
    },
    required: ["ingredients"],
  },
  runner: async (_ctx, rawArgs) => {
    const errors = [];
    const ingredients = asStringArray(rawArgs?.ingredients, "ingredients", errors, {
      maxItems: 25,
      maxLength: 200,
    });
    if (errors.length) return { ok: false, status: "invalid_arguments", errors };
    if (!ingredients.length) {
      return { ok: false, status: "invalid_arguments", errors: [{ field: "ingredients", message: "ingredients must include at least one line." }] };
    }

    const catalogue = await inStockCatalogue();
    if (!catalogue.length) {
      return { ok: true, status: "no_stock", lines: [], matchedCount: 0, unmatched: ingredients, total: 0, notes: ["no_in_stock_products"] };
    }

    const matcher = createMatcher(catalogue);
    const lines = ingredients.map((ingredient) => {
      const found = matchIngredient(ingredient, catalogue, matcher.context);
      if (!found.matches.length) {
        return { ingredient, matched: false, confidence: null, product: null, alternatives: [], ignored: found.ignored };
      }
      const primary = groundProduct(found.matches[0].product);
      return {
        ingredient,
        matched: true,
        confidence: found.matches[0].confidence,
        ambiguous: found.matches[0].ambiguous,
        product: primary,
        alternatives: found.matches.slice(1, 3).map((m) => groundProduct(m.product)),
      };
    });

    const matchedCount = lines.filter((line) => line.matched).length;
    const total = Number(
      lines.reduce((sum, line) => sum + (line.matched ? Number(line.product.price || 0) : 0), 0).toFixed(2)
    );

    return {
      ok: true,
      status: "ok",
      lines,
      matchedCount,
      unmatched: lines.filter((line) => !line.matched).map((line) => line.ingredient),
      total,
      note: "Each line maps to one real catalogue unit at its live unit price.",
    };
  },
};

export const AI_RECIPE_TOOLS = [
  SEARCH_RECIPES_TOOL,
  GET_RECIPE_TOOL,
  GENERATE_SHOPPING_LIST_TOOL,
  MATCH_RECIPE_INGREDIENTS_TOOL,
];