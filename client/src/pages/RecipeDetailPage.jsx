import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import BackToHome from "../components/BackToHome";
import api from "../utils/api";

const RecipeDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const { data } = await api.get(`/recipes/${slug}`);

        // Canonicalize the URL: id-based links (e.g. /recipes/<_id>) point
        // at the slug so the address bar always shows the clean slug.
        if (data && data.slug && data.slug !== slug) {
          navigate(`/recipes/${data.slug}`, { replace: true });
        }
        setRecipe(data);
      } catch {
        setError("Recipe not found");
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [slug, navigate]);

  if (loading)
    return <p className="p-6 text-center text-gray-600">Loading recipe...</p>;

  if (error || !recipe) {
    return (
      <div className="p-6 text-center text-gray-600">
        <h2 className="text-xl font-bold mb-2">{error || "Recipe not found"}</h2>
        <Link
          to="/recipes"
          className="inline-block px-4 py-2 bg-primary-600 text-white rounded-full shadow-md shadow-primary-600/20"
        >
          ← Back to Recipes
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4">
      <BackToHome className="mb-4" />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
        {/* Recipe Image */}
        <img
          src={recipe.image || "/images/placeholder.jpg"}
          alt={recipe.title}
          onError={(e) =>
            (e.target.src = "/images/placeholder.jpg")
          }
          className="w-full h-72 object-cover rounded-2xl shadow md:h-[26rem]"
        />

        <div>
          {/* Recipe Header */}
          <h2 className="text-3xl font-bold text-gray-900">{recipe.title}</h2>
          <p className="text-gray-600 mt-2">{recipe.description}</p>

          {recipe.diet && recipe.diet !== "none" && (
            <span className="text-purple-600 text-sm block mt-2 capitalize bg-purple-50 px-3 py-1 rounded-full inline-block">
              {recipe.diet}
            </span>
          )}

          {/* Ingredients */}
          <h3 className="text-xl font-semibold mt-8 mb-3"> Ingredients</h3>
          {recipe.ingredients && recipe.ingredients.length > 0 ? (
            <ul className="space-y-2 list-disc pl-5">
              {recipe.ingredients.map((item, idx) => (
                <li key={idx} className="text-gray-700">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No ingredients listed.</p>
          )}

          {/* Steps */}
          <h3 className="text-xl font-semibold mt-8 mb-3">Instructions</h3>
          {recipe.steps && recipe.steps.length > 0 ? (
            <ol className="list-decimal pl-6 text-gray-700 space-y-2">
              {recipe.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-500">No instructions provided.</p>
          )}

          {/* CTA */}
          <Link
            to="/shop"
            className="inline-block mt-8 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-full shadow-md shadow-primary-600/20 transition"
          >
             Shop All Ingredients
          </Link>

          {/* Back Link */}
          <Link
            to="/recipes"
            className="block mt-6 text-primary-600 text-sm hover:underline"
          >
            ← Back to Recipes
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetailPage;
