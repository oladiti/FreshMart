import { useEffect, useState, useContext } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  UtensilsCrossed,
  Users,
  Mail,
  TrendingUp,
  BarChart3,
  Settings,
  Leaf,
  ArrowLeft,
  Menu,
  X,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";

const navItems = [
  { label: "Dashboard", to: "/admin", end: true, icon: LayoutDashboard },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Recipes", to: "/admin/recipes", icon: UtensilsCrossed },
  { label: "Best Sellers", to: "/admin/best-sellers", icon: TrendingUp },
  { label: "Customers", to: "/admin/customers", icon: Users },
  { label: "Subscribers", to: "/admin/subscribers", icon: Mail },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const { logout } = useContext(AuthContext);

  const currentLabel =
    navItems.find((item) =>
      item.end ? pathname === item.to : pathname.startsWith(item.to)
    )?.label || "Admin";

  // Close the mobile drawer whenever the admin navigates to a new page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  const handleLogout = () => {
    closeDrawer();
    logout();
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex">
        {/* Desktop sidebar - fixed so it never scrolls with the page */}
        <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-gray-950 text-white overflow-y-auto">
          <BrandHeader />
          <nav className="flex-1 space-y-1 p-4">
            <NavItems />
          </nav>
          <div className="p-4 border-t border-white/10">
            <BackToStore />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col md:pl-60">
          {/* Slim admin top bar */}
          <header className="sticky top-0 z-30 flex items-center gap-3 bg-white border-b border-gray-200 px-4 md:px-6 lg:px-8 py-3">
            <button
              onClick={() => setDrawerOpen((open) => !open)}
              aria-label={drawerOpen ? "Close admin menu" : "Open admin menu"}
              aria-expanded={drawerOpen}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100 md:hidden"
            >
              {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <p className="font-semibold text-gray-800 text-lg truncate">
              {currentLabel}
            </p>

            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/"
                className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                <ExternalLink className="w-4 h-4" />
                View Store
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500 hover:text-white"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>

          <main className="p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>

        {/* Mobile drawer - sidebar shown/hidden via the top bar toggle */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={closeDrawer}
              aria-hidden="true"
            />
            <aside className="absolute left-0 top-0 bottom-0 flex w-60 flex-col bg-gray-950 text-white overflow-y-auto">
              <div className="flex justify-end p-2">
                <button
                  onClick={closeDrawer}
                  aria-label="Close admin menu"
                  className="p-2 rounded-lg text-gray-300 hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <BrandHeader />
              <nav className="flex-1 space-y-1 overflow-y-auto p-4">
                <NavItems onNavigate={closeDrawer} />
              </nav>
              <div className="p-4 border-t border-white/10">
                <BackToStore onClick={closeDrawer} />
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="p-5 border-b border-white/10">
      <Link
        to="/"
        className="flex items-center gap-2 group w-fit"
        title="Back to store"
        aria-label="FreshMart admin"
      >
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-500 text-white shadow-md group-hover:scale-105 transition-transform shrink-0">
          <Leaf className="w-5 h-5" />
        </span>
        <div>
          <p className="text-lg font-bold leading-tight">
            Fresh<span className="text-primary-300">Mart</span>
          </p>
          <p className="text-xs text-gray-400">Admin Panel</p>
        </div>
      </Link>
    </div>
  );
}

function NavItems({ onNavigate }) {
  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-500/20 text-primary-300 ring-1 ring-primary-400/30"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </NavLink>
        );
      })}
    </>
  );
}

function BackToStore({ onClick }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-300 transition-colors hover:text-white`}
    >
      <ArrowLeft className="w-4 h-4 shrink-0" />
      Back to Store
    </Link>
  );
}