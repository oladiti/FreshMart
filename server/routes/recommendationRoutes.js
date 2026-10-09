// GET /api/recommendations
//
// Personalised product suggestions for the Home widget (and, via a `seed`
// param, the "You may also like" row on product pages). The same engine backs
// the AI assistant's recommendProducts tool.
//
// Auth is optional: signed-in visitors get picks based on their own order
// history; guests get the store's current popular items.

import { Router } from "express";
import optionalAuth from "../middleware/optionalAuth.js";
import { computeRecommendations } from "../services/recommendations/computeRecommendations.js";

const router = Router();

const splitIdList = (value) =>
  typeof value === "string" && value.length
    ? value.split(",").map((id) => id.trim()).filter(Boolean)
    : [];

router.get("/", optionalAuth, async (req, res) => {
  try {
    const result = await computeRecommendations({
      user: req.user || null,
      limit: req.query.limit,
      seedProductId: req.query.seed,
      excludedIds: splitIdList(req.query.exclude),
    });
    // Let the browser reuse the widget's payload for a short window instead of
    // re-requesting it on every navigation. `private` keeps per-user picks out
    // of shared caches.
    res.set(
      "Cache-Control",
      "private, max-age=60, stale-while-revalidate=300"
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Recommendations failed:", error);
    res
      .status(500)
      .json({ success: false, message: "Could not load recommendations." });
  }
});

export default router;