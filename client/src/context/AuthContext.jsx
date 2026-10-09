import { createContext, useState, useEffect, useCallback } from "react";
import api from "../utils/api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  //  Load current logged-in user on app start (from localStorage) and verify
  //  the token is still valid. If the token is stale/expired the api
  //  interceptor clears it and fires "auth:unauthorized", which logs us out.
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("currentUser");

    if (!token || !storedUser) {
      setLoading(false);
      return;
    }

    let parsedUser = null;
    try {
      parsedUser = JSON.parse(storedUser);
    } catch {
      parsedUser = null;
    }
    setUser(parsedUser);

    api
      .get("/auth/profile")
      .then(({ data }) => {
        //  If the user logged out (or the token was cleared) while this request
        //  was in flight, don't resurrect the session.
        if (!localStorage.getItem("token")) return;
        const nextUser = { ...parsedUser, ...data, token };
        localStorage.setItem("currentUser", JSON.stringify(nextUser));
        setUser(nextUser);
      })
      .catch(() => {
        // 401 handled by the interceptor; anything else just falls back to the
        // stored user so a temporary network blip doesn't log the user out.
      })
      .finally(() => setLoading(false));
  }, []);

  //  Sign out when any API call reports an invalid/expired token.
  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  //  Register a new user (uses real backend)
  const register = useCallback(async (name, email, password) => {
    try {
      const { data } = await api.post("/auth/register", {
        name,
        email,
        password,
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("currentUser", JSON.stringify(data));
      setUser(data);
      return { success: true, data };
    } catch (error) {
      const message =
        error.response?.data?.message || "Registration failed. Try again.";
      return { success: false, message };
    }
  }, []);

  //  Login (uses real backend)
  const login = useCallback(async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("currentUser", JSON.stringify(data));
      setUser(data);
      return { success: true, data };
    } catch (error) {
      const message =
        error.response?.data?.message || "Invalid email or password.";
      return { success: false, message };
    }
  }, []);

  //  Update profile
  const updateProfile = useCallback(
    async (updates) => {
      try {
        const { data } = await api.put("/auth/profile", updates);
        const nextUser = { ...user, ...data };
        localStorage.setItem("currentUser", JSON.stringify(nextUser));
        setUser(nextUser);
        return { success: true, data: nextUser };
      } catch (error) {
        return {
          success: false,
          message:
            error.response?.data?.message || "Failed to update profile.",
        };
      }
    },
    [user]
  );

  //  Logout
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
