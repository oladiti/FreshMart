import { Link } from "react-router-dom";
import { Leaf } from "lucide-react";

export default function Brand({ className = "", tone = "light" }) {
  const text = tone === "dark" ? "text-gray-900" : "text-white";
  const accent = tone === "dark" ? "text-primary-600" : "text-primary-300";

  return (
    <Link
      to="/"
      aria-label="FreshMart home"
      className={`group flex items-center gap-2 ${className}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md transition-transform group-hover:scale-105">
        <Leaf className="h-5 w-5" />
      </span>
      <span className={`font-heading text-2xl font-bold tracking-tight ${text}`}>
        Fresh<span className={accent}>Mart</span>
      </span>
    </Link>
  );
}