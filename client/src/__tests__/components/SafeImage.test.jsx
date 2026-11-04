import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SafeImage, { IMAGE_PLACEHOLDER } from "../../components/SafeImage";

describe("SafeImage", () => {
  it("renders the provided src with lazy loading and async decoding", () => {
    render(<SafeImage src="/images/apples.png" alt="Apples" />);
    const img = screen.getByRole("img", { name: "Apples" });
    expect(img).toHaveAttribute("src", "/images/apples.png");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
  });

  it("shows a neutral background while the image loads", () => {
    render(<SafeImage src="/images/apples.png" alt="Apples" className="h-20 w-20" />);
    expect(screen.getByRole("img")).toHaveClass("bg-gray-100", "h-20", "w-20");
  });

  it("falls back to the placeholder when the image fails", () => {
    render(<SafeImage src="/images/broken.jpg" alt="Broken" />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", IMAGE_PLACEHOLDER);
  });

  it("never loops when the placeholder itself fails", () => {
    render(<SafeImage src="/images/broken.jpg" alt="Broken" />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    fireEvent.error(img);
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", IMAGE_PLACEHOLDER);
  });

  it("uses the placeholder when no src is provided", () => {
    render(<SafeImage alt="Missing" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", IMAGE_PLACEHOLDER);
  });

  it("allows overriding the loading strategy", () => {
    render(<SafeImage src="/images/apples.png" alt="Apples" loading="eager" />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
  });
});
