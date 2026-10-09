import React, { useEffect, useState, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import api from "../utils/api";
import { CartContext } from "../context/CartContext";
import BackToHome from "../components/BackToHome";

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = STRIPE_KEY && !STRIPE_KEY.includes("xxx") ? loadStripe(STRIPE_KEY) : null;

function CardPaymentForm({ clientSecret, orderId }) {
  const stripe = useStripe();
  const elements = useElements();
  const { clearCart } = useContext(CartContext);
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError("");

    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });

      if (result.error) {
        setError(result.error.message);
        setProcessing(false);
        return;
      }

      if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
        await api.post("/payments/stripe/confirm-order", {
          orderId,
          transactionId: result.paymentIntent.id,
        });
        clearCart();
        navigate("/orders", { state: { paid: true } });
      } else {
        setError("Payment was not completed.");
        setProcessing(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Payment failed. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <div className="border rounded-lg p-4 bg-gray-50">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#424770",
                "::placeholder": { color: "#aab7c4" },
              },
              invalid: { color: "#9e2146" },
            },
          }}
        />
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50"
      >
        {processing ? "Processing Payment..." : "Pay Now"}
      </button>
    </form>
  );
}

export default function PaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useContext(CartContext);

  // Fall back to sessionStorage in case the page is refreshed
  const [session] = useState(() => {
    const saved = sessionStorage.getItem("pendingPayment");
    return saved ? JSON.parse(saved) : null;
  });

  const state = location.state || session || {};
  const clientSecret = state.clientSecret || "";
  const orderId = state.orderId || "";
  const amount = state.amount || 0;
  const demoMode = Boolean(state.demoMode);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (clientSecret || orderId) {
      sessionStorage.setItem("pendingPayment", JSON.stringify(state));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmDemoPayment = async () => {
    setProcessing(true);
    setError("");
    try {
      await api.post("/payments/stripe/confirm-order", { orderId });
      sessionStorage.removeItem("pendingPayment");
      setConfirmed(true);
      clearCart();
    } catch (err) {
      setError(err.response?.data?.message || "Payment failed. Please try again.");
      setProcessing(false);
    }
  };

  if (!orderId && !clientSecret) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <BackToHome className="mb-4" />
        <p className="text-gray-600">No pending payment found.</p>
        <button
          onClick={() => navigate("/cart")}
          className="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg"
        >
          Back to Cart
        </button>
      </div>
    );
  }

  if (confirmed) {
    setTimeout(() => navigate("/orders", { state: { paid: true } }), 1000);
    return (
      <div className="max-w-lg mx-auto p-10 text-center bg-white rounded-lg shadow mt-10">
        <div className="text-success text-6xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-gradient-green">Payment Successful!</h2>
        <p className="text-gray-600 mt-2">Redirecting to your orders...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6 mt-6">
      <BackToHome className="mb-4" />
      <h1 className="text-3xl font-bold mb-2 text-gradient-green">Complete Payment</h1>
      <p className="text-gray-500 text-sm mb-6">
        Order total: <span className="font-semibold text-gray-800">£{Number(amount).toFixed(2)}</span>
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {demoMode || !stripePromise ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm mb-4">
            <strong>Testing mode:</strong> Stripe keys are not configured, so no
            real card is charged. Click below to simulate a successful payment.
          </div>
          <button
            onClick={confirmDemoPayment}
            disabled={processing}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            {processing ? "Confirming..." : "Confirm Payment (Demo)"}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <Elements stripe={stripePromise}>
            <CardPaymentForm clientSecret={clientSecret} orderId={orderId} />
          </Elements>
        </div>
      )}
    </div>
  );
}
