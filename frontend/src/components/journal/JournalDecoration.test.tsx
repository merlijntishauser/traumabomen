import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JournalDecoration } from "./JournalDecoration";

describe("JournalDecoration", () => {
  it("renders an svg with ruled lines and words", () => {
    const { container } = render(<JournalDecoration />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");

    // Should have ruled lines
    const lines = svg!.querySelectorAll("line");
    expect(lines.length).toBeGreaterThanOrEqual(14); // 14 ruled + 1 margin

    // Should have text elements for words
    const texts = svg!.querySelectorAll("text");
    expect(texts.length).toBeGreaterThanOrEqual(8);
  });

  it("uses heading font for word elements", () => {
    const { container } = render(<JournalDecoration />);
    const text = container.querySelector("text");
    expect(text).toHaveAttribute("font-family", "var(--font-heading)");
  });
});
