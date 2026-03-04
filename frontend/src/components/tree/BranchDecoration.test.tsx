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
    expect(svg?.getAttribute("viewBox")).toBe("0 0 1000 1000");
  });

  it("has the branch-decoration class", () => {
    const { container } = render(<BranchDecoration />);
    const svg = container.querySelector("svg.branch-decoration");
    expect(svg).toBeTruthy();
  });

  it("renders leaf shapes as path elements inside groups", () => {
    const { container } = render(<BranchDecoration />);
    const groups = container.querySelectorAll("g");
    expect(groups.length).toBeGreaterThan(0);
    const paths = container.querySelectorAll("g > path");
    expect(paths.length).toBe(groups.length);
  });

  it("uses accent color for leaf fills", () => {
    const { container } = render(<BranchDecoration />);
    const firstPath = container.querySelector("g > path");
    expect(firstPath?.getAttribute("fill")).toBe("var(--color-accent)");
  });
});
