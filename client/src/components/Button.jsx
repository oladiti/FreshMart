// src/components/Button.jsx
import { motion } from "framer-motion";

export default function Button({
  children,
  onClick,
  className = "",
  disabled = false,
  type = "button",
}) {
  return (
    <motion.button
      type={type}
      whileHover={disabled ? undefined : { scale: 1.02, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:from-primary-700 hover:to-primary-800 hover:shadow-xl hover:shadow-primary-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-primary-600 ${className}`}
    >
      {children}
    </motion.button>
  );
}
// client/src/components/Button.jsx