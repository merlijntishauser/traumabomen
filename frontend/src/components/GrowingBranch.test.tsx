import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GrowingBranch } from "./GrowingBranch";

describe("GrowingBranch", () => {
  it("renders a decorative svg", () => {
    const { container } = render(<GrowingBranch />);
    const svg = container.querySelector("svg.growing-branch");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("mounts safely without a scroll container or layout (jsdom)", () => {
    expect(() => render(<GrowingBranch />)).not.toThrow();
  });
});
