import { useCallback, useEffect, useState } from "react";
import api from "../utils/api";

// Matches the User model's address rule so both forms reject the same input.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The confirmation is informational, so it clears itself rather than needing a
// dismiss button. Errors deliberately persist until the user edits the field.
const AUTO_DISMISS_MS = 5000;

const SUCCESS_TEXT = "Thanks for subscribing!";
const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Shared newsletter signup logic for the home page banner and the footer form.
 *
 * The two forms look completely different (dark pill with an amber gradient vs.
 * a compact dark-on-dark row), so they share this hook rather than a component.
 *
 * @param {"home" | "footer"} source Recorded on the server so the subscriber
 *   list can be segmented by where the signup came from.
 */
export default function useNewsletter(source) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // { type: "success" | "error", text }
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status?.type !== "success") return;
    const timer = setTimeout(() => setStatus(null), AUTO_DISMISS_MS);
    // Clearing on every status change also restarts the window if the user
    // signs up again immediately, instead of inheriting the old timer.
    return () => clearTimeout(timer);
  }, [status]);

  const changeEmail = useCallback((value) => {
    setEmail(value);
    // Drop a stale error as soon as the user starts correcting it, but never
    // yank a success message out from under them mid-read.
    setStatus((prev) => (prev?.type === "error" ? null : prev));
  }, []);

  const subscribe = useCallback(
    async (e) => {
      e?.preventDefault?.();
      const trimmed = email.trim();

      if (!trimmed) {
        setStatus({ type: "error", text: "Please enter your email address." });
        return;
      }
      if (!EMAIL_PATTERN.test(trimmed)) {
        setStatus({ type: "error", text: "Please enter a valid email address." });
        return;
      }

      setSubmitting(true);
      try {
        const { data } = await api.post("/newsletter", {
          email: trimmed,
          source,
        });
        setEmail("");
        setStatus({
          type: "success",
          text: data?.message || SUCCESS_TEXT,
        });
      } catch (err) {
        setStatus({
          type: "error",
          text: err.response?.data?.message || GENERIC_ERROR,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [email, source]
  );

  return { email, changeEmail, status, submitting, subscribe };
}