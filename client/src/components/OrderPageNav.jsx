import { Link } from "react-router-dom";

export default function OrderPageNav({ className = "mb-6" }) {
  return (
    <nav
      aria-label="Order navigation"
      className={`flex flex-wrap items-center gap-2 text-sm text-gray-500 ${className}`}
    >
      <Link to="/" className="transition-colors hover:text-primary-700">
        Home
      </Link>
      <span aria-hidden="true">/</span>
      <Link to="/profile" className="transition-colors hover:text-primary-700">
        Profile
      </Link>
    </nav>
  );
}
