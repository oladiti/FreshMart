import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api";
import { KeyRound } from "lucide-react";
import BackToHome from "../components/BackToHome";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setDevLink("");
    setSubmitting(true);

    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(
        data.message ||
          "If an account exists for that email, a reset link has been sent."
      );
      // Dev fallback: show the reset link when emails are not configured
      if (data.devResetLink) {
        setDevLink(data.devResetLink);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 bg-cream">
      <BackToHome className="mb-6" />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-primary-700 to-amber-400"></div>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-500 text-white shadow-md">
              <KeyRound size={20} />
            </span>
            <h2 className="text-2xl font-bold text-gradient-green">Forgot Password</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Enter the email associated with your account and we'll send you a link
            to reset your password.
          </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-success-soft border border-success/35 text-success px-4 py-2 rounded mb-4 text-sm">
          {message}
        </div>
      )}
      {devLink && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded mb-4 text-sm break-all">
          <strong>Email not configured:</strong> use this temporary reset link
          below to reset your password.
          <div className="mt-2">
            <a href={devLink} className="text-primary-700 underline font-medium">
              {devLink}
            </a>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-800 shadow-sm transition placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:from-primary-700 hover:to-primary-800 disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <p className="text-sm text-center text-gray-600 mt-4">
        <Link to="/login" className="text-primary-700 hover:underline font-medium">
          Back to Login
        </Link>
      </p>
        </div>
      </div>
    </div>
  );
}
