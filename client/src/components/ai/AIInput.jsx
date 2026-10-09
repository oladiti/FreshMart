import { Send } from "lucide-react";

/**
 * Message input for the AI assistant chat.
 */
export default function AIInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask about products, cart, recipes or orders…",
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-3"
    >
      <label htmlFor="ai-assistant-input" className="sr-only">
        Message the AI assistant
      </label>
      <input
        id="ai-assistant-input"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={2000}
        autoComplete="off"
        className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white transition-colors hover:bg-primary-600 disabled:opacity-40"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}