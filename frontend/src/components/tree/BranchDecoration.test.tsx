import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BranchDecoration } from "./BranchDecoration";

describe("BranchDecoration", () => {
  it("renders an SVG element", () => {
    const { container } = render(<BranchDecoration />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("has the branch-decoration class", () => {
    const { container } = render(<BranchDecoration />);
    const svg = container.querySelector("svg.branch-decoration");
    expect(svg).toBeTruthy();
  });

  it("renders contour line paths", () => {
    const { container } = render(<BranchDecoration />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("uses accent color for contour strokes", () => {
    const { container } = render(<BranchDecoration />);
    const firstPath = container.querySelector("path");
    expect(firstPath?.getAttribute("stroke")).toBe("var(--color-accent)");
    expect(firstPath?.getAttribute("fill")).toBe("none");
  });
});
