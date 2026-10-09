import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import api from "../utils/api";

export default function CheckoutPage() {
  const { cart, totalAmount, clearCart, updateQuantity } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United Kingdom",
    paymentMethod: "card",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  if (!cart || cart.length === 0) {
    return <p className="p-6 text-center text-gray-600">Your cart is empty.</p>;
  }

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const shippingAddress = {
    street: form.street,
    city: form.city,
    state: form.state || form.city,
    postalCode: form.postalCode,
    country: form.country,
  };

  const buildItems = (items) =>
    items.map((item) => ({
      id: item.id || item._id,
      productId: item.id || item._id,
      name: item.name,
      quantity: item.quantity,
    }));

  const removeMissingFromCart = (missingItems) => {
    const staleIds = new Set(missingItems.map((m) => m.id || m.productId));
    staleIds.forEach((id) => updateQuantity(id, 0));
    return staleIds;
  };

  const missingItemsMessage = (missingItems) =>
    `Some items in your cart are no longer available and were removed: ${missingItems
      .map((m) => m.name || m.id)
      .join(", ")}. Please review your cart and try again.`;

  const submitCardPayment = async (currentItems, currentForm) => {
    setError("");
    setSubmitting(true);
    try {
      // 1) Create a Stripe payment intent which also creates the order (pending)
      const { data } = await api.post("/payments/stripe/create-payment-intent", {
        cart: buildItems(currentItems),
        customer: { _id: user?._id, email: currentForm.email, name: currentForm.fullName },
        shippingAddress,
      });
      // 2) Send the order to the payment page to complete the card payment
      navigate("/payment", {
        state: {
          clientSecret: data.clientSecret,
          orderId: data.orderId,
          amount: data.amount,
          demoMode: data.demoMode,
        },
      });
    } catch (err) {
      const d = err.response?.data;
      console.error("Checkout payment intent failed:", d || err.response?.status || err.message);
      if (d?.code === "MISSING_PRODUCTS" && Array.isArray(d.missingItems)) {
        // Remove the stale items from the cart and let the user retry once the
        // server tells us exactly what is gone - no confusing silent retries.
        removeMissingFromCart(d.missingItems);
        setError(missingItemsMessage(d.missingItems));
      } else {
        setError(
          d?.message || "Failed to place order. Please make sure you are logged in."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const placeOrderDirect = async (currentItems) => {
    setError("");
    setSubmitting(true);
    try {
      await api.post("/orders", {
        items: buildItems(currentItems),
        shippingAddress,
        paymentMethod: form.paymentMethod,
        customerEmail: form.email,
      });
      return true;
    } catch (err) {
      const d = err.response?.data;
      console.error("Checkout order failed:", d || err.response?.status || err.message);
      if (d?.code === "MISSING_PRODUCTS" && Array.isArray(d.missingItems)) {
        removeMissingFromCart(d.missingItems);
        setError(missingItemsMessage(d.missingItems));
      } else {
        setError(
          d?.message || "Failed to place order. Please make sure you are logged in."
        );
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.paymentMethod === "card") {
      await submitCardPayment(cart, form);
      return;
    }

    // Cash on Delivery (or fallback) - place order immediately
    const placed = await placeOrderDirect(cart);
    if (placed) {
      setSuccess("Order placed successfully!");
      clearCart();
      setTimeout(() => navigate(`/orders`), 1200);
    }
  };

  const cardColors =
    form.paymentMethod === "card"
      ? "bg-primary-600 hover:bg-primary-700"
      : "bg-primary-600 hover:bg-primary-700";

  return (
    <div className="max-w-5xl mx-auto p-6">
      <nav
        className="mb-6 flex items-center gap-2 text-sm text-gray-500"
        aria-label="Breadcrumb"
      >
        <Link to="/" className="transition-colors hover:text-primary-700">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-gray-700">Checkout</span>
      </nav>
      <h1 className="text-3xl font-bold mb-6 text-gradient-green">Checkout</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-success-soft border border-success/35 text-success px-4 py-2 rounded mb-4 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Order Summary */}
        <div className="md:col-span-1 bg-gray-50 border border-gray-100 p-4 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Order Summary</h2>
          <ul className="space-y-2">
            {cart.map((item, idx) => (
              <li key={idx} className="flex justify-between text-sm">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>£{Number(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <div className="border-t border-gray-300 mt-4 pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Items:</span>
              <span>{totalItems}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-primary-600">
              <span>Total Amount:</span>
              <span>£{Number(totalAmount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Checkout Form */}
        <div className="md:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="space-y-5 bg-white p-6 rounded-lg shadow-sm border border-gray-100"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                  className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">
                Street Address
              </label>
              <input
                type="text"
                name="street"
                value={form.street}
                onChange={handleChange}
                required
                className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-medium">City</label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                  className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium">State</label>
                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium">Postcode</label>
                <input
                  type="text"
                  name="postalCode"
                  value={form.postalCode}
                  onChange={handleChange}
                  required
                  className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium">Country</label>
                <input
                  type="text"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  required
                  className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleChange}
                className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="card">Credit / Debit Card</option>
                <option value="cash_on_delivery">Cash on Delivery</option>
              </select>
              {form.paymentMethod === "card" && (
                <p className="text-xs text-gray-500 mt-1">
                  Card payments are handled securely on the next page.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full ${cardColors} text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50`}
            >
              {submitting
                ? form.paymentMethod === "card"
                  ? "Preparing Payment..."
                  : "Placing Order..."
                : form.paymentMethod === "card"
                ? "Continue to Payment"
                : "Place Order"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
