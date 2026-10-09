import React, { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import BackToTop from "./components/BackToTop";

// Routes are split into their own chunks so the first paint only downloads the
// code for the page the visitor actually opened (instead of one large bundle).
const AIAssistant = lazy(() => import("./components/ai/AIAssistant"));
const Footer = lazy(() => import("./components/Footer"));
const AdminLayout = lazy(() => import("./components/AdminLayout"));

const HomePage = lazy(() => import("./pages/HomePage"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const ProductDetailsPage = lazy(() => import("./pages/ProductDetailsPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const WeeklyDealsPage = lazy(() => import("./pages/WeeklyDealsPage"));
const RecipesPage = lazy(() => import("./pages/RecipesPage"));
const RecipeDetailPage = lazy(() => import("./pages/RecipeDetailPage"));
const NewArrivalsPage = lazy(() => import("./pages/NewArrivalsPage"));
const PantryPage = lazy(() => import("./pages/PantryPage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const ReturnsRefundsPage = lazy(() => import("./pages/ReturnsRefundsPage"));
const DeliveryInfoPage = lazy(() => import("./pages/DeliveryInfoPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));
const AdminRecipesPage = lazy(() => import("./pages/admin/AdminRecipesPage"));
const AdminCustomersPage = lazy(() => import("./pages/admin/AdminCustomersPage"));
const AdminSubscribersPage = lazy(() => import("./pages/admin/AdminSubscribersPage"));
const AdminBestSellersPage = lazy(() => import("./pages/admin/AdminBestSellersPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-label="Loading page"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
    </div>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith("/admin");

  return (
    <div className="flex flex-col min-h-screen">
      {!isAdminRoute && <Navbar />}
      <div className={`flex-1 ${isAdminRoute ? "" : "pt-20"}`}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/pantry" element={<PantryPage />} />
              <Route path="/recipes" element={<RecipesPage />} />
              <Route path="/recipes/:slug" element={<RecipeDetailPage />} />
              <Route path="/weekly-deals" element={<WeeklyDealsPage />} />
              <Route path="/new-arrivals" element={<NewArrivalsPage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/products/:slug" element={<ProductDetailsPage />} />
              <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
              <Route path="/payment" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/returns-refunds" element={<ReturnsRefundsPage />} />
              <Route path="/delivery-info" element={<DeliveryInfoPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<AdminDashboardPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="recipes" element={<AdminRecipesPage />} />
                <Route path="best-sellers" element={<AdminBestSellersPage />} />
                <Route path="customers" element={<AdminCustomersPage />} />
            <Route path="subscribers" element={<AdminSubscribersPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
              <Route path="/:slug" element={<CategoryPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
        {!isAdminRoute && (
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        )}
        {!isAdminRoute && (
          <Suspense fallback={null}>
            <AIAssistant />
          </Suspense>
        )}
        {!isAdminRoute && <BackToTop />}
      </div>
  );
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <AppShell />
    </Router>
  );
}
