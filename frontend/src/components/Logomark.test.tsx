import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logomark } from "./Logomark";

describe("Logomark", () => {
  it("renders an SVG marked aria-hidden", () => {
    const { container } = render(<Logomark />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("uses default size of 28 when not provided", () => {
    const { container } = render(<Logomark />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("28");
    expect(svg.getAttribute("height")).toBe("28");
  });

  it("respects a custom size", () => {
    const { container } = render(<Logomark size={48} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("48");
    expect(svg.getAttribute("height")).toBe("48");
  });

  it("forwards className to the SVG element", () => {
    const { container } = render(<Logomark className="brand-mark" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveClass("brand-mark");
  });

  it("paints the canopy with accent and references the domain palette", () => {
    // The dots in the upper canopy use trauma-loss, classification-suspected,
    // and text-muted — proves the mark is wired to the theme variables, not
    // hard-coded colors.
    const { container } = render(<Logomark />);
    const fills = Array.from(container.querySelectorAll("circle, path"))
      .map((el) => el.getAttribute("fill") ?? el.getAttribute("stroke"))
      .filter(Boolean);
    expect(fills.some((f) => f?.includes("--color-accent"))).toBe(true);
    expect(fills.some((f) => f?.includes("--color-trauma-loss"))).toBe(true);
    expect(fills.some((f) => f?.includes("--color-classification-suspected"))).toBe(true);
  });
});
