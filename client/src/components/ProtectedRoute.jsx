// src/components/ProtectedRoute.jsx
import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  // Wait for the session to resolve before deciding: redirecting while auth is
  // still loading would bounce a signed-in user to /login on every refresh.
  if (loading) {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        role="status"
        aria-label="Checking your session"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    //  Redirect to login, but save where they came from
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
