import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import { emitCellSegments, PatternConnectors } from "./PatternConnectors";

// Mock @xyflow/react -- mutable so tests can override
let mockNodes = [
  { id: "p1", position: { x: 0, y: 0 }, data: {} },
  { id: "p2", position: { x: 200, y: 0 }, data: {} },
];

vi.mock("@xyflow/react", () => ({
  useNodes: () => mockNodes,
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}));

// Also mock the layout constants
vi.mock("../../hooks/useTreeLayout", () => ({
  NODE_WIDTH: 160,
  NODE_HEIGHT: 80,
}));

const pattern: DecryptedPattern = {
  id: "pat1",
  name: "Test Pattern",
  description: "",
  color: "#818cf8",
  linked_entities: [],
  person_ids: ["p1", "p2"],
};

describe("PatternConnectors", () => {
  it("returns null when no patterns are visible", () => {
    const patterns = new Map<string, DecryptedPattern>([[pattern.id, pattern]]);
    const { container } = render(
      <PatternConnectors patterns={patterns} visiblePatternIds={new Set()} />,
    );
    expect(container.querySelector('[data-testid="pattern-connectors"]')).toBeNull();
  });

  it("renders SVG areas for visible patterns", () => {
    const patterns = new Map<string, DecryptedPattern>([[pattern.id, pattern]]);
    render(<PatternConnectors patterns={patterns} visiblePatternIds={new Set(["pat1"])} />);
    expect(screen.getByTestId("pattern-connectors")).toBeInTheDocument();
    const area = document.querySelector('[data-testid="pattern-area"]');
    expect(area).not.toBeNull();
    const path = area!.querySelector("path");
    expect(path).not.toBeNull();
  });

  it("does not render areas for hidden patterns", () => {
    const patterns = new Map<string, DecryptedPattern>([[pattern.id, pattern]]);
    const { container } = render(
      <PatternConnectors patterns={patterns} visiblePatternIds={new Set(["other-id"])} />,
    );
    expect(container.querySelector('[data-testid="pattern-connectors"]')).toBeNull();
  });

  it("areas have correct fill color", () => {
    const patterns = new Map<string, DecryptedPattern>([[pattern.id, pattern]]);
    render(<PatternConnectors patterns={patterns} visiblePatternIds={new Set(["pat1"])} />);
    const path = document.querySelector('[data-testid="pattern-area"] path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute("fill")).toBe("#818cf8");
    expect(path!.getAttribute("stroke")).toBe("#818cf8");
  });

  it("clicking an area calls onPatternClick", () => {
    const patterns = new Map<string, DecryptedPattern>([[pattern.id, pattern]]);
    const handleClick = vi.fn();
    render(
      <PatternConnectors
        patterns={patterns}
        visiblePatternIds={new Set(["pat1"])}
        onPatternClick={handleClick}
      />,
    );
    const area = document.querySelector('[data-testid="pattern-area"]');
    expect(area).not.toBeNull();
    fireEvent.click(area!);
    expect(handleClick).toHaveBeenCalledWith("pat1");
  });

  it("shows pattern name text element", () => {
    const patterns = new Map<string, DecryptedPattern>([[pattern.id, pattern]]);
    render(<PatternConnectors patterns={patterns} visiblePatternIds={new Set(["pat1"])} />);
    const text = document.querySelector('[data-testid="pattern-area"] text');
    expect(text).not.toBeNull();
    expect(text!.textContent).toBe("Test Pattern");
  });

  it("increases opacity on hover", () => {
    const patterns = new Map<string, DecryptedPattern>([[pattern.id, pattern]]);
    render(<PatternConnectors patterns={patterns} visiblePatternIds={new Set(["pat1"])} />);
    const area = document.querySelector('[data-testid="pattern-area"]')!;
    const path = area.querySelector("path")!;

    expect(path.getAttribute("fill-opacity")).toBe("0.08");
    fireEvent.mouseEnter(area);
    expect(path.getAttribute("fill-opacity")).toBe("0.18");
    fireEvent.mouseLeave(area);
    expect(path.getAttribute("fill-opacity")).toBe("0.08");
  });

  it("renders with a single person (no MST edges needed)", () => {
    const singlePattern: DecryptedPattern = {
      id: "pat-single",
      name: "Single",
      description: "",
      color: "#f472b6",
      linked_entities: [],
      person_ids: ["p1"],
    };
    const patterns = new Map<string, DecryptedPattern>([[singlePattern.id, singlePattern]]);
    render(<PatternConnectors patterns={patterns} visiblePatternIds={new Set(["pat-single"])} />);
    expect(screen.getByTestId("pattern-connectors")).toBeInTheDocument();
    const path = document.querySelector('[data-testid="pattern-area"] path');
    expect(path).not.toBeNull();
  });

  it("renders contours for a complex multi-node layout", () => {
    // L-shaped layout to exercise more marching-squares cases (saddle points)
    mockNodes = [
      { id: "p1", position: { x: 0, y: 0 }, data: {} },
      { id: "p2", position: { x: 200, y: 0 }, data: {} },
      { id: "p3", position: { x: 0, y: 200 }, data: {} },
      { id: "p4", position: { x: 400, y: 200 }, data: {} },
    ];
    const complexPattern: DecryptedPattern = {
      id: "pat-complex",
      name: "Complex",
      description: "",
      color: "#34d399",
      linked_entities: [],
      person_ids: ["p1", "p2", "p3", "p4"],
    };
    const patterns = new Map<string, DecryptedPattern>([[complexPattern.id, complexPattern]]);
    render(<PatternConnectors patterns={patterns} visiblePatternIds={new Set(["pat-complex"])} />);
    expect(screen.getByTestId("pattern-connectors")).toBeInTheDocument();
    const path = document.querySelector('[data-testid="pattern-area"] path');
    expect(path).not.toBeNull();
    // Restore default mock nodes
    mockNodes = [
      { id: "p1", position: { x: 0, y: 0 }, data: {} },
      { id: "p2", position: { x: 200, y: 0 }, data: {} },
    ];
  });

  it("handles duplicate person_ids gracefully", () => {
    const dupPattern: DecryptedPattern = {
      id: "pat-dup",
      name: "Dup",
      description: "",
      color: "#38bdf8",
      linked_entities: [],
      person_ids: ["p1", "p1", "p2"],
    };
    const patterns = new Map<string, DecryptedPattern>([[dupPattern.id, dupPattern]]);
    render(<PatternConnectors patterns={patterns} visiblePatternIds={new Set(["pat-dup"])} />);
    expect(screen.getByTestId("pattern-connectors")).toBeInTheDocument();
  });

  it("skips patterns with no matching nodes", () => {
    const noNodePattern: DecryptedPattern = {
      id: "pat-gone",
      name: "Gone",
      description: "",
      color: "#fb923c",
      linked_entities: [],
      person_ids: ["nonexistent"],
    };
    const patterns = new Map<string, DecryptedPattern>([[noNodePattern.id, noNodePattern]]);
    const { container } = render(
      <PatternConnectors patterns={patterns} visiblePatternIds={new Set(["pat-gone"])} />,
    );
    expect(container.querySelector('[data-testid="pattern-connectors"]')).toBeNull();
  });
});

describe("emitCellSegments", () => {
  const top = { x: 5, y: 0 };
  const right = { x: 10, y: 5 };
  const bottom = { x: 5, y: 10 };
  const left = { x: 0, y: 5 };

  it("case 5 (saddle) emits two segments", () => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    emitCellSegments(5, top, right, bottom, left, out);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ x1: left.x, y1: left.y, x2: top.x, y2: top.y });
    expect(out[1]).toEqual({ x1: bottom.x, y1: bottom.y, x2: right.x, y2: right.y });
  });

  it("case 10 (saddle) emits two segments", () => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    emitCellSegments(10, top, right, bottom, left, out);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ x1: top.x, y1: top.y, x2: right.x, y2: right.y });
    expect(out[1]).toEqual({ x1: left.x, y1: left.y, x2: bottom.x, y2: bottom.y });
  });

  it("case 0 and 15 emit nothing", () => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    emitCellSegments(0, top, right, bottom, left, out);
    emitCellSegments(15, top, right, bottom, left, out);
    expect(out).toHaveLength(0);
  });
});
