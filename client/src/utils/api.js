import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  // Send/receive the HttpOnly auth cookies on every request.
  withCredentials: true,
});

/** Read a first-party cookie by name (used for the CSRF double-submit token). */
export function readCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * The readable CSRF cookie name. Production may use the stronger `__Host-`
 * prefix, so accept either form.
 */
export function readCsrfCookie() {
  return readCookie("__Host-fm_csrf") || readCookie("fm_csrf");
}

/**
 * A JS-readable hint that a session may exist. The real auth cookies are
 * HttpOnly; the readable CSRF cookie is issued only alongside a live session
 * and cleared on logout. It lets the client skip the boot-time `/auth/profile`
 * probe for guests instead of making a request that can only 401.
 */
export function hasSessionHint() {
  return Boolean(readCsrfCookie());
}

const SAFE_METHODS = new Set(["get", "head", "options"]);

api.interceptors.request.use((config) => {
  // Echo the readable CSRF cookie back in a header so the server can verify
  // the request did not originate from a cross-site context.
  const method = (config.method || "get").toLowerCase();
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCsrfCookie();
    if (csrf) config.headers["X-CSRF-Token"] = csrf;
  }
  return config;
});

// Auth endpoints surface their own errors (e.g. bad login credentials) and must
// not trigger the refresh/global-signout flow.
const isAuthEndpoint = (url = "") =>
  /\/auth\/(login|register|refresh|forgot-password|reset-password|2fa)/.test(
    url
  );

// A single in-flight refresh shared by all requests that hit a 401 at once, so
// concurrent calls don't each rotate the (single-use) refresh token.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    const status = response?.status;
    const url = config?.url || "";

    // Access token expired: try refreshing once, then replay the request.
    if (status === 401 && !isAuthEndpoint(url) && config && !config._retry) {
      config._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = api
            .post("/auth/refresh")
            .finally(() => {
              refreshPromise = null;
            });
        }
        await refreshPromise;
        return api(config);
      } catch {
        window.dispatchEvent(new Event("auth:unauthorized"));
        return Promise.reject(error);
      }
    }

    // Still unauthorized after a refresh attempt: force a signed-out state.
    if (status === 401 && !isAuthEndpoint(url)) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }

    return Promise.reject(error);
  }
);

export default api;
