import React, { useState } from "react";

export const IMAGE_PLACEHOLDER = "/images/placeholder.jpg";

// Drop-in <img> for product photos that can never flicker:
//  - `src` is normalized, falling back to the placeholder when empty.
//  - A broken image swaps to the placeholder at most once (per source), so a
//    failing placeholder can't trigger an endless error -> swap loop.
//  - The fallback is held in React state rather than mutating the DOM, so a
//    re-render never snaps the element back to the broken URL.
//  - A neutral background shows while the pixels load (no white flash).
export default function SafeImage({
  src,
  alt = "",
  fallbackSrc = IMAGE_PLACEHOLDER,
  loading = "lazy",
  decoding = "async",
  className = "",
  ...rest
}) {
  const [failedSrc, setFailedSrc] = useState(null);
  const resolvedSrc = src || fallbackSrc;
  const displaySrc = resolvedSrc === failedSrc ? fallbackSrc : resolvedSrc;

  const handleError = () => {
    if (failedSrc === resolvedSrc) return;
    setFailedSrc(resolvedSrc);
  };

  return (
    <img
      {...rest}
      src={displaySrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
      onError={handleError}
      className={`bg-gray-100 ${className}`}
    />
  );
}
