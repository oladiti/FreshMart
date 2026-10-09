import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CartContext } from "../../context/CartContext";
import AIAssistant from "../../components/ai/AIAssistant";
import api from "../../utils/api";

vi.mock("../../utils/api", () => ({ default: { post: vi.fn() } }));

const products = [
  {
    _id: "p1",
    name: "Saco Rice 5kg",
    slug: "saco-rice-5kg",
    category: "Pantry",
    price: 8.99,
    countInStock: 12,
    image: "rice.jpg",
    reviewCount: 4,
  },
  {
    _id: "p2",
    name: "Sunflower Oil 1L",
    slug: "sunflower-oil",
    category: "Pantry",
    price: 3.2,
    countInStock: 0,
    image: "oil.jpg",
    reviewCount: 0,
  },
];

const ok = (over = {}) => ({
  data: {
    success: true,
    message: "Here you go.",
    degraded: false,
    data: {
      products,
      cart: null,
      recipe: null,
      orders: [],
      history: [],
      ...over,
    },
  },
});

function renderAssistant(cartValue = {}) {
  return render(
    <CartContext.Provider
      value={{
        addToCart: vi.fn(),
        replaceCart: vi.fn(),
        cart: [],
        cartTotalQuantity: 0,
        ...cartValue,
      }}
    >
      <MemoryRouter>
        <AIAssistant />
      </MemoryRouter>
    </CartContext.Provider>
  );
}

const openPanel = async (user) => {
  await user.click(screen.getByRole("button", { name: "Open AI assistant" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
};

const ask = async (user, text) => {
  await user.type(screen.getByLabelText(/message the AI assistant/i), text);
  await user.click(screen.getByRole("button", { name: "Send" }));
};

describe("AIAssistant", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows only the launcher button when closed", () => {
    renderAssistant();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open AI assistant" })
    ).toBeInTheDocument();
  });

  it("opens a dialog with a greeting and quick prompts", async () => {
    const user = userEvent.setup();
    renderAssistant();
    await openPanel(user);

    expect(screen.getByText(/I'm the FreshMart assistant/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show me rice under £10" })
    ).toBeInTheDocument();
  });

  it("sends a quick prompt and renders the grounded product card", async () => {
    api.post.mockResolvedValue(ok());
    const user = userEvent.setup();
    renderAssistant();
    await openPanel(user);

    await user.click(screen.getByRole("button", { name: "Show me rice under £10" }));

    await waitFor(() =>
      expect(screen.getByText("Here you go.")).toBeInTheDocument()
    );
    expect(api.post).toHaveBeenCalledWith("/ai/chat", {
      message: "Show me rice under £10",
      history: [],
    });

    expect(screen.getByText("Saco Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("£8.99")).toBeInTheDocument();
  });

  it("adds a product to the client cart and marks it added", async () => {
    api.post.mockResolvedValue(ok());
    const addToCart = vi.fn();
    const user = userEvent.setup();
    renderAssistant({ addToCart });
    await openPanel(user);
    await ask(user, "show me rice");

    await waitFor(() =>
      expect(screen.getByText("Saco Rice 5kg")).toBeInTheDocument()
    );

    await user.click(
      screen.getByRole("button", { name: /add Saco Rice 5kg to cart/i })
    );

    expect(addToCart).toHaveBeenCalledWith(products[0], 1);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /add Saco Rice 5kg to cart/i })
      ).toHaveAttribute("aria-pressed", "true")
    );
  });

  it("does not offer to add a sold-out product and disables add-all", async () => {
    api.post.mockResolvedValue(ok());
    const user = userEvent.setup();
    renderAssistant();
    await openPanel(user);
    await ask(user, "show me rice");

    await waitFor(() =>
      expect(screen.getByText("Sunflower Oil 1L")).toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: /Sunflower Oil 1L is sold out/i })
    ).toBeDisabled();
  });

  it("renders the cart the AI returned and mirrors it into the store", async () => {
    const replaceCart = vi.fn();
    api.post.mockResolvedValue(
      ok({
        products: [],
        cart: {
          total: 8.99,
          items: [
            {
              product: {
                _id: "p1",
                slug: "saco-rice-5kg",
                sku: "SKU1",
                name: "Saco Rice 5kg",
                price: 8.99,
                image: "rice.jpg",
              },
              quantity: 1,
              lineTotal: 8.99,
            },
          ],
        },
      })
    );
    const user = userEvent.setup();
    renderAssistant({ replaceCart });
    await openPanel(user);
    await ask(user, "check my cart");

    await waitFor(() => expect(screen.getByText("Total")).toBeInTheDocument());
    expect(screen.getAllByText("£8.99")).toHaveLength(2);
    await waitFor(() =>
      expect(replaceCart).toHaveBeenCalledWith([
        {
          id: "p1",
          slug: "saco-rice-5kg",
          sku: "SKU1",
          name: "Saco Rice 5kg",
          price: 8.99,
          image: "rice.jpg",
          quantity: 1,
        },
      ])
    );
  });

  it("can confirm an AI-proposed cart change", async () => {
    api.post.mockResolvedValue(
      ok({
        products: [],
        needsConfirmation: {
          summary: { name: "Saco Rice 5kg", quantity: 10, reason: "bulk" },
        },
      })
    );
    const user = userEvent.setup();
    renderAssistant();
    await openPanel(user);
    await ask(user, "add 10 rice");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/ai/chat", {
        message: "Yes, please go ahead.",
        history: expect.any(Array),
      })
    );
  });

  it("shows a server error and lets the user retry", async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { message: "Too many requests." } },
    });
    api.post.mockResolvedValueOnce(ok());
    const user = userEvent.setup();
    renderAssistant();
    await openPanel(user);

    await ask(user, "rice");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Too many requests.")
    );

    const input = screen.getByLabelText(/message the AI assistant/i);
    expect(input).toBeEnabled();

    await user.type(input, "better rice");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(screen.getByText("Here you go.")).toBeInTheDocument()
    );
  });

  it("clears the conversation back to the greeting", async () => {
    api.post.mockResolvedValue(ok());
    const user = userEvent.setup();
    renderAssistant();
    await openPanel(user);
    await ask(user, "rice");

    await waitFor(() =>
      expect(screen.getByText("Here you go.")).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /clear conversation/i }));

    expect(screen.queryByText("Here you go.")).not.toBeInTheDocument();
    expect(screen.getByText(/I'm the FreshMart assistant/i)).toBeInTheDocument();
  });

  it("closes back to the launcher button", async () => {
    const user = userEvent.setup();
    renderAssistant();
    await openPanel(user);

    await user.click(screen.getByRole("button", { name: "Close assistant" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open AI assistant" })
    ).toBeInTheDocument();
  });
});