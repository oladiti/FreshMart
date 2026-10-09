import React, { useContext, useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";
import {
  Search,
  X,
  ShoppingCart,
  User,
  Menu,
  ShoppingBag,
  BadgePercent,
  UtensilsCrossed,
  Phone,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import Brand from "./Brand";

import api from "../utils/api";

const NAV_LINKS = [
  { label: "Shop", to: "/shop" },
  { label: "Weekly Deals", to: "/weekly-deals", accent: true },
  { label: "Recipes", to: "/recipes" },
  { label: "Contact", to: "/contact" },
];

const MOBILE_LINKS = [
  { label: "Shop", to: "/shop", icon: ShoppingBag },
  { label: "Weekly Deals", to: "/weekly-deals", icon: BadgePercent },
  { label: "Recipes", to: "/recipes", icon: UtensilsCrossed },
  { label: "Contact", to: "/contact", icon: Phone },
];

const isRouteActive = (to, pathname) =>
  to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const { cart } = useContext(CartContext);
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const cartRef = useRef(null);

  const cartTotalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (cartRef.current && !cartRef.current.contains(e.target)) {
        setCartOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setCartOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/60 bg-white/80 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-20px_rgba(5,79,49,0.25)] backdrop-blur-xl">
      <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <Brand tone="dark" className="shrink-0" />

        <SearchBar className="mx-2 hidden min-w-0 flex-1 md:block lg:max-w-sm" />

        <nav className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => {
              const active = isRouteActive(link.to, pathname);

              if (link.accent) {
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`whitespace-nowrap rounded-full bg-gradient-to-r from-lime-400 to-lime-300 px-4 py-1.5 text-sm font-semibold text-leaf-deep shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      active ? "ring-2 ring-leaf/30" : ""
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              }

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={active ? "page" : undefined}
                  className={`relative whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-colors after:absolute after:-bottom-0.5 after:left-3 after:right-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-primary-600 after:transition-transform after:duration-200 hover:text-primary-700 hover:after:scale-x-100 ${
                    active
                      ? "text-primary-700 after:scale-x-100"
                      : "text-gray-700"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden items-center gap-2 md:flex md:gap-3">

            <div ref={cartRef} className="relative">
              <button
                type="button"
                onClick={() => setCartOpen((open) => !open)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-primary-50 hover:text-primary-700"
                aria-label="Open cart"
                aria-haspopup="true"
                aria-expanded={cartOpen}
              >
                <ShoppingCart className="h-5 w-5" />
                {cartTotalQuantity > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-white">
                    {cartTotalQuantity}
                  </span>
                )}
              </button>

              {cartOpen && <MiniCart onClose={() => setCartOpen(false)} />}
            </div>

            {user ? (
              <>
                <Link
                  to="/profile"
                  className="flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-primary-50 hover:text-primary-700"
                >
                  <User className="h-5 w-5" />
                  <span className="max-w-[8rem] truncate">
                    {user.name || "Profile"}
                  </span>
                </Link>
                {user.role === "admin" && (
                  <Link
                    to="/admin"
                    className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-primary-50 hover:text-primary-700"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="flex h-10 items-center gap-1.5 rounded-full bg-red-500/10 px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-primary-50 hover:text-primary-700"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition-all hover:-translate-y-0.5 hover:from-primary-700 hover:to-primary-800 hover:shadow-lg hover:shadow-primary-600/30"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </nav>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-primary-50 hover:text-primary-700 lg:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label="Toggle menu"
          aria-controls="mobile-menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          id="mobile-menu"
          className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-gray-100 bg-white/95 backdrop-blur-xl lg:hidden animate-fadeIn"
        >
          <div className="border-b border-gray-100 p-3">
            <SearchBar onNavigate={closeMobile} />
          </div>

          <div className="flex flex-col py-2 text-base font-medium">

            {MOBILE_LINKS.map((link) => {
              const Icon = link.icon;
              const active = isRouteActive(link.to, pathname);

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeMobile}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                    active
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-700 hover:bg-primary-50"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${active ? "text-primary-600" : "text-gray-400"}`}
                  />
                  {link.label}
                </Link>
              );
            })}

            <Link to="/cart" className={mobileLinkClass} onClick={closeMobile}>
              <ShoppingCart className="h-5 w-5 text-primary-600" />
              Cart ({cartTotalQuantity})
            </Link>

            {user ? (
              <>
                <Link
                  to="/profile"
                  className={mobileLinkClass}
                  onClick={closeMobile}
                >
                  <User className="h-5 w-5 text-primary-600" />
                  Profile
                </Link>
                {user.role === "admin" && (
                  <Link to="/admin" className={mobileLinkClass} onClick={closeMobile}>
                    <LayoutDashboard className="h-5 w-5 text-primary-600" />
                    Admin Dashboard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    closeMobile();
                  }}
                  className="flex items-center gap-3 bg-red-500 px-5 py-3 text-left font-semibold text-white transition-colors hover:bg-red-600"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={mobileLinkClass} onClick={closeMobile}>
                  <User className="h-5 w-5 text-primary-600" />
                  Login
                </Link>
                <Link to="/register" className={mobileLinkClass} onClick={closeMobile}>
                  <ShoppingBag className="h-5 w-5 text-primary-600" />
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>


    </>
  );
}

const mobileLinkClass =
  "flex items-center gap-3 px-5 py-3 text-gray-700 transition-colors hover:bg-primary-50";

function SearchBar({ className = "", onNavigate }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get(
          `/products?search=${encodeURIComponent(search)}`
        );
        const list = Array.isArray(data) ? data : data?.products || [];
        setResults(
          list.filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase())
          )
        );
        setShowResults(true);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const reset = () => {
    setShowResults(false);
    setSearch("");
    onNavigate?.();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    navigate(`/shop?search=${encodeURIComponent(search.trim())}`);
    reset();
  };

  const handleSelect = (product) => {
    if (product.slug) {
      navigate(`/products/${product.slug}`);
    }
    reset();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form
        onSubmit={handleSubmit}
        className="flex items-center overflow-hidden rounded-full border border-gray-100 bg-white shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-primary-300 focus-within:shadow-md"
      >
        <Search className="ml-3 h-5 w-5 shrink-0 text-gray-400" />
        <input
          type="text"
          placeholder="Search for fresh groceries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
          className="flex-1 bg-transparent px-3 py-2 text-gray-700 outline-none placeholder:text-gray-400"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {showResults && (
        <div className="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl animate-fadeIn">
          <SearchResults
            isLoading={isLoading}
            results={results}
            onSelect={handleSelect}
          />
        </div>
      )}
    </div>
  );
}

function SearchResults({ isLoading, results, onSelect }) {
  if (isLoading) {
    return <div className="p-3 text-center text-gray-500">Loading...</div>;
  }

  if (results.length === 0) {
    return <div className="p-3 text-center text-gray-500">No products found</div>;
  }

  return results.map((product) => (
    <button
      key={product._id}
      type="button"
      onClick={() => onSelect(product)}
      className="flex w-full items-center gap-3 p-2 text-left hover:bg-primary-50"
    >
      <img
        src={product.image}
        alt={product.name}
        onError={(e) => (e.target.src = "/images/placeholder.jpg")}
        className="h-10 w-10 rounded object-cover"
      />
      <span className="font-medium text-gray-700">{product.name}</span>
    </button>
  ));
}

function MiniCart({ onClose }) {
  const { cart, removeFromCart } = useContext(CartContext);

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div className="absolute right-0 z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white p-4 shadow-xl animate-fadeIn">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <ShoppingCart className="h-4 w-4 text-primary-600" />
          Your Cart ({totalQuantity})
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cart"
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {cart.length === 0 ? (
        <p className="py-4 text-center text-gray-500">Your cart is empty</p>
      ) : (
        <>
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {cart.map((item) => (
              <div
                key={item.id || item._id}
                className="flex items-center justify-between border-b pb-2"
              >
                <div className="flex items-center gap-2">
                  <img
                    src={item.image}
                    alt={item.name}
                    onError={(e) => (e.target.src = "/images/placeholder.jpg")}
                    className="h-12 w-12 rounded object-cover"
                  />
                  <div>
                    <p className="font-medium text-gray-700">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      £{item.price.toLocaleString()} × {item.quantity}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.id || item._id)}
                  className="text-sm text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t pt-3">
            <div className="flex justify-between font-semibold text-gray-800">
              <span>Total:</span>
              <span>£{totalAmount.toLocaleString()}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                to="/cart"
                onClick={onClose}
                className="flex-1 rounded-full bg-gray-100 py-2 text-center font-semibold text-gray-700 transition-colors hover:bg-gray-200"
              >
                View Cart
              </Link>
              <Link
                to="/checkout"
                onClick={onClose}
                className="flex-1 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 py-2 text-center font-semibold text-white transition-colors hover:from-primary-700 hover:to-primary-800"
              >
                Checkout
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}