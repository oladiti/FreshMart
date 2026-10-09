import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../utils/api";
import { Lock } from "lucide-react";
import BackToHome from "../components/BackToHome";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.put(`/auth/reset-password/${token}`, {
        password,
      });
      setMessage(data.message || "Password reset successfully!");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Reset failed. Please try again.");
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
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-500 text-white shadow-md">
              <Lock size={20} />
            </span>
            <h2 className="text-2xl font-bold text-gradient-green">
              Set a New Password
            </h2>
          </div>

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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-800 shadow-sm transition placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-800 shadow-sm transition placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:from-primary-700 hover:to-primary-800 disabled:opacity-50"
        >
          {submitting ? "Resetting..." : "Reset Password"}
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
