import React from "react";
import { Sprout } from "lucide-react";

export default function Loader({ label = "Loading", className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 ${className}`}>
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
        <span className="absolute inset-1.5 animate-pulse rounded-full bg-primary-50/80" />
        <Sprout className="relative h-6 w-6 text-primary-600" />
      </div>
      <p className="mt-4 text-sm font-medium text-gray-500">{label}…</p>
    </div>
  );
}