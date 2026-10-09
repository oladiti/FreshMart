import express from "express";
import { aiChat } from "../controllers/aiController.js";
import { optionalAuth } from "../middleware/optionalAuth.js";

const router = express.Router();

// Public endpoint: product/recipe/policy questions work anonymously, while
// cart/order tools require the (optional) authenticated user.
router.post("/chat", optionalAuth, aiChat);

export default router;