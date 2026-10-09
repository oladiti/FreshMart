import { useContext, useEffect, useRef, useState } from "react";
import { Bot, X, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { CartContext } from "../../context/CartContext";
import { useAIAssistant } from "../../hooks/useAIAssistant";
import AIMessage from "./AIMessage";
import AIInput from "./AIInput";

const EXAMPLES = [
  "What should I buy next?",
  "Show me rice under £10",
  "What can I buy with £15?",
  "Ingredients for jollof rice",
  "Check my cart",
  "Track my last order",
];

/**
 * The AI assistant chat panel: message history, structured-data rendering,
 * and quick prompts. Floating widget mechanics mirror the assistant drawer.
 */
export default function AIChatWindow({ onClose }) {
  const { messages, loading, error, send, reset } = useAIAssistant();
  const { addToCart } = useContext(CartContext);
  const [draft, setDraft] = useState("");
  const [addedIds, setAddedIds] = useState(() => new Set());

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Clear "added" markers when a new answer arrives.
  useEffect(() => {
    setAddedIds(new Set());
  }, [messages.length]);

  // Keep the newest message in view.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (text) => {
    const value = String(text ?? draft).trim();
    if (!value || loading) return;
    setDraft("");
    await send(value);
  };

  const addOne = (product) => {
    addToCart(product, 1);
    setAddedIds((prev) => new Set(prev).add(product._id));
  };

  const addAll = (items) => {
    items.forEach((product) => {
      if (Number(product.countInStock) > 0) addToCart(product, 1);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI shopping assistant"
      className="flex h-[min(36rem,70vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-gray-50 shadow-2xl ring-1 ring-gray-200"
    >
      <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-white">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">FreshMart Assistant</p>
          <p className="text-xs text-gray-500">Search, cart, recipes, orders</p>
        </div>
        <button
          type="button"
          onClick={reset}
          aria-label="Clear conversation"
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-3">
        {messages.map((message) => (
          <AIMessage
            key={message.id}
            message={message}
            addedIds={addedIds}
            onAdd={addOne}
            onAddAll={addAll}
            onConfirm={() => submit("Yes, please go ahead.")}
          />
        ))}

        {loading && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {messages.length === 1 && (
        <div className="border-t border-gray-100 bg-white px-3 py-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <Sparkles className="h-3.5 w-3.5" />
            Try one of these
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => submit(example)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-50"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      <AIInput
        value={draft}
        onChange={setDraft}
        onSubmit={() => submit()}
        disabled={loading}
      />
    </div>
  );
}