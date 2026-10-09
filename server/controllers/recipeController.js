import mongoose from "mongoose";
import Recipe from "../models/Recipe.js";

// 📌 Get all recipes
export const getRecipes = async (req, res, next) => {
  try {
    const { category, diet } = req.query;
    let filter = {};

    if (category) filter.category = category;
    if (diet) filter.diet = diet;

    const recipes = await Recipe.find(filter).sort({ createdAt: -1 });
    res.json(recipes);
  } catch (error) {
    next(error);
  }
};

// 📌 Get single recipe by slug (id-based URLs are permanently redirected to
// the canonical slug so recipes never expose raw _id links)
export const getRecipeBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const recipe = await Recipe.findOne({
      $or: [
        { slug },
        ...(mongoose.isValidObjectId(slug) ? [{ _id: slug }] : []),
      ],
    });

    if (!recipe) {
      res.status(404);
      throw new Error("Recipe not found");
    }

    if (mongoose.isValidObjectId(slug) && recipe.slug) {
      return res.redirect(301, `/api/recipes/${recipe.slug}`);
    }

    res.json(recipe);
  } catch (error) {
    next(error);
  }
};

// 📌 Create a new recipe (only logged-in users)
export const createRecipe = async (req, res, next) => {
  try {
    const { title, description, ingredients, steps, category, diet, image } = req.body;

    const recipe = new Recipe({
      title,
      description,
      ingredients,
      steps,
      category,
      diet,
      image,
      createdBy: req.user._id,
    });

    const createdRecipe = await recipe.save();
    res.status(201).json(createdRecipe);
  } catch (error) {
    next(error);
  }
};

// 📌 Update an existing recipe (admin only)
export const updateRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      res.status(404);
      throw new Error("Recipe not found");
    }

    const { title, description, ingredients, steps, category, diet, image } = req.body;

    if (title !== undefined) recipe.title = title;
    if (description !== undefined) recipe.description = description;
    if (ingredients !== undefined) recipe.ingredients = ingredients;
    if (steps !== undefined) recipe.steps = steps;
    if (category !== undefined) recipe.category = category;
    if (diet !== undefined) recipe.diet = diet;
    if (image !== undefined) recipe.image = image;

    const updatedRecipe = await recipe.save();
    res.json(updatedRecipe);
  } catch (error) {
    next(error);
  }
};

// 📌 Delete a recipe (admin only)
export const deleteRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.findByIdAndDelete(req.params.id);

    if (!recipe) {
      res.status(404);
      throw new Error("Recipe not found");
    }

    res.json({ message: "Recipe removed" });
  } catch (error) {
    next(error);
  }
};
