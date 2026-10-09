import React from "react";
import { Clock, Flame, Leaf, Utensils } from "lucide-react";

const dietMeta = {
  "gluten-free": { label: "Gluten-Free", icon: Flame, classes: "text-amber-700 bg-amber-50" },
  vegan: { label: "Vegan", icon: Leaf, classes: "text-primary-700 bg-primary-50" },
  vegetarian: { label: "Vegetarian", icon: Leaf, classes: "text-primary-700 bg-primary-50" },
};

const RecipeCard = ({ recipe }) => {
  const { _id, title, image, description, ingredients = [], diet, prepTime } =
    recipe || {};

  const DietMeta = diet && diet !== "none" ? dietMeta[String(diet).toLowerCase()] : null;

  return (
    <div className="product-card group h-full">
      <div className="relative overflow-hidden">
        <img
          src={image || "/images/placeholder.jpg"}
          alt={title}
          onError={(e) => (e.target.src = "/images/placeholder.jpg")}
          className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
        {DietMeta && (
          <span
            className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm ${DietMeta.classes}`}
          >
            <DietMeta.icon className="h-3.5 w-3.5" />
            {DietMeta.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-gray-900 transition-colors group-hover:text-primary-700">
          {title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-500">
          {description}
        </p>

        <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <Utensils className="h-3.5 w-3.5" />
            {ingredients.length} ingredients
          </span>
          {prepTime && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {prepTime}
            </span>
          )}
        </div>

        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 transition-all group-hover:gap-2">
          View Recipe <span aria-hidden>→</span>
        </span>
      </div>
    </div>
  );
};

export default RecipeCard;