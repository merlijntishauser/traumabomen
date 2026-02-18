import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PartnerStatus } from "../../types/domain";
import { PartnerLine } from "./PartnerLine";
import { ROW_HEIGHT } from "./timelineHelpers";

const defaultProps = {
  sourceName: "Alice",
  targetName: "Bob",
  sourceY: 20,
  targetY: 56,
  periods: [{ start_year: 1975, end_year: null as number | null, status: PartnerStatus.Married }],
  currentYear: 2025,
  cssVar: (name: string) => name,
  t: (key: string) => key,
  onTooltip: vi.fn(),
};

function renderPartnerLine(overrides: Record<string, unknown> = {}) {
  const props = { ...defaultProps, onTooltip: vi.fn(), ...overrides };
  return {
    ...render(
      <svg>
        <PartnerLine {...props} />
      </svg>,
    ),
    props,
  };
}

describe("PartnerLine", () => {
  it("renders two lines per period (visible + hover target)", () => {
    const { container } = renderPartnerLine();
    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(2);
  });

  it("renders four lines for two periods", () => {
    const { container } = renderPartnerLine({
      periods: [
        { start_year: 1975, end_year: 1985, status: PartnerStatus.Married },
        { start_year: 1990, end_year: null, status: PartnerStatus.Together },
      ],
    });
    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(4);
  });

  it("positions lines at midpoint between partner rows", () => {
    const { container } = renderPartnerLine();
    const expectedMidY = (20 + ROW_HEIGHT / 2 + 56 + ROW_HEIGHT / 2) / 2;
    const visibleLine = container.querySelectorAll("line")[0];
    expect(visibleLine.getAttribute("y1")).toBe(String(expectedMidY));
    expect(visibleLine.getAttribute("y2")).toBe(String(expectedMidY));
  });

  it("uses start_year and end_year for x coordinates", () => {
    const { container } = renderPartnerLine({
      periods: [{ start_year: 1975, end_year: 2000, status: PartnerStatus.Married }],
    });
    const visibleLine = container.querySelectorAll("line")[0];
    expect(visibleLine.getAttribute("x1")).toBe("1975");
    expect(visibleLine.getAttribute("x2")).toBe("2000");
  });

  it("uses currentYear when end_year is null", () => {
    const { container } = renderPartnerLine();
    const visibleLine = container.querySelectorAll("line")[0];
    expect(visibleLine.getAttribute("x2")).toBe("2025");
  });

  it("renders dashed stroke for separated periods", () => {
    const { container } = renderPartnerLine({
      periods: [{ start_year: 1975, end_year: 1980, status: PartnerStatus.Separated }],
    });
    const visibleLine = container.querySelectorAll("line")[0];
    expect(visibleLine.getAttribute("stroke-dasharray")).toBe("6 3");
  });

  it("renders dashed stroke for divorced periods", () => {
    const { container } = renderPartnerLine({
      periods: [{ start_year: 1975, end_year: 1985, status: PartnerStatus.Divorced }],
    });
    const visibleLine = container.querySelectorAll("line")[0];
    expect(visibleLine.getAttribute("stroke-dasharray")).toBe("6 3");
  });

  it("renders solid stroke for together/married periods", () => {
    const { container } = renderPartnerLine({
      periods: [{ start_year: 1975, end_year: null, status: PartnerStatus.Together }],
    });
    const visibleLine = container.querySelectorAll("line")[0];
    expect(visibleLine.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("hover target has transparent stroke and 12px width", () => {
    const { container } = renderPartnerLine();
    const hoverLine = container.querySelectorAll("line")[1];
    expect(hoverLine.getAttribute("stroke")).toBe("transparent");
    expect(hoverLine.getAttribute("stroke-width")).toBe("12");
  });

  it("shows tooltip on hover target mouseenter", () => {
    const { container, props } = renderPartnerLine();
    const hoverLine = container.querySelectorAll("line")[1];

    fireEvent.mouseEnter(hoverLine, { clientX: 200, clientY: 100 });

    expect(props.onTooltip).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        lines: expect.arrayContaining([
          expect.objectContaining({ text: expect.stringContaining("Alice") }),
          expect.objectContaining({ text: expect.stringContaining("Bob") }),
        ]),
      }),
    );
  });

  it("hides tooltip on mouseleave", () => {
    const { container, props } = renderPartnerLine();
    const hoverLine = container.querySelectorAll("line")[1];

    fireEvent.mouseLeave(hoverLine);

    expect(props.onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it("renders nothing for empty periods array", () => {
    const { container } = renderPartnerLine({ periods: [] });
    expect(container.querySelectorAll("line")).toHaveLength(0);
  });
});
