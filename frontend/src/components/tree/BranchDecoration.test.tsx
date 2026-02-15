import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BranchDecoration } from "../BranchDecoration";

describe("BranchDecoration", () => {
  it("renders an SVG element", () => {
    const { container } = render(<BranchDecoration />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("has the correct viewBox", () => {
    const { container } = render(<BranchDecoration />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 630 630");
  });

  it("has the branch-decoration class", () => {
    const { container } = render(<BranchDecoration />);
    const svg = container.querySelector("svg.branch-decoration");
    expect(svg).toBeTruthy();
  });

  it("renders path elements for branches", () => {
    const { container } = render(<BranchDecoration />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("renders circle elements for leaf nodes", () => {
    const { container } = render(<BranchDecoration />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);
  });

  it("uses accent color for branches and nodes", () => {
    const { container } = render(<BranchDecoration />);
    const firstPath = container.querySelector("path");
    const firstCircle = container.querySelector("circle");

    expect(firstPath?.getAttribute("stroke")).toBe("var(--color-accent)");
    expect(firstCircle?.getAttribute("fill")).toBe("var(--color-accent)");
  });
});
