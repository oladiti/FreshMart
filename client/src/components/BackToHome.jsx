import { Link } from "react-router-dom";

export default function BackToHome({ className = "" }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm ring-1 ring-gray-100 transition-all hover:-translate-y-0.5 hover:bg-primary-50 hover:shadow-md ${className}`}
    >
      <span aria-hidden="true">←</span>
      Back to Home
    </Link>
  );
}