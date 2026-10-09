// Small validation helpers shared by the AI tool runners.
//
// Every runner validates its arguments before touching the database, in the
// same spirit as the assistant tool contract: reject unknown types, never let
// a caller smuggle arbitrary object shapes into a query.

export function addError(errors, field, message) {
  errors.push({ field, message });
}

export function asString(value, field, errors, { required = false, max = 500 } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) addError(errors, field, `${field} is required.`);
    return "";
  }
  if (typeof value !== "string") {
    addError(errors, field, `${field} must be a string.`);
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    addError(errors, field, `${field} must be ${max} characters or fewer.`);
    return "";
  }
  return trimmed;
}

export function asPositiveInt(
  value,
  field,
  errors,
  { required = false, fallback = 1, max = 99 } = {}
) {
  if (value === undefined || value === null || value === "") {
    if (required) addError(errors, field, `${field} is required.`);
    return required ? null : fallback;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    addError(errors, field, `${field} must be a whole number of at least 1.`);
    return fallback;
  }
  if (n > max) {
    addError(errors, field, `${field} must be ${max} or less.`);
    return fallback;
  }
  return n;
}

export function asNonNegativeInt(
  value,
  field,
  errors,
  { fallback = 0, max = 99 } = {}
) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    addError(errors, field, `${field} must be a whole number of at least 0.`);
    return fallback;
  }
  if (n > max) {
    addError(errors, field, `${field} must be ${max} or less.`);
    return fallback;
  }
  return n;
}

export function asBoolean(value, fallback = false) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return Boolean(fallback);
}

/** Require a list of strings (e.g. free-text recipe ingredients). */
export function asStringArray(value, field, errors, { maxItems = 25, maxLength = 200 } = {}) {
  if (!Array.isArray(value)) {
    addError(errors, field, `${field} must be an array of strings.`);
    return [];
  }
  if (value.length > maxItems) {
    addError(errors, field, `${field} accepts at most ${maxItems} items.`);
    return [];
  }
  const out = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      addError(errors, field, `${field} must contain only strings.`);
      return [];
    }
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxLength) {
      addError(errors, field, `${field} entries must be ${maxLength} characters or fewer.`);
      return [];
    }
    out.push(trimmed);
  }
  return out;
}

/** Reject object-shaped input (e.g. Mongo operators) without inspecting it. */
export function ensurePlainObject(raw, errors) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return true;
  addError(errors, "(root)", "Arguments must be an object.");
  return false;
}