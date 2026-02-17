import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import { PatternConnectors } from "./PatternConnectors";

// Mock @xyflow/react
const mockNodes = [
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
});
