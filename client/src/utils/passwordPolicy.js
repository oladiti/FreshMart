// Client mirror of the server password policy (server/utils/passwordPolicy.js).
// Kept in sync so the user gets immediate feedback instead of a round-trip
// rejection. The server remains the source of truth and re-validates.

export const MIN_PASSWORD_LENGTH = 6;

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "passw0rd123",
  "1234567890",
  "12345678910",
  "1234567890a",
  "qwerty12345",
  "qwertyuiop",
  "letmein123",
  "letmein1234",
  "admin12345",
  "administrator",
  "iloveyou123",
  "welcome123",
  "welcome1234",
  "changeme123",
  "football123",
  "monkey12345",
  "1q2w3e4r5t",
  "abc1234567",
]);

/**
 * Validate a password against the policy.
 * @param {unknown} password
 * @returns {string|null} an error message, or null when the password is fine.
 */
export function validatePassword(password) {
  if (typeof password !== "string" || !password) {
    return "Password is required";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one number";
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "Password is too common. Please choose a stronger password";
  }

  return null;
}

export default validatePassword;
