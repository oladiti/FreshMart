import { useCallback, useContext, useRef, useState } from "react";
import api from "../utils/api";
import { CartContext } from "../context/CartContext";

const MAX_LENGTH = 2000;
const HISTORY_TURNS = 8;

/** The greeting the widget opens with; not persisted, never sent to the API. */
const GREETING = {
  id: "greeting",
  role: "assistant",
  content:
    "Hi! I'm the FreshMart assistant. Ask me to find products, plan a shopping list for a recipe, check your cart, track an order, or look up store policies.",
  data: {},
  degraded: false,
};

/** Map a server cart view onto the localStorage cart item shape. */
function toClientCart(serverCart) {
  if (!serverCart || !Array.isArray(serverCart.items)) return null;
  const mapped = serverCart.items
    .filter((item) => item.product && item.product._id)
    .map((item) => ({
      id: item.product._id,
      slug: item.product.slug,
      sku: item.product.sku,
      name: item.product.name,
      image: item.product.image || "",
      price: Number(item.product.price) || 0,
      quantity: item.quantity,
    }));
  return mapped;
}

/**
 * Conversation state for the AI assistant.
 *
 * Each reply carries the server's structured `data` payload so the widget can
 * render product cards, cart summaries, recipes and order lists without
 * re-parsing prose. When the server returns a cart (i.e. the AI changed or
 * showed your cart), the visible cart is replaced with that server state so
 * both stay in sync.
 */
export function useAIAssistant() {
  const { replaceCart } = useContext(CartContext) || {};
  const [messages, setMessages] = useState([GREETING]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Guards against out-of-order replies: only the newest response may commit.
  const requestId = useRef(0);

  const send = useCallback(
    async (text) => {
      const trimmed = String(text || "").trim();
      if (!trimmed || trimmed.length > MAX_LENGTH) return;

      const id = ++requestId.current;
      const userMessage = { id: `u-${id}`, role: "user", content: trimmed };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError("");

      // History = everything up to (not including) this message.
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.id !== "greeting")
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const { data } = await api.post("/ai/chat", {
          message: trimmed,
          history,
        });
        if (id !== requestId.current) return; // superseded by a newer message

        const serverCart = data?.data?.cart;
        if (serverCart && typeof replaceCart === "function") {
          const mapped = toClientCart(serverCart);
          if (mapped) replaceCart(mapped);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${id}`,
            role: "assistant",
            content: data?.message || "I didn't catch that.",
            data: data?.data ?? {},
            degraded: Boolean(data?.degraded),
          },
        ]);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(
          err.response?.data?.message || "The assistant is unavailable right now."
        );
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [messages, replaceCart]
  );

  const reset = useCallback(() => {
    requestId.current += 1; // abandon any in-flight response
    setMessages([GREETING]);
    setError("");
    setLoading(false);
  }, []);

  return { messages, loading, error, send, reset };
}

export default useAIAssistant;