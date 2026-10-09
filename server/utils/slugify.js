// Shared URL-safe slug generator. Kept in its own module so both the Product
// and Recipe models derive their canonical slugs from the exact same rules.
export const slugify = (text) =>
  text
    ? text
        .toLowerCase()
        .trim()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";