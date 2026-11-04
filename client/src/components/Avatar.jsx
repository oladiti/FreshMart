// User avatar. Shows an uploaded picture when `src` is available, otherwise
// falls back to initials on a deterministic gradient derived from name + email.
// Both forms are exposed as an accessible image.

import { useEffect, useState } from "react";

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-2xl",
};

/** First letter of the first and last word, e.g. "Ada Lovelace" -> "AL". */
function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "U";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/** Small stable string hash (djb2-ish) so a user's colours never change. */
function hashString(value) {
  const str = String(value || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export default function Avatar({
  name = "",
  email = "",
  size = "md",
  className = "",
  src = "",
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const label = `${name || "User"} avatar`;

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={label}
        onError={() => setImageFailed(true)}
        className={`inline-block shrink-0 select-none rounded-full object-cover ring-1 ring-black/5 ${sizeClass} ${className}`}
      />
    );
  }

  const initials = getInitials(name);
  const hue = hashString(`${name}${email}`) % 360;
  const backgroundImage = `linear-gradient(135deg, hsl(${hue} 65% 52%), hsl(${
    (hue + 40) % 360
  } 65% 40%))`;

  return (
    <span
      role="img"
      aria-label={label}
      style={{ backgroundImage }}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/5 ${sizeClass} ${className}`}
    >
      {initials}
    </span>
  );
}
