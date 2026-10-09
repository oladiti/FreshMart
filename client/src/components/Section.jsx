import React from "react";

const PADDING = {
  default: "py-14 md:py-16",
  compact: "py-6 md:py-8",
  none: "",
};

export default function Section({
  id,
  padding = "default",
  className = "",
  containerClassName = "",
  children,
}) {
  const paddingClass = PADDING[padding] ?? PADDING.default;

  return (
    <section id={id} className={`w-full ${paddingClass} ${className}`}>
      <div className={`w-full px-4 sm:px-6 lg:px-10 ${containerClassName}`}>
        {children}
      </div>
    </section>
  );
}
