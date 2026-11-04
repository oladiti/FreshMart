import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CartContext } from "../../context/CartContext";
import FloatingCart from "../../components/FloatingCart";

const cart = [
  { id: "p1", name: "Whole Milk", price: 1.8, image: "/images/milk.jpg", quantity: 2 },
];

const renderCart = ({ cart: items = cart, totalItems } = {}) => {
  const removeFromCart = vi.fn();
  const utils = render(
    <CartContext.Provider
      value={{
        cart: items,
        totalItems:
          totalItems ?? items.reduce((sum, item) => sum + item.quantity, 0),
        removeFromCart,
      }}
    >
      <MemoryRouter>
        <FloatingCart />
      </MemoryRouter>
    </CartContext.Provider>
  );
  return { ...utils, removeFromCart };
};

describe("FloatingCart", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when the cart is empty", () => {
    renderCart({ cart: [], totalItems: 0 });
    expect(screen.queryByRole("button", { name: /open cart/i })).toBeNull();
  });

  it("shows the cart button with the item count badge", () => {
    renderCart();
    const button = screen.getByRole("button", { name: "Open cart, 2 items" });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("md:hidden");
    expect(button).toHaveTextContent("2");
  });

  it("opens the cart sheet with items, total and actions", () => {
    renderCart();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open cart, 2 items" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Whole Milk")).toBeInTheDocument();
    expect(screen.getByText(/£3\.6/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Cart" })).toHaveAttribute(
      "href",
      "/cart"
    );
    expect(screen.getByRole("link", { name: "Checkout" })).toHaveAttribute(
      "href",
      "/checkout"
    );
  });

  it("removes an item from the sheet after confirmation", () => {
    const { removeFromCart } = renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Open cart, 2 items" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(removeFromCart).toHaveBeenCalledWith("p1", "Whole Milk");
  });

  it("closes the sheet with the close button", () => {
    renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Open cart, 2 items" }));
    fireEvent.click(screen.getByRole("button", { name: "Close cart" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the sheet on Escape", () => {
    renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Open cart, 2 items" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
