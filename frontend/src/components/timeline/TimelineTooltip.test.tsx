import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { INITIAL_TOOLTIP, TimelineTooltip, type TooltipState } from "./TimelineTooltip";

describe("TimelineTooltip", () => {
  it("returns null when not visible", () => {
    const { container } = render(<TimelineTooltip state={INITIAL_TOOLTIP} />);
    expect(container.querySelector(".timeline-tooltip")).toBeNull();
  });

  it("renders tooltip div when visible", () => {
    const state: TooltipState = {
      visible: true,
      x: 100,
      y: 200,
      lines: [{ text: "Hello" }],
    };
    const { container } = render(<TimelineTooltip state={state} />);
    expect(container.querySelector(".timeline-tooltip")).toBeTruthy();
  });

  it("positions tooltip with offset from cursor", () => {
    const state: TooltipState = {
      visible: true,
      x: 100,
      y: 200,
      lines: [{ text: "Hello" }],
    };
    const { container } = render(<TimelineTooltip state={state} />);
    const tooltip = container.querySelector(".timeline-tooltip") as HTMLDivElement;
    expect(tooltip.style.left).toBe("112px");
    expect(tooltip.style.top).toBe("190px");
  });

  it("renders all text lines", () => {
    const state: TooltipState = {
      visible: true,
      x: 0,
      y: 0,
      lines: [{ text: "Line 1" }, { text: "Line 2" }, { text: "Line 3" }],
    };
    render(<TimelineTooltip state={state} />);
    expect(screen.getByText("Line 1")).toBeTruthy();
    expect(screen.getByText("Line 2")).toBeTruthy();
    expect(screen.getByText("Line 3")).toBeTruthy();
  });

  it("renders bold text with fontWeight 600", () => {
    const state: TooltipState = {
      visible: true,
      x: 0,
      y: 0,
      lines: [{ text: "Normal" }, { text: "Bold", bold: true }],
    };
    render(<TimelineTooltip state={state} />);
    const boldSpan = screen.getByText("Bold");
    expect(boldSpan.style.fontWeight).toBe("600");
  });

  it("does not apply fontWeight to non-bold lines", () => {
    const state: TooltipState = {
      visible: true,
      x: 0,
      y: 0,
      lines: [{ text: "Normal" }],
    };
    render(<TimelineTooltip state={state} />);
    const span = screen.getByText("Normal");
    expect(span.style.fontWeight).toBe("");
  });

  it("inserts br elements between lines", () => {
    const state: TooltipState = {
      visible: true,
      x: 0,
      y: 0,
      lines: [{ text: "A" }, { text: "B" }, { text: "C" }],
    };
    const { container } = render(<TimelineTooltip state={state} />);
    const brs = container.querySelectorAll("br");
    expect(brs).toHaveLength(2);
  });

  it("INITIAL_TOOLTIP is not visible", () => {
    expect(INITIAL_TOOLTIP.visible).toBe(false);
    expect(INITIAL_TOOLTIP.lines).toHaveLength(0);
  });
});
