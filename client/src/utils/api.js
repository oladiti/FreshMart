import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth endpoints surface their own 401s (e.g. bad login credentials) and must
// not trigger a global sign-out.
const isAuthEndpoint = (url = "") =>
  /\/auth\/(login|register|forgot-password|reset-password)/.test(url);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    // Stale/expired/invalid token: clear it so the app falls back to the
    // logged-out state instead of staying stuck on "token failed".
    if (status === 401 && !isAuthEndpoint(url)) {
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }

    return Promise.reject(error);
  }
);

export default api;
