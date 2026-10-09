// AI recommendation tool.
//
// Lets the assistant suggest real products. Signed-in shoppers get picks based
// on their own purchase history (via the shared recommendation engine);
// anonymous shoppers get the store's popular items only, so no personal data
// ever leaks through a guest session.

import { computeRecommendations } from "../../recommendations/computeRecommendations.js";

export const RECOMMEND_PRODUCTS_TOOL = {
  name: "recommendProducts",
  description:
    "Recommend real products to the shopper. Signed-in shoppers get picks based on what they buy; guests get the store's popular items. Never invent a product.",
  requiresAuth: false,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 10, default: 6 },
    },
  },
  runner: async (ctx, rawArgs) => {
    const limit = Number(rawArgs?.limit);
    const safeLimit =
      Number.isFinite(limit) && limit >= 1 && limit <= 10
        ? Math.floor(limit)
        : 6;

    const result = await computeRecommendations({
      user: ctx?.user || null,
      limit: safeLimit,
    });

    return {
      ok: true,
      status: result.recommendations.length ? "ok" : "no_results",
      recommendations: result.recommendations,
      personalized: result.personalized,
      notes:
        result.recommendations.length || result.personalized
          ? []
          : ["no_orders_yet_try_popular_picks"],
    };
  },
};

export const AI_RECOMMEND_TOOLS = [RECOMMEND_PRODUCTS_TOOL];

export default RECOMMEND_PRODUCTS_TOOL;