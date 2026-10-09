import express from "express";
import { getRecipes, getRecipeBySlug, createRecipe } from "../controllers/recipeController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.get("/", getRecipes);
router.get("/:slug", getRecipeBySlug);

// Protected (only logged-in users can add recipes)
router.post("/", protect, createRecipe);

export default router;
