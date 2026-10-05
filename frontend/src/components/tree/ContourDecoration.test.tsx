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

  it("inks contour lines with the contour token", () => {
    const { container } = render(<ContourDecoration />);
    const firstPath = container.querySelector("path");
    expect(firstPath?.getAttribute("stroke")).toBe("var(--color-contour)");
    expect(firstPath?.getAttribute("fill")).toBe("none");
  });

  it("tints the summit of each of its three hills", () => {
    const { container } = render(<ContourDecoration />);
    const summits = container.querySelectorAll("circle.contour-decoration__summit");
    expect(summits).toHaveLength(3);
    const gradientId = container.querySelector("radialGradient")?.getAttribute("id");
    expect(gradientId).toMatch(/^contour-glow-[\w-]+$/);
    expect(summits[0].getAttribute("fill")).toBe(`url(#${gradientId})`);
  });

  it("is hidden from assistive technology", () => {
    const { container } = render(<ContourDecoration />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("draws heavier index contours than the lines between them", () => {
    const { container } = render(<ContourDecoration />);
    const widths = [...container.querySelectorAll("path")].map((p) =>
      Number(p.getAttribute("stroke-width")),
    );
    expect(Math.max(...widths)).toBeGreaterThanOrEqual(1.5);
    expect(Math.min(...widths)).toBeLessThan(0.9);
  });
});
