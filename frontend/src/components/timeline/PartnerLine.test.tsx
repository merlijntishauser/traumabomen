import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PartnerStatus } from "../../types/domain";
import { PartnerLine } from "./PartnerLine";
import { BAR_HEIGHT, ROW_HEIGHT } from "./timelineHelpers";

const defaultProps = {
  sourceName: "Alice",
  targetName: "Bob",
  sourceY: 20,
  targetY: 56,
  periods: [{ start_year: 1975, end_year: null as number | null, status: PartnerStatus.Married }],
  currentYear: 2025,
  xScale: (v: number) => v,
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
  it("renders five lines per period (1 vertical + 2 horizontal + 2 hover targets)", () => {
    const { container } = renderPartnerLine();
    expect(container.querySelectorAll("line")).toHaveLength(5);
  });

  it("renders ten lines for two periods", () => {
    const { container } = renderPartnerLine({
      periods: [
        { start_year: 1975, end_year: 1985, status: PartnerStatus.Married },
        { start_year: 1990, end_year: null, status: PartnerStatus.Together },
      ],
    });
    expect(container.querySelectorAll("line")).toHaveLength(10);
  });

  it("positions horizontal lines inside partner lanes below the life bar", () => {
    const { container } = renderPartnerLine();
    const barOffset = (ROW_HEIGHT - BAR_HEIGHT) / 2 + BAR_HEIGHT + 3;
    const srcLineY = 20 + barOffset;
    const tgtLineY = 56 + barOffset;
    const lines = container.querySelectorAll("line");

    // Vertical connector (first line)
    expect(lines[0].getAttribute("y1")).toBe(String(srcLineY));
    expect(lines[0].getAttribute("y2")).toBe(String(tgtLineY));

    // Source horizontal line (second)
    expect(lines[1].getAttribute("y1")).toBe(String(srcLineY));

    // Target horizontal line (fourth, after source hover target)
    expect(lines[3].getAttribute("y1")).toBe(String(tgtLineY));
  });

  it("renders labels with partner names", () => {
    const t = (key: string, opts?: Record<string, unknown>) =>
      opts ? `${opts.status} ${opts.name}` : key;
    const { container } = renderPartnerLine({ t });
    const texts = container.querySelectorAll("text");
    expect(texts).toHaveLength(2);
    // Source label shows status + target name
    expect(texts[0].textContent).toContain("Bob");
    // Target label shows status + source name
    expect(texts[1].textContent).toContain("Alice");
  });

  it("uses start_year and end_year for x coordinates", () => {
    const { container } = renderPartnerLine({
      periods: [{ start_year: 1975, end_year: 2000, status: PartnerStatus.Married }],
    });
    const horizontalLine = container.querySelectorAll("line")[1];
    expect(horizontalLine.getAttribute("x1")).toBe("1975");
    expect(horizontalLine.getAttribute("x2")).toBe("2000");
  });

  it("uses currentYear when end_year is null", () => {
    const { container } = renderPartnerLine();
    const horizontalLine = container.querySelectorAll("line")[1];
    expect(horizontalLine.getAttribute("x2")).toBe("2025");
  });

  it("renders dashed stroke for separated periods", () => {
    const { container } = renderPartnerLine({
      periods: [{ start_year: 1975, end_year: 1980, status: PartnerStatus.Separated }],
    });
    const horizontalLine = container.querySelectorAll("line")[1];
    expect(horizontalLine.getAttribute("stroke-dasharray")).toBe("6 3");
  });

  it("renders dashed stroke for divorced periods", () => {
    const { container } = renderPartnerLine({
      periods: [{ start_year: 1975, end_year: 1985, status: PartnerStatus.Divorced }],
    });
    const horizontalLine = container.querySelectorAll("line")[1];
    expect(horizontalLine.getAttribute("stroke-dasharray")).toBe("6 3");
  });

  it("renders solid stroke for together/married periods", () => {
    const { container } = renderPartnerLine({
      periods: [{ start_year: 1975, end_year: null, status: PartnerStatus.Together }],
    });
    const horizontalLine = container.querySelectorAll("line")[1];
    expect(horizontalLine.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("shows tooltip on hover target mouseenter", () => {
    const { container, props } = renderPartnerLine();
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
    const { container, props } = renderPartnerLine();
    const hoverTarget = container.querySelectorAll("line")[2];

    fireEvent.mouseLeave(hoverTarget);

    expect(props.onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it("renders nothing for empty periods array", () => {
    const { container } = renderPartnerLine({ periods: [] });
    expect(container.querySelectorAll("line")).toHaveLength(0);
    expect(container.querySelectorAll("text")).toHaveLength(0);
  });

  it("renders only source line when target is hidden (targetY null)", () => {
    const { container } = renderPartnerLine({ targetY: null });
    // No vertical connector, no target line/hover: just source horizontal + hover = 2 lines, 1 text
    expect(container.querySelectorAll("line")).toHaveLength(2);
    expect(container.querySelectorAll("text")).toHaveLength(1);
  });

  it("renders only target line when source is hidden (sourceY null)", () => {
    const { container } = renderPartnerLine({ sourceY: null });
    expect(container.querySelectorAll("line")).toHaveLength(2);
    expect(container.querySelectorAll("text")).toHaveLength(1);
  });

  it("renders nothing when both partners are hidden", () => {
    const { container } = renderPartnerLine({ sourceY: null, targetY: null });
    expect(container.querySelectorAll("line")).toHaveLength(0);
  });
});
