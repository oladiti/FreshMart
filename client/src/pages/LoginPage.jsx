import { useState, useContext, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { ShoppingBag } from "lucide-react";
import BackToHome from "../components/BackToHome";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-800 shadow-sm transition placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200";

export default function LoginPage() {
  const { user, loading, login, beginTwoFactorSetup, completeTwoFactorSetup } =
    useContext(AuthContext);
  const { notify } = useNotifications();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Admin enrolment flow: entered when login reports the account must enable 2FA
  // before a full session is granted.
  const [twoFactorSetupRequired, setTwoFactorSetupRequired] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // If this page is opened (or refreshed) by someone who is already signed in,
  // send them to the page they came from instead of showing the login form.
  // Only checked once, so it cannot interrupt an in-progress login/2FA flow.
  const checkedInitialAuthRef = useRef(false);
  useEffect(() => {
    if (loading || checkedInitialAuthRef.current) return;
    checkedInitialAuthRef.current = true;
    if (user) {
      navigate(location.state?.from?.pathname || "/", { replace: true });
    }
  }, [user, loading, navigate, location.state]);

  const startSetup = async () => {
    setSetupError("");
    const begin = await beginTwoFactorSetup();
    if (begin.success) {
      setSetupData(begin);
    } else {
      setSetupError(begin.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await login(email, password, twoFactorCode);
    setSubmitting(false);

    if (result.success) {
      notify("Signed in successfully.");
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
      return;
    }

    if (result.twoFactorSetupRequired) {
      setTwoFactorSetupRequired(true);
      await startSetup();
      return;
    }

    setTwoFactorRequired((prev) => prev || result.twoFactorRequired);
    setError(result.message);
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setSetupError("");
    setSetupSubmitting(true);

    const result = await completeTwoFactorSetup(setupCode.trim());
    setSetupSubmitting(false);

    if (result.success) {
      notify("Two-factor authentication enabled.");
      if (result.recoveryCodes?.length) {
        setRecoveryCodes(result.recoveryCodes);
        return;
      }
      navigate(location.state?.from?.pathname || "/", { replace: true });
      return;
    }

    setSetupError(result.message);
  };

  const finishSetup = () => {
    navigate(location.state?.from?.pathname || "/", { replace: true });
  };

  const renderSetup = () => {
    if (recoveryCodes) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Save your recovery codes
          </h3>
          <p className="text-sm text-gray-600">
            Store these somewhere safe. Each code can be used once to sign in if
            you lose access to your authenticator app.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm text-gray-800">
            {recoveryCodes.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
          <button
            type="button"
            onClick={finishSetup}
            className="w-full rounded-full bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:from-primary-700 hover:to-primary-800"
          >
            Continue to your account
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Set up two-factor authentication
        </h3>
        <p className="text-sm text-gray-600">
          Your account requires two-factor authentication. Scan the QR code with
          an authenticator app, then enter the 6-digit code it shows.
        </p>

        {setupError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
            {setupError}
          </div>
        )}

        {setupData ? (
          <>
            {setupData.qrDataUrl && (
              <img
                src={setupData.qrDataUrl}
                alt="Two-factor authentication QR code"
                className="mx-auto h-44 w-44 rounded-lg border border-gray-100 bg-white p-2"
              />
            )}
            {setupData.secret && (
              <p className="break-all text-center text-xs text-gray-500">
                Manual key: {setupData.secret}
              </p>
            )}
            <form onSubmit={handleSetupSubmit} className="space-y-3">
              <label
                htmlFor="setupCode"
                className="block text-sm font-medium text-gray-700"
              >
                Authentication code
              </label>
              <input
                id="setupCode"
                name="setupCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                required
                className={inputClass}
              />
              <button
                type="submit"
                disabled={setupSubmitting}
                className="w-full rounded-full bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:from-primary-700 hover:to-primary-800 disabled:opacity-50"
              >
                {setupSubmitting ? "Verifying..." : "Enable and sign in"}
              </button>
            </form>
          </>
        ) : (
          <p className="text-center text-sm text-gray-500">Preparing setup…</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 bg-cream">
      <BackToHome className="mb-6" />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-primary-700 to-amber-400"></div>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-500 text-white shadow-md">
              <ShoppingBag size={20} />
            </span>
            <h2 className="text-2xl font-bold text-gradient-green">
              {twoFactorSetupRequired ? "Two-Factor" : "Login"}
            </h2>
          </div>

          {twoFactorSetupRequired ? (
            renderSetup()
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
                  {error}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
                aria-label="Login form"
              >
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
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-gray-700"
                    >
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-sm text-primary-700 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                {twoFactorRequired && (
                  <div>
                    <label
                      htmlFor="twoFactorCode"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Authentication code
                    </label>
                    <input
                      id="twoFactorCode"
                      name="twoFactorCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enter the code from your authenticator app to finish
                      signing in.
                    </p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:from-primary-700 hover:to-primary-800 disabled:opacity-50"
                >
                  {submitting ? "Logging in..." : "Login"}
                </button>
              </form>

              <p className="text-sm text-center text-gray-600 mt-4">
                Don't have an account?{" "}
                <Link
                  to="/register"
                  className="text-primary-700 hover:underline font-medium"
                >
                  Register
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
