import React, { useState, useContext, useRef } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import BackToHome from "../components/BackToHome";
import Avatar from "../components/Avatar";
import { validatePassword, MIN_PASSWORD_LENGTH } from "../utils/passwordPolicy";
import { fileToAvatarDataUrl } from "../utils/avatarImage";

export default function ProfilePage() {
  const { user, updateProfile } = useContext(AuthContext);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef(null);

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

    if (password) {
      if (!currentPassword) {
        setError("Enter your current password to set a new one.");
        return;
      }
      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    setSubmitting(true);

    const updates = { name, email, avatar };
    if (password) {
      updates.password = password;
      updates.currentPassword = currentPassword;
    }

    const result = await updateProfile(updates);
    setSubmitting(false);

    if (result.success) {
      setMessage("Profile updated successfully.");
      setPassword("");
      setCurrentPassword("");
    } else {
      setError(result.message);
    }
  };

  const handleAvatarChange = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    setMessage("");
    setError("");
    setAvatarBusy(true);

    try {
      setAvatar(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(err.message || "Could not process that image.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar("");
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  return (
    <div className="mx-auto w-full max-w-xl p-4 sm:p-6">
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

      <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar
            name={user.name}
            email={user.email}
            size="lg"
            src={avatar}
            className="shadow-md"
          />
          <div className="min-w-0">
            <p className="text-lg font-semibold break-words">{user.name}</p>
            <p className="text-gray-500 text-sm break-words">{user.email}</p>
            <p className="text-gray-400 text-xs capitalize mt-1">Role: {user.role}</p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            ref={avatarInputRef}
            id="avatar"
            name="avatar"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAvatarChange}
            disabled={avatarBusy}
            className="sr-only"
          />
          <label
            htmlFor="avatar"
            className={`cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 ${
              avatarBusy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {avatarBusy
              ? "Processing..."
              : avatar
                ? "Change photo"
                : "Upload photo"}
          </label>
          {avatar && !avatarBusy && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="text-sm font-medium text-red-600 transition-colors hover:text-red-700"
            >
              Remove photo
            </button>
          )}
          <p className="basis-full text-xs text-gray-500">
            PNG, JPEG or WebP up to 5 MB. Your photo is cropped to a square and
            saved with the rest of your profile.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Current Password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Required only to change your password"
              autoComplete="current-password"
              className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              New Password (optional)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters, with a number`}
              autoComplete="new-password"
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
