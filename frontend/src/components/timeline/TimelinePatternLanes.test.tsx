import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPattern, DecryptedPerson } from "../../hooks/useTreeData";
import { computePatternRings, TimelinePatternLanes } from "./TimelinePatternLanes";
import type { PersonColumn, PersonRow } from "./timelineHelpers";

vi.mock("../../lib/patternColors", () => ({
  getPatternColor: (hex: string) => hex,
  PATTERN_COLORS: ["#818cf8", "#f472b6"],
}));

function makePerson(id: string, birthYear = 1980): DecryptedPerson {
  return {
    id,
    name: `Person ${id}`,
    birth_year: birthYear,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    gender: "unknown",
    is_adopted: false,
    notes: null,
  };
}

function makePattern(id: string, overrides: Partial<DecryptedPattern> = {}): DecryptedPattern {
  return {
    id,
    name: `Pattern ${id}`,
    description: "",
    color: "#818cf8",
    linked_entities: [],
    person_ids: [],
    ...overrides,
  };
}

describe("computePatternRings", () => {
  it("returns empty map when no visible patterns", () => {
    const patterns = new Map([["pat1", makePattern("pat1")]]);
    const rings = computePatternRings(patterns, new Set());
    expect(rings.size).toBe(0);
  });

  it("maps entity keys to pattern ring colors", () => {
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          color: "#818cf8",
          linked_entities: [
            { entity_type: "trauma_event", entity_id: "e1" },
            { entity_type: "life_event", entity_id: "le1" },
          ],
        }),
      ],
    ]);
    const rings = computePatternRings(patterns, new Set(["pat1"]));
    expect(rings.get("trauma_event:e1")).toEqual([{ color: "#818cf8", patternId: "pat1" }]);
    expect(rings.get("life_event:le1")).toEqual([{ color: "#818cf8", patternId: "pat1" }]);
  });

  it("stacks multiple patterns on the same entity", () => {
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          color: "#818cf8",
          linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
        }),
      ],
      [
        "pat2",
        makePattern("pat2", {
          color: "#f472b6",
          linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
        }),
      ],
    ]);
    const rings = computePatternRings(patterns, new Set(["pat1", "pat2"]));
    const entityRings = rings.get("trauma_event:e1");
    expect(entityRings).toHaveLength(2);
    expect(entityRings![0].color).toBe("#818cf8");
    expect(entityRings![1].color).toBe("#f472b6");
  });

  it("skips non-visible patterns", () => {
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
        }),
      ],
    ]);
    const rings = computePatternRings(patterns, new Set(["other"]));
    expect(rings.size).toBe(0);
  });
});

