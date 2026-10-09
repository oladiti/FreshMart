import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AIMessage from "../../components/ai/AIMessage";

const assistantMessage = (data) => ({
  role: "assistant",
  content: "3 of 4 ingredients for Jollof Rice are in our catalogue.",
  data: { products: [], recipe: null, ...data },
});

const renderMessage = (message) =>
  render(
    <MemoryRouter>
      <AIMessage message={message} onAdd={vi.fn()} onAddAll={vi.fn()} addedIds={new Set()} />
    </MemoryRouter>
  );

const riceCard = {
  _id: "p1",
  name: "Rice 5kg",
  price: 12.99,
  slug: "rice-5kg",
  image: "rice.jpg",
  countInStock: 10,
};

const tomatoCard = {
  _id: "p3",
  name: "Chopped Tomatoes",
  price: 0.9,
  slug: "chopped-tomatoes",
  image: "tomatoes.jpg",
  countInStock: 20,
};

const plumCard = {
  _id: "p4",
  name: "Plum Tomatoes",
  price: 1.1,
  slug: "plum-tomatoes",
  image: "plum.jpg",
  countInStock: 8,
};

describe("AIMessage - recipe blocks", () => {
  it("renders the rule-based assistant's ingredient matches", () => {
    renderMessage(
      assistantMessage({
        recipe: {
          _id: "r1",
          title: "Jollof Rice",
          category: "Main",
          matched: [
            {
              ingredient: "2 cups long grain rice",
              product: riceCard,
              confidence: 0.97,
              ambiguous: false,
              matchedOn: "name",
              alternatives: [],
            },
            {
              ingredient: "tomatoes",
              product: tomatoCard,
              confidence: 0.97,
              ambiguous: true,
              matchedOn: "name",
              alternatives: [plumCard],
            },
          ],
          unmatched: ["scotch bonnet"],
          duplicates: [{ ingredient: "rice", duplicateOf: "2 cups long grain rice" }],
        },
      })
    );

    expect(screen.getByText("Jollof Rice")).toBeInTheDocument();
    expect(screen.getByText("2 cups long grain rice")).toBeInTheDocument();
    expect(screen.getByText(/Rice 5kg/)).toBeInTheDocument();
    expect(screen.getByText("£12.99")).toBeInTheDocument();

    expect(screen.getByText(/best guess/)).toBeInTheDocument();
    expect(screen.getByText(/Also: Plum Tomatoes/)).toBeInTheDocument();

    expect(screen.getByText("Not stocked: scotch bonnet")).toBeInTheDocument();
    expect(screen.getByText("Counted once: rice")).toBeInTheDocument();
  });

  it("says so when none of the ingredients are stocked", () => {
    renderMessage(
      assistantMessage({
        recipe: {
          _id: "r2",
          title: "Egusi Soup",
          category: "Soup",
          matched: [],
          unmatched: ["egusi", "palm oil"],
          duplicates: [],
        },
      })
    );

    expect(screen.getByText("Egusi Soup")).toBeInTheDocument();
    expect(screen.getByText("Not stocked: egusi, palm oil")).toBeInTheDocument();
  });

  it("renders the AI agent's shopping list envelope", () => {
    renderMessage(
      assistantMessage({
        recipe: {
          title: "Jollof Rice",
          recipe: { title: "Jollof Rice", ingredients: ["Rice", "Onions"] },
          lines: [
            { ingredient: "Rice", product: riceCard, confidence: "high" },
            { ingredient: "Onions", product: null },
          ],
          matchedCount: 1,
          unmatched: ["Onions"],
          total: 12.99,
          note: "Prices are estimates.",
        },
      })
    );

    expect(screen.getByText("Shopping list")).toBeInTheDocument();
    expect(screen.getByText("Estimated total")).toBeInTheDocument();
    expect(screen.getByText("Not stocked: Onions")).toBeInTheDocument();
    expect(screen.getByText("Prices are estimates.")).toBeInTheDocument();
  });

  it("renders a full recipe fetched by the agent", () => {
    renderMessage(
      assistantMessage({
        recipe: { recipe: { title: "Tomato Soup", ingredients: ["Tomatoes", "Onion"] } },
      })
    );

    expect(screen.getByText("Recipe")).toBeInTheDocument();
    expect(screen.getByText("Tomato Soup")).toBeInTheDocument();
    expect(screen.getByText("Tomatoes")).toBeInTheDocument();
    expect(screen.getByText("Onion")).toBeInTheDocument();
  });

  it("renders nothing when there is no recipe data", () => {
    const { container } = renderMessage(assistantMessage({ recipe: null }));

    expect(container.textContent).not.toContain("Recipe");
    expect(container.textContent).not.toContain("Shopping list");
  });
});

describe("AIMessage - shopping baskets", () => {
  it("renders a proposed budget basket", () => {
    renderMessage(
      assistantMessage({
        basket: { kind: "budget", items: [riceCard], total: 12.99, budget: 20, remaining: 7.01 },
      })
    );

    expect(screen.getByText("Proposed basket")).toBeInTheDocument();
    expect(screen.getByText(/Rice 5kg/)).toBeInTheDocument();
  });

  it("renders a reorder list and names the unavailable items", () => {
    renderMessage(
      assistantMessage({
        basket: {
          kind: "reorder",
          items: [riceCard],
          total: 12.99,
          missing: [{ name: "Ghost Item", quantity: 1 }],
        },
      })
    );

    expect(screen.getByText("Reorder list")).toBeInTheDocument();
    expect(screen.getByText(/Not available: Ghost Item/)).toBeInTheDocument();
  });

  it("says so when a reorder has nothing available", () => {
    renderMessage(
      assistantMessage({
        basket: { kind: "reorder", items: [], missing: [{ name: "Ghost Item", quantity: 1 }] },
      })
    );

    expect(screen.getByText(/None of those items are available/)).toBeInTheDocument();
  });
});
