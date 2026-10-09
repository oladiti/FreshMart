import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import RecipeCard from "../components/RecipeCard";
import api from "../utils/api";

const RecipesPage = () => {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const { data } = await api.get("/recipes");
        setRecipes(Array.isArray(data) ? data : []);
      } catch {
        setError("Failed to load recipes.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecipes();
  }, []);

  return (
    <div className="container mx-auto px-4 py-4">
      {/* Back to home */}
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm ring-1 ring-gray-100 transition-all hover:-translate-y-0.5 hover:bg-primary-50 hover:shadow-md"
      >
        <span aria-hidden="true">←</span>
        Back to Home
      </Link>

      {/* Header */}
<h2 className="text-xl md:text-4xl font-bold text-gradient-green mb-2 text-center">
          Delicious Recipes
      </h2>
      <div className="w-16 h-1.5 mx-auto rounded-full bg-primary-600 mb-6"></div>
      <p className="text-gray-600 text-sm text-center mb-6">
        Cook something amazing with groceries from our store!
      </p>

      {loading && <p className="text-center py-6 text-gray-600">Loading recipes...</p>}
      {error && (
        <p className="text-center py-6 text-red-600">{error}</p>
      )}

      {/* Grid of recipes */}
      {!loading && !error && recipes.length === 0 ? (
        <p className="text-center py-6 text-gray-500">
          No recipes available yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {recipes.map((recipe) => (
            <Link key={recipe._id} to={`/recipes/${recipe.slug || recipe._id}`}>
              <RecipeCard recipe={recipe} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecipesPage;
