import { createContext, useState, useEffect, useCallback, useRef } from "react";
import api, { hasSessionHint } from "../utils/api";

export const AuthContext = createContext();

// Non-sensitive cache of the signed-in user (name/email/role). The auth token
// itself lives only in HttpOnly cookies and is never readable by JavaScript.
const USER_CACHE_KEY = "currentUser";

function cacheUser(user) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    /* ignore storage errors (private mode, quota, etc.) */
  }
}

function readCachedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  // Seed from the display cache synchronously so a refresh keeps the signed-in
  // user on the first render instead of briefly appearing signed out.
  const [user, setUser] = useState(() => readCachedUser());
  const [loading, setLoading] = useState(true);

  // Set once an explicit auth action (login/register/update/logout) runs. The
  // boot-time profile request must not clobber a result that a newer action has
  // already applied, so it is ignored once this flips.
  const explicitAuthRef = useRef(false);

  // Verify the session on start via the HttpOnly auth cookie. The token is
  // never exposed to JS; api.js transparently refreshes it when it expires.
  useEffect(() => {
    let active = true;

    const cached = readCachedUser();

    if (cached) {
      setUser(cached);
    }

    // Nothing indicates a live session (no readable session cookie and no
    // cached user), so skip the probe: for a guest it can only return 401.
    const shouldVerify = Boolean(cached) || hasSessionHint();

    if (!shouldVerify) {
      cacheUser(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const loadProfile = async () => {
      try {
        const { data } = await api.get("/auth/profile");

        if (!active || explicitAuthRef.current) return;

        setUser(data);
        cacheUser(data);
      } catch (error) {
        if (!active || explicitAuthRef.current) return;

        const status = error.response?.status;

        // An unauthenticated session is a normal state for logged-out users.
        if (status === 401) {
          setUser(null);
          cacheUser(null);
        } else {
          // Keep cached user information during temporary server/network errors.
          // This cache is for display only and does not authenticate the user.
          if (!cached) {
            setUser(null);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  // Sign out when any API call reports an invalid/expired session.
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      cacheUser(null);
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  //  Register a new user (uses real backend; session cookies are set server-side)
  const register = useCallback(async (name, email, password) => {
    explicitAuthRef.current = true;
    try {
      const { data } = await api.post("/auth/register", {
        name,
        email,
        password,
      });
      // Never cache the session token or the transient verification metadata;
      // surface the latter to the caller so it can prompt for verification.
      const { token: _token, verificationSent, devVerifyLink, ...nextUser } = data;
      setUser(nextUser);
      cacheUser(nextUser);
      return {
        success: true,
        data: nextUser,
        verificationSent: Boolean(verificationSent),
        devVerifyLink: devVerifyLink || null,
      };
    } catch (error) {
      const message =
        error.response?.data?.message || "Registration failed. Try again.";
      return { success: false, message };
    }
  }, []);

  //  Login (uses real backend; session cookies are set server-side). When the
  //  account has 2FA enabled the server responds with twoFactorRequired; the
  //  caller re-submits with the TOTP/recovery code.
  const login = useCallback(async (email, password, twoFactorCode) => {
    explicitAuthRef.current = true;
    try {
      const body = { email, password };
      if (twoFactorCode) body.twoFactorCode = twoFactorCode;
      const { data } = await api.post("/auth/login", body);
      const nextUser = { ...data };
      delete nextUser.token;
      setUser(nextUser);
      cacheUser(nextUser);
      return { success: true, data: nextUser };
    } catch (error) {
      const res = error.response?.data;
      return {
        success: false,
        message: res?.message || "Invalid email or password.",
        twoFactorRequired: Boolean(res?.twoFactorRequired),
        // Set when an admin must enrol in 2FA before a full session is granted.
        // The server has issued a short-lived setup cookie to authorise that.
        twoFactorSetupRequired: Boolean(res?.twoFactorSetupRequired),
      };
    }
  }, []);

  //  Begin 2FA enrolment for an admin who was blocked at login. Authorised by
  //  the short-lived setup cookie the server set with the 403 response. Returns
  //  the shared secret plus a QR data URL for the authenticator app.
  const beginTwoFactorSetup = useCallback(async () => {
    try {
      const { data } = await api.post("/auth/2fa/setup");
      return { success: true, ...data };
    } catch (error) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Could not start two-factor setup. Please log in again.",
      };
    }
  }, []);

  //  Confirm the first authenticator code. On success the server enables 2FA and
  //  (because enrolment used the setup cookie) issues the full session, so we
  //  then load the profile to populate the signed-in user.
  const completeTwoFactorSetup = useCallback(async (code) => {
    explicitAuthRef.current = true;
    try {
      const { data } = await api.post("/auth/2fa/enable", { code });
      let nextUser = null;
      try {
        const profile = await api.get("/auth/profile");
        nextUser = { ...profile.data };
        delete nextUser.token;
        setUser(nextUser);
        cacheUser(nextUser);
      } catch {
        /* session is established; a failed profile read just skips the cache */
      }
      return {
        success: true,
        data: nextUser,
        recoveryCodes: data?.recoveryCodes || [],
      };
    } catch (error) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Invalid authentication code.",
      };
    }
  }, []);

  //  Update profile
  const updateProfile = useCallback(
    async (updates) => {
      explicitAuthRef.current = true;
      try {
        const { data } = await api.put("/auth/profile", updates);
        const profile = { ...data };
        delete profile.token;
        const nextUser = { ...user, ...profile };
        setUser(nextUser);
        cacheUser(nextUser);
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



  //  Logout (clears server-side cookies + refresh token, then local state)
  const logout = useCallback(async () => {
    explicitAuthRef.current = true;
    try {
      await api.post("/auth/logout");
    } catch {
      /* best effort: clear local state regardless */
    }
    setUser(null);
    cacheUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        beginTwoFactorSetup,
        completeTwoFactorSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
