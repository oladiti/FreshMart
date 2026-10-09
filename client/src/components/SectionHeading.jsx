import React from "react";

const TONES = {
  default: {
    eyebrow: "text-primary-600",
    title: "text-gradient-green",
    bar: "bg-primary-600",
    subtitle: "text-gray-600",
  },
  light: {
    eyebrow: "text-primary-300",
    title: "text-white",
    bar: "from-primary-500 to-amber-400",
    subtitle: "text-gray-300",
  },
};

export default function SectionHeading({
  title,
  subtitle,
  eyebrow,
  tone = "default",
  className = "",
}) {
  const styles = TONES[tone] || TONES.default;

  return (
    <div className={`mb-10 text-center ${className}`}>
      {eyebrow && (
        <p
          className={`mb-2 text-xs font-semibold uppercase tracking-[0.2em] ${styles.eyebrow}`}
        >
          {eyebrow}
        </p>
      )}
      <h2 className={`text-3xl font-bold md:text-4xl ${styles.title}`}>
        {title}
      </h2>
      <div
        className={`mx-auto mt-4 h-1.5 w-24 rounded-full bg-gradient-to-r ${styles.bar}`}
      />
      {subtitle && (
        <p className={`mx-auto mt-4 max-w-2xl ${styles.subtitle}`}>{subtitle}</p>
      )}
    </div>
  );
}
