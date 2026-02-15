import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, type Mock, vi } from "vitest";
import { RelationshipType } from "../../types/domain";
import { RelationshipEdge } from "./RelationshipEdge";

vi.mock("./RelationshipEdge.css", () => ({}));

const mockUseStore = vi.fn().mockReturnValue(null);

vi.mock("@xyflow/react", () => ({
  BaseEdge: (props: Record<string, unknown>) => (
    <path data-testid="base-edge" d={props.path as string} />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="edge-label-renderer">{children}</div>
  ),
  useStore: (...args: unknown[]) => mockUseStore(...args),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  getBezierPath: () => ["M 100,200 C 200,200 200,200 300,200", 200, 200],
  getSmoothStepPath: () => ["M 100,200 L 200,200 L 300,200", 200, 200],
  getStraightPath: () => ["M 100,200 L 300,200", 200, 200],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    id: "edge-1",
    source: "node-1",
    target: "node-2",
    sourceX: 100,
    sourceY: 200,
    targetX: 300,
    targetY: 200,
    sourcePosition: "bottom" as const,
    targetPosition: "top" as const,
    data: {
      relationship: { type: RelationshipType.BiologicalParent, periods: [] },
      inferredType: undefined,
      sourceName: "Alice",
      targetName: "Bob",
      edgeStyle: "curved" as const,
      sourceOffset: { x: 0, y: 0 },
      targetOffset: { x: 0, y: 0 },
    },
    ...overrides,
  };
}

describe("RelationshipEdge", () => {
  it("renders BaseEdge for normal (non-fork) edges", () => {
    const { container } = render(
      <svg>
        <RelationshipEdge {...(baseProps() as any)} />
      </svg>,
    );

    expect(screen.getByTestId("base-edge")).toBeInTheDocument();
    // Should not render a custom <path> with strokeLinecap (fork primary rendering)
    const paths = container.querySelectorAll("path[stroke-linecap='round']");
    expect(paths).toHaveLength(0);
  });

  it("renders hidden path when junctionHidden is true", () => {
    const props = baseProps({
      data: {
        ...baseProps().data,
        junctionHidden: true,
      },
    });

    const { container } = render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    // Should render an invisible path element
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(1);
    const hiddenPath = paths[0];
    expect(hiddenPath.getAttribute("d")).toBe("M 0,0");
    expect(hiddenPath.getAttribute("fill")).toBe("none");
    expect(hiddenPath.getAttribute("stroke")).toBe("none");

    // Should NOT render BaseEdge or EdgeLabelRenderer
    expect(screen.queryByTestId("base-edge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edge-label-renderer")).not.toBeInTheDocument();
  });

  it("renders custom path element when isForkPrimary is true", () => {
    const forkPositions = {
      parents: [
        { cx: 100, bottom: 280 },
        { cx: 300, bottom: 280 },
      ],
      children: [{ cx: 200, top: 400 }],
      barY: 330,
    };
    (mockUseStore as Mock).mockReturnValue(forkPositions);

    const props = baseProps({
      data: {
        ...baseProps().data,
        junctionFork: {
          parentIds: ["p1", "p2"] as [string, string],
          childIds: ["c1"],
          parentNames: ["Mom", "Dad"] as [string, string],
          childNames: ["Child"],
        },
      },
    });

    const { container } = render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    // Should NOT render BaseEdge
    expect(screen.queryByTestId("base-edge")).not.toBeInTheDocument();

    // Should render a custom path with strokeLinecap="round"
    const forkPath = container.querySelector("path[stroke-linecap='round']");
    expect(forkPath).toBeInTheDocument();
    expect(forkPath?.getAttribute("fill")).toBe("none");
    expect(forkPath?.getAttribute("stroke-linejoin")).toBe("round");
  });

  it("renders marker divs when markerShape is provided and not fork primary", () => {
    const props = baseProps({
      data: {
        ...baseProps().data,
        markerShape: "circle",
      },
    });

    render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    const renderer = screen.getByTestId("edge-label-renderer");
    expect(renderer).toBeInTheDocument();

    // Should have two marker divs (source + target)
    const markers = renderer.querySelectorAll(".edge-marker--circle");
    expect(markers).toHaveLength(2);
  });

  it("does not render marker divs for fork primary edges even with markerShape", () => {
    const forkPositions = {
      parents: [
        { cx: 100, bottom: 280 },
        { cx: 300, bottom: 280 },
      ],
      children: [{ cx: 200, top: 400 }],
      barY: 330,
    };
    (mockUseStore as Mock).mockReturnValue(forkPositions);

    const props = baseProps({
      data: {
        ...baseProps().data,
        markerShape: "circle",
        junctionFork: {
          parentIds: ["p1", "p2"] as [string, string],
          childIds: ["c1"],
          parentNames: ["Mom", "Dad"] as [string, string],
          childNames: ["Child"],
        },
      },
    });

    render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    // Fork primary: markers should NOT be rendered
    const markers = document.querySelectorAll(".edge-marker--circle");
    expect(markers).toHaveLength(0);
  });

  it("shows tooltip on mouseenter of hit area and hides on mouseleave", () => {
    const props = baseProps();

    const { container } = render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    // Tooltip should NOT be visible initially
    expect(document.querySelector(".edge-tooltip")).not.toBeInTheDocument();

    // Find the hit area path (transparent stroke, strokeWidth=20)
    const hitArea = container.querySelector('path[stroke="transparent"]');
    expect(hitArea).toBeInTheDocument();

    // Hover to show tooltip
    fireEvent.mouseEnter(hitArea!);
    const tooltip = document.querySelector(".edge-tooltip");
    expect(tooltip).toBeInTheDocument();

    // Type label should be present
    const typeLabel = tooltip!.querySelector(".edge-tooltip__type");
    expect(typeLabel).toBeInTheDocument();
    expect(typeLabel!.textContent).toBe("relationship.type.biological_parent");

    // Leave to hide tooltip
    fireEvent.mouseLeave(hitArea!);
    expect(document.querySelector(".edge-tooltip")).not.toBeInTheDocument();
  });

  it("renders fork tooltip with parent & child names when isForkPrimary and hovered", () => {
    const forkPositions = {
      parents: [
        { cx: 100, bottom: 280 },
        { cx: 300, bottom: 280 },
      ],
      children: [{ cx: 200, top: 400 }],
      barY: 330,
    };
    (mockUseStore as Mock).mockReturnValue(forkPositions);

    const props = baseProps({
      data: {
        ...baseProps().data,
        junctionFork: {
          parentIds: ["p1", "p2"] as [string, string],
          childIds: ["c1"],
          parentNames: ["Mom", "Dad"] as [string, string],
          childNames: ["Alice", "Bob"],
        },
      },
    });

    const { container } = render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    // Hover the hit area
    const hitArea = container.querySelector('path[stroke="transparent"]');
    expect(hitArea).toBeInTheDocument();
    fireEvent.mouseEnter(hitArea!);

    const tooltip = document.querySelector(".edge-tooltip");
    expect(tooltip).toBeInTheDocument();

    const namesEl = tooltip!.querySelector(".edge-tooltip__names");
    expect(namesEl).toBeInTheDocument();
    // Should contain parent names joined by " & " and child names joined by ", "
    // with an arrow character between them
    expect(namesEl!.textContent).toContain("Mom & Dad");
    expect(namesEl!.textContent).toContain("Alice, Bob");
  });

  it("renders normal tooltip with source/target names when not fork primary and hovered", () => {
    const props = baseProps({
      data: {
        ...baseProps().data,
        sourceName: "Charlie",
        targetName: "Diana",
      },
    });

    const { container } = render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    // Hover the hit area
    const hitArea = container.querySelector('path[stroke="transparent"]');
    fireEvent.mouseEnter(hitArea!);

    const tooltip = document.querySelector(".edge-tooltip");
    expect(tooltip).toBeInTheDocument();

    const namesEl = tooltip!.querySelector(".edge-tooltip__names");
    expect(namesEl).toBeInTheDocument();
    // Normal edge shows "sourceName -- targetName" with an mdash entity
    expect(namesEl!.textContent).toContain("Charlie");
    expect(namesEl!.textContent).toContain("Diana");
  });

  it("renders tooltip with period line for active partner relationships", () => {
    const props = baseProps({
      data: {
        ...baseProps().data,
        relationship: {
          type: RelationshipType.Partner,
          periods: [{ start_year: 2000, end_year: null, status: "married" }],
        },
      },
    });

    const { container } = render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    const hitArea = container.querySelector('path[stroke="transparent"]');
    fireEvent.mouseEnter(hitArea!);

    const tooltip = document.querySelector(".edge-tooltip");
    expect(tooltip).toBeInTheDocument();

    const periodEl = tooltip!.querySelector(".edge-tooltip__period");
    expect(periodEl).toBeInTheDocument();
    expect(periodEl!.textContent).toContain("2000");
  });

  it("does not render tooltip when no typeLabel is available", () => {
    const props = baseProps({
      data: {
        ...baseProps().data,
        relationship: undefined,
        inferredType: undefined,
      },
    });

    const { container } = render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    const hitArea = container.querySelector('path[stroke="transparent"]');
    fireEvent.mouseEnter(hitArea!);

    // No tooltip should appear since there's no type label
    expect(document.querySelector(".edge-tooltip")).not.toBeInTheDocument();
  });

  it("renders diamond marker with clip-path", () => {
    const props = baseProps({
      data: {
        ...baseProps().data,
        markerShape: "diamond",
      },
    });

    render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    const renderer = screen.getByTestId("edge-label-renderer");
    const markers = renderer.querySelectorAll(".edge-marker--diamond");
    expect(markers).toHaveLength(2);
    // Diamond markers should have clip-path set
    for (const marker of markers) {
      expect((marker as HTMLElement).style.clipPath).toBe(
        "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
      );
    }
  });

  it("applies source and target offsets to positions", () => {
    const props = baseProps({
      data: {
        ...baseProps().data,
        markerShape: "square",
        sourceOffset: { x: 10, y: 20 },
        targetOffset: { x: -10, y: -20 },
      },
    });

    render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    const renderer = screen.getByTestId("edge-label-renderer");
    const markers = renderer.querySelectorAll(".edge-marker--square");
    expect(markers).toHaveLength(2);

    // Source marker should be at sourceX + sourceOffset.x, sourceY + sourceOffset.y
    const sourceMarker = markers[0] as HTMLElement;
    expect(sourceMarker.style.transform).toContain("110px");
    expect(sourceMarker.style.transform).toContain("220px");

    // Target marker should be at targetX + targetOffset.x, targetY + targetOffset.y
    const targetMarker = markers[1] as HTMLElement;
    expect(targetMarker.style.transform).toContain("290px");
    expect(targetMarker.style.transform).toContain("180px");
  });

  it("renders question marks for missing source/target names in tooltip", () => {
    const props = baseProps({
      data: {
        ...baseProps().data,
        sourceName: undefined,
        targetName: undefined,
      },
    });

    const { container } = render(
      <svg>
        <RelationshipEdge {...(props as any)} />
      </svg>,
    );

    const hitArea = container.querySelector('path[stroke="transparent"]');
    fireEvent.mouseEnter(hitArea!);

    const tooltip = document.querySelector(".edge-tooltip");
    expect(tooltip).toBeInTheDocument();

    const namesEl = tooltip!.querySelector(".edge-tooltip__names");
    // Should show "?" for missing names
    expect(namesEl!.textContent).toContain("?");
  });
});