describe("TimelinePatternLanes (horizontal)", () => {
  const rows: PersonRow[] = [
    { person: makePerson("p1"), generation: 0, y: 32 },
    { person: makePerson("p2"), generation: 0, y: 80 },
  ];

  const baseProps = {
    patterns: new Map<string, DecryptedPattern>(),
    visiblePatternIds: new Set<string>(),
    hoveredPatternId: null,
    onPatternHover: vi.fn(),
    onPatternClick: vi.fn(),
    direction: "horizontal" as const,
    rows,
    rowHeight: 48,
  };

  it("renders nothing when no visible patterns", () => {
    const { container } = render(
      <svg>
        <TimelinePatternLanes {...baseProps} />
      </svg>,
    );
    expect(container.querySelector("[data-testid='pattern-lanes']")).toBeNull();
  });

  it("skips non-visible patterns in tints", () => {
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
      ["pat2", makePattern("pat2", { person_ids: ["p2"], color: "#f472b6" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
        />
      </svg>,
    );
    expect(container.querySelector("[data-testid='pattern-lane-pat1-p1']")).toBeTruthy();
    expect(container.querySelector("[data-testid='pattern-lane-pat2-p2']")).toBeNull();
  });

  it("skips persons not in rows", () => {
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1", "unknown"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
        />
      </svg>,
    );
    expect(container.querySelector("[data-testid='pattern-lane-pat1-p1']")).toBeTruthy();
    expect(container.querySelector("[data-testid='pattern-lane-pat1-unknown']")).toBeNull();
  });

  it("renders lane tints for involved persons", () => {
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
        />
      </svg>,
    );
    const lane = container.querySelector("[data-testid='pattern-lane-pat1-p1']");
    expect(lane).toBeTruthy();
    expect(lane?.getAttribute("fill-opacity")).toBe("0.08");
  });

  it("renders pattern name label in each tinted lane", () => {
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", { name: "Addiction cycle", person_ids: ["p1"], color: "#818cf8" }),
      ],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
        />
      </svg>,
    );
    const label = container.querySelector("[data-testid='pattern-label-pat1-p1']");
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe("Addiction cycle");
  });

  it("does not render tint for persons not in pattern", () => {
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
        />
      </svg>,
    );
    expect(container.querySelector("[data-testid='pattern-lane-pat1-p2']")).toBeNull();
  });

  it("increases opacity on hover", () => {
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
          hoveredPatternId="pat1"
        />
      </svg>,
    );
    const lane = container.querySelector("[data-testid='pattern-lane-pat1-p1']");
    expect(lane?.getAttribute("fill-opacity")).toBe("0.14");
  });

  it("calls onPatternClick when lane tint is clicked", () => {
    const onPatternClick = vi.fn();
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
          onPatternClick={onPatternClick}
        />
      </svg>,
    );
    const lane = container.querySelector("[data-testid='pattern-lane-pat1-p1']");
    fireEvent.click(lane!);
    expect(onPatternClick).toHaveBeenCalledWith("pat1");
  });

  it("renders multiple pattern names inline when they share a person", () => {
    const patterns = new Map([
      ["pat1", makePattern("pat1", { name: "Pattern A", person_ids: ["p1"], color: "#818cf8" })],
      ["pat2", makePattern("pat2", { name: "Pattern B", person_ids: ["p1"], color: "#f472b6" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1", "pat2"])}
        />
      </svg>,
    );
    // Both names render as tspans within a single text element
    const spanA = container.querySelector("[data-testid='pattern-label-pat1-p1']");
    const spanB = container.querySelector("[data-testid='pattern-label-pat2-p1']");
    expect(spanA?.tagName).toBe("tspan");
    expect(spanB?.tagName).toBe("tspan");
    // They share the same parent text element
    expect(spanA?.parentElement).toBe(spanB?.parentElement);
    expect(spanA?.textContent).toBe("Pattern A");
    expect(spanB?.textContent).toBe("Pattern B");
  });

  it("calls onPatternHover on mouseenter/leave", () => {
    const onPatternHover = vi.fn();
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
          onPatternHover={onPatternHover}
        />
      </svg>,
    );
    const lane = container.querySelector("[data-testid='pattern-lane-pat1-p1']");
    fireEvent.mouseEnter(lane!);
    expect(onPatternHover).toHaveBeenCalledWith("pat1");
    fireEvent.mouseLeave(lane!);
    expect(onPatternHover).toHaveBeenCalledWith(null);
  });
});

describe("TimelinePatternLanes (vertical)", () => {
  const columns: PersonColumn[] = [
    { person: makePerson("p1"), generation: 0, x: 40, laneWidth: 36 },
    { person: makePerson("p2"), generation: 0, x: 76, laneWidth: 36 },
  ];

  const baseProps = {
    patterns: new Map<string, DecryptedPattern>(),
    visiblePatternIds: new Set<string>(),
    hoveredPatternId: null,
    onPatternHover: vi.fn(),
    onPatternClick: vi.fn(),
    direction: "vertical" as const,
    columns,
    height: 500,
  };

  it("renders lane tints for vertical columns", () => {
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
        />
      </svg>,
    );
    const lane = container.querySelector("[data-testid='pattern-lane-pat1-p1']");
    expect(lane).toBeTruthy();
    expect(lane?.getAttribute("x")).toBe("40");
    expect(lane?.getAttribute("width")).toBe("36");
    expect(lane?.getAttribute("height")).toBe("500");
  });

  it("renders multiple pattern names inline when they share a person", () => {
    const patterns = new Map([
      ["pat1", makePattern("pat1", { name: "Pattern A", person_ids: ["p1"], color: "#818cf8" })],
      ["pat2", makePattern("pat2", { name: "Pattern B", person_ids: ["p1"], color: "#f472b6" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1", "pat2"])}
        />
      </svg>,
    );
    const spanA = container.querySelector("[data-testid='pattern-label-pat1-p1']");
    const spanB = container.querySelector("[data-testid='pattern-label-pat2-p1']");
    expect(spanA?.tagName).toBe("tspan");
    expect(spanB?.tagName).toBe("tspan");
    expect(spanA?.parentElement).toBe(spanB?.parentElement);
    expect(spanA?.textContent).toBe("Pattern A");
    expect(spanB?.textContent).toBe("Pattern B");
  });

  it("renders nothing when no visible patterns", () => {
    const { container } = render(
      <svg>
        <TimelinePatternLanes {...baseProps} />
      </svg>,
    );
    expect(container.querySelector("[data-testid='pattern-lanes']")).toBeNull();
  });

  it("calls onPatternHover on mouseenter/leave for vertical lanes", () => {
    const onPatternHover = vi.fn();
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
          onPatternHover={onPatternHover}
        />
      </svg>,
    );
    const lane = container.querySelector("[data-testid='pattern-lane-pat1-p1']");
    fireEvent.mouseEnter(lane!);
    expect(onPatternHover).toHaveBeenCalledWith("pat1");
    fireEvent.mouseLeave(lane!);
    expect(onPatternHover).toHaveBeenCalledWith(null);
  });

  it("calls onPatternClick when vertical lane tint is clicked", () => {
    const onPatternClick = vi.fn();
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
          onPatternClick={onPatternClick}
        />
      </svg>,
    );
    const lane = container.querySelector("[data-testid='pattern-lane-pat1-p1']");
    fireEvent.click(lane!);
    expect(onPatternClick).toHaveBeenCalledWith("pat1");
  });

  it("increases opacity on hover for vertical lanes", () => {
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
          hoveredPatternId="pat1"
        />
      </svg>,
    );
    const lane = container.querySelector("[data-testid='pattern-lane-pat1-p1']");
    expect(lane?.getAttribute("fill-opacity")).toBe("0.14");
  });
});

describe("TimelinePatternLanes (fallback)", () => {
  it("returns null when direction is horizontal but no rows are provided", () => {
    const patterns = new Map([
      ["pat1", makePattern("pat1", { person_ids: ["p1"], color: "#818cf8" })],
    ]);
    const { container } = render(
      <svg>
        <TimelinePatternLanes
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
          hoveredPatternId={null}
          onPatternHover={vi.fn()}
          onPatternClick={vi.fn()}
          direction="horizontal"
        />
      </svg>,
    );
    expect(container.querySelector("[data-testid='pattern-lanes']")).toBeNull();
  });
});
