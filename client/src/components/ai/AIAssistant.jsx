import { useState } from "react";
import { Bot, X } from "lucide-react";
import AIChatWindow from "./AIChatWindow";

/**
 * Floating launcher for the AI assistant.
 *
 * Rendered globally (see App.jsx): a fixed bottom-right button that toggles the
 * chat panel. Kept out of developer-only admin routes by its caller.
 */
export default function AIAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {open && <AIChatWindow onClose={() => setOpen(false)} />}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={open}
        className={`mt-3 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-colors ${
          open
            ? "bg-gray-800 text-white hover:bg-gray-900"
            : "bg-primary-500 text-white hover:bg-primary-600"
        }`}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </div>
  );
}