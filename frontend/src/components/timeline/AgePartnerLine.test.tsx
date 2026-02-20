import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PartnerStatus } from "../../types/domain";
import { AgePartnerLine } from "./AgePartnerLine";

const defaultProps = {
  sourceName: "Alice",
  targetName: "Bob",
  sourceX: 60,
  targetX: 160,
  sourceLaneWidth: 40,
  targetLaneWidth: 40,
  periods: [{ start_year: 2000, end_year: null as number | null, status: PartnerStatus.Married }],
  ageScale: (age: number) => age * 5 + 52,
  birthYears: { source: 1970, target: 1972 },
  currentYear: 2025,
  cssVar: (name: string) => name,
  t: (key: string) => key,
  onTooltip: vi.fn(),
};

function renderAgePartnerLine(overrides: Record<string, unknown> = {}) {
  const props = { ...defaultProps, onTooltip: vi.fn(), ...overrides };
  return {
    ...render(
      <svg>
        <AgePartnerLine {...props} />
      </svg>,
    ),
    props,
  };
}

describe("AgePartnerLine", () => {
  it("renders five lines per period (1 horizontal connector + 2 vertical bars + 2 hover targets)", () => {
    const { container } = renderAgePartnerLine();
    expect(container.querySelectorAll("line")).toHaveLength(5);
  });

  it("renders ten lines for two periods", () => {
    const { container } = renderAgePartnerLine({
      periods: [
        { start_year: 2000, end_year: 2010, status: PartnerStatus.Married },
        { start_year: 2015, end_year: null, status: PartnerStatus.Together },
      ],
    });
    expect(container.querySelectorAll("line")).toHaveLength(10);
  });

  it("renders no text labels (tooltip-only)", () => {
    const { container } = renderAgePartnerLine();
    expect(container.querySelectorAll("text")).toHaveLength(0);
  });

  it("renders dashed stroke for separated periods", () => {
    const { container } = renderAgePartnerLine({
      periods: [{ start_year: 2000, end_year: 2005, status: PartnerStatus.Separated }],
    });
    const lines = container.querySelectorAll("line");
    // connector
    expect(lines[0].getAttribute("stroke-dasharray")).toBe("6 3");
    // source vertical bar
    expect(lines[1].getAttribute("stroke-dasharray")).toBe("6 3");
  });

  it("renders dashed stroke for divorced periods", () => {
    const { container } = renderAgePartnerLine({
      periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Divorced }],
    });
    const lines = container.querySelectorAll("line");
    expect(lines[1].getAttribute("stroke-dasharray")).toBe("6 3");
  });

  it("renders solid stroke for together/married periods", () => {
    const { container } = renderAgePartnerLine({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    const lines = container.querySelectorAll("line");
    expect(lines[1].getAttribute("stroke-dasharray")).toBeNull();
  });

  it("uses ageScale to compute vertical positions from birth years", () => {
    const ageScale = (age: number) => age * 10;
    const { container } = renderAgePartnerLine({
      ageScale,
      periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Married }],
      birthYears: { source: 1980, target: 1982 },
    });
    const lines = container.querySelectorAll("line");
    // Source vertical bar: start age = 2000-1980 = 20, end age = 2010-1980 = 30
    const srcBar = lines[1];
    expect(srcBar.getAttribute("y1")).toBe(String(ageScale(20)));
    expect(srcBar.getAttribute("y2")).toBe(String(ageScale(30)));
    // Target vertical bar: start age = 2000-1982 = 18, end age = 2010-1982 = 28
    const tgtBar = lines[3];
    expect(tgtBar.getAttribute("y1")).toBe(String(ageScale(18)));
    expect(tgtBar.getAttribute("y2")).toBe(String(ageScale(28)));
  });

  it("uses currentYear when end_year is null", () => {
    const ageScale = (age: number) => age * 10;
    const { container } = renderAgePartnerLine({
      ageScale,
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Married }],
      birthYears: { source: 1980, target: 1982 },
      currentYear: 2025,
    });
    const srcBar = container.querySelectorAll("line")[1];
    // end age = 2025-1980 = 45
    expect(srcBar.getAttribute("y2")).toBe(String(ageScale(45)));
  });

  it("shows tooltip on hover target mouseenter", () => {
    const { container, props } = renderAgePartnerLine();
    // Hover targets: source at index 2, target at index 4
    const hoverTarget = container.querySelectorAll("line")[2];

    fireEvent.mouseEnter(hoverTarget, { clientX: 200, clientY: 100 });

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
    const { container, props } = renderAgePartnerLine();
    const hoverTarget = container.querySelectorAll("line")[2];

    fireEvent.mouseLeave(hoverTarget);

    expect(props.onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it("renders nothing for empty periods array", () => {
    const { container } = renderAgePartnerLine({ periods: [] });
    expect(container.querySelectorAll("line")).toHaveLength(0);
  });

  it("renders only source bar when target is hidden (targetX null)", () => {
    const { container } = renderAgePartnerLine({ targetX: null });
    // No connector, no target bar/hover: just source vertical + hover = 2 lines
    expect(container.querySelectorAll("line")).toHaveLength(2);
  });

  it("renders only target bar when source is hidden (sourceX null)", () => {
    const { container } = renderAgePartnerLine({ sourceX: null });
    expect(container.querySelectorAll("line")).toHaveLength(2);
  });

  it("renders nothing when both partners are hidden", () => {
    const { container } = renderAgePartnerLine({ sourceX: null, targetX: null });
    expect(container.querySelectorAll("line")).toHaveLength(0);
  });
});
