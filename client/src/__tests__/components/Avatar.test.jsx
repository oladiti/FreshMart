import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Avatar from "../../components/Avatar";

describe("Avatar", () => {
  it("uses the first letter of the first and last name", () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("uses a single initial for a one-word name", () => {
    render(<Avatar name="Cher" />);
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("falls back to U when there is no name", () => {
    const { unmount } = render(<Avatar name="" />);
    expect(screen.getByText("U")).toBeInTheDocument();
    unmount();
    render(<Avatar />);
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("is exposed as an accessible image labelled with the name", () => {
    render(<Avatar name="Grace Hopper" />);
    expect(
      screen.getByRole("img", { name: "Grace Hopper avatar" })
    ).toBeInTheDocument();
  });

  it("applies the requested size classes", () => {
    render(<Avatar name="Ada Lovelace" size="lg" />);
    expect(screen.getByRole("img")).toHaveClass("h-16", "w-16");
  });

  it("gives the same user a deterministic gradient", () => {
    const { container, unmount } = render(
      <Avatar name="Ada Lovelace" email="ada@example.com" />
    );
    const first = container.firstChild.style.backgroundImage;
    unmount();

    const { container: second } = render(
      <Avatar name="Ada Lovelace" email="ada@example.com" />
    );

    expect(first).toContain("linear-gradient");
    expect(second.firstChild.style.backgroundImage).toBe(first);
  });

  it("gives different users different gradients", () => {
    const { container: a } = render(<Avatar name="Ada Lovelace" />);
    const { container: b } = render(<Avatar name="Bob Marley" />);

    expect(a.firstChild.style.backgroundImage).not.toBe(
      b.firstChild.style.backgroundImage
    );
  });

  it("renders an uploaded picture when src is provided", () => {
    const src = "data:image/jpeg;base64,avatar";
    render(<Avatar name="Grace Hopper" src={src} />);

    const image = screen.getByRole("img", { name: "Grace Hopper avatar" });
    expect(image.tagName).toBe("IMG");
    expect(image).toHaveAttribute("src", src);
  });

  it("falls back to initials when the uploaded picture fails to load", () => {
    render(<Avatar name="Grace Hopper" src="bad-image" />);

    fireEvent.error(screen.getByRole("img", { name: "Grace Hopper avatar" }));

    expect(screen.getByText("GH")).toBeInTheDocument();
  });
});
