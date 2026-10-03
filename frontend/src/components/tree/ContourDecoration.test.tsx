import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContourDecoration } from "./ContourDecoration";

describe("ContourDecoration", () => {
  it("renders an SVG element", () => {
    const { container } = render(<ContourDecoration />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("has the contour-decoration class", () => {
    const { container } = render(<ContourDecoration />);
    const svg = container.querySelector("svg.contour-decoration");
    expect(svg).toBeTruthy();
  });

  it("renders contour line paths", () => {
    const { container } = render(<ContourDecoration />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("uses accent color for contour strokes", () => {
    const { container } = render(<ContourDecoration />);
    const firstPath = container.querySelector("path");
    expect(firstPath?.getAttribute("stroke")).toBe("var(--color-accent)");
    expect(firstPath?.getAttribute("fill")).toBe("none");
  });
});
