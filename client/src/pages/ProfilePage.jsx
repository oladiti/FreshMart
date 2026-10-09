import React, { useState, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import BackToHome from "../components/BackToHome";

export default function ProfilePage() {
  const { user, updateProfile } = useContext(AuthContext);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <p className="text-gray-600 mb-4">You must be logged in to view your profile.</p>
        <Link
          to="/login"
          className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg shadow-md shadow-primary-600/20"
        >
          Login
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);

    const updates = { name, email };
    if (password) updates.password = password;

    const result = await updateProfile(updates);
    setSubmitting(false);

    if (result.success) {
      setMessage("Profile updated successfully.");
      setPassword("");
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <BackToHome className="mb-6" />
      <h2 className="text-3xl font-bold mb-6 text-gradient-green">My Profile</h2>

      {message && (
        <div className="bg-success-soft border border-success/35 text-success px-4 py-2 rounded mb-4 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
            {(user.name || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-gray-500 text-sm">{user.email}</p>
            <p className="text-gray-400 text-xs capitalize mt-1">Role: {user.role}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password (optional)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg shadow-md shadow-primary-600/20 transition-all disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      <div className="mt-6 flex gap-4">
        <Link
          to="/orders"
          className="flex-1 text-center bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200"
        >
          My Orders
        </Link>
        <Link
          to="/cart"
          className="flex-1 text-center bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200"
        >
          My Cart
        </Link>
      </div>
    </div>
  );
}
