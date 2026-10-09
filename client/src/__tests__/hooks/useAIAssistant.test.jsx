import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import useAIAssistant from "../../hooks/useAIAssistant";
import api from "../../utils/api";
import { CartContext } from "../../context/CartContext";

vi.mock("../../utils/api", () => ({ default: { post: vi.fn() } }));

const reply = (message = "Found 3 matches.", payload = {}) => ({
  data: {
    success: true,
    message,
    degraded: false,
    data: {
      products: [{ _id: "p1", name: "Rice", price: 2.5, countInStock: 5 }],
      cart: null,
      orders: [],
      ...payload,
    },
  },
});

function renderAssistant(replaceCart = vi.fn()) {
  return renderHook(() => useAIAssistant(), {
    wrapper: ({ children }) => (
      <CartContext.Provider value={{ replaceCart }}>{children}</CartContext.Provider>
    ),
  });
}

describe("useAIAssistant", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts with a single greeting and no error", () => {
    const { result } = renderAssistant();
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("assistant");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("appends the user message then the assistant reply", async () => {
    api.post.mockResolvedValue(reply());
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("show me rice");
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    expect(result.current.messages[1]).toMatchObject({
      role: "user",
      content: "show me rice",
    });
    expect(result.current.messages[2]).toMatchObject({
      role: "assistant",
      content: "Found 3 matches.",
    });
    expect(api.post).toHaveBeenCalledWith("/ai/chat", {
      message: "show me rice",
      history: [],
    });
  });

  it("mirrors a server cart into the client cart via replaceCart", async () => {
    const replaceCart = vi.fn();
    api.post.mockResolvedValue(
      reply("Here's your cart.", {
        cart: {
          total: 17.98,
          items: [
            {
              product: { _id: "p1", name: "Rice", price: 8.99, image: "/r.jpg", slug: "rice" },
              quantity: 2,
            },
          ],
        },
      })
    );
    const { result } = renderAssistant(replaceCart);

    await act(async () => {
      await result.current.send("check my cart");
    });

    await waitFor(() =>
      expect(replaceCart).toHaveBeenCalledWith([
        { id: "p1", slug: "rice", sku: undefined, name: "Rice", image: "/r.jpg", price: 8.99, quantity: 2 },
      ])
    );
  });

  it("does not touch the cart when the reply carries no cart", async () => {
    const replaceCart = vi.fn();
    api.post.mockResolvedValue(reply());
    const { result } = renderAssistant(replaceCart);

    await act(async () => {
      await result.current.send("show me rice");
    });

    expect(replaceCart).not.toHaveBeenCalled();
  });

  it("ignores blank and over-long input without calling the API", async () => {
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("   ");
      await result.current.send("x".repeat(2001));
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(1);
  });

  it("surfaces the server message on failure and clears loading", async () => {
    api.post.mockRejectedValue({
      response: { data: { message: "Slow down." } },
    });
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("rice");
    });

    await waitFor(() => expect(result.current.error).toBe("Slow down."));
    expect(result.current.loading).toBe(false);
  });

  it("falls back to a generic error when the response has no message", async () => {
    api.post.mockRejectedValue(new Error("network"));
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("rice");
    });

    await waitFor(() =>
      expect(result.current.error).toBe("The assistant is unavailable right now.")
    );
  });

  it("resets back to the greeting", async () => {
    api.post.mockResolvedValue(reply());
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("rice");
    });
    expect(result.current.messages).toHaveLength(3);

    act(() => result.current.reset());

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.error).toBe("");
  });

  it("discards a stale response when a newer message was sent", async () => {
    const pending = [];
    api.post.mockImplementation(
      () => new Promise((res) => pending.push(res))
    );

    const { result } = renderAssistant();

    act(() => {
      result.current.send("one");
    });
    act(() => {
      result.current.send("two");
    });

    expect(result.current.messages).toHaveLength(3);

    await act(async () => {
      pending[1](reply("newest"));
    });
    await act(async () => {
      pending[0](reply("stale"));
    });

    const texts = result.current.messages.map((m) => m.content);
    expect(texts).toContain("newest");
    expect(texts).not.toContain("stale");
  });
});