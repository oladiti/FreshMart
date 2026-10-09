import { Link } from "react-router-dom";
import { Leaf, Home, ShoppingBag } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-xl">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-white shadow-lg shadow-primary-900/20">
          <Leaf className="w-8 h-8" />
        </div>
        <p className="text-6xl font-black text-primary-600">404</p>
        <h1 className="mt-3 text-2xl md:text-3xl font-bold text-gray-900">
          Oops! Page not found
        </h1>
        <p className="mt-3 text-gray-500">
          The page you're looking for doesn't exist, may have been moved, or is
          unavailable right now.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
          <Link
            to="/shop"
            className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            Browse Products
          </Link>
        </div>
      </div>
    </div>
  );
}