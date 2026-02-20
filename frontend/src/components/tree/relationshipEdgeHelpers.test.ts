import { Position } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import type { DecryptedRelationship } from "../../hooks/useTreeData";
import type { RelationshipEdgeData } from "../../hooks/useTreeLayout";
import { RelationshipType } from "../../types/domain";
import {
  buildCurvedForkPath,
  buildForkPath,
  buildForkSelector,
  buildStraightForkPath,
  computeEdgeFlags,
  computeEdgePath,
  computeEdgeStroke,
  computeTooltipContent,
  type ForkPositions,
  getCssVar,
} from "./relationshipEdgeHelpers";

// ---- buildCurvedForkPath ----

describe("buildCurvedForkPath", () => {
  const baseFork: ForkPositions = {
    parents: [
      { cx: 100, bottom: 80 },
      { cx: 300, bottom: 80 },
    ],
    children: [{ cx: 200, top: 200 }],
    barY: 130,
  };

  it("returns a non-empty path string", () => {
    const path = buildCurvedForkPath(baseFork);
    expect(path.length).toBeGreaterThan(0);
    expect(path).toContain("M ");
  });

  it("includes Q curves for rounded corners", () => {
    const path = buildCurvedForkPath(baseFork);
    expect(path).toContain("Q ");
  });

  it("extends bar when child falls outside parent range", () => {
    const fork: ForkPositions = {
      parents: [
        { cx: 200, bottom: 80 },
        { cx: 300, bottom: 80 },
      ],
      children: [{ cx: 100, top: 200 }],
      barY: 130,
    };
    const path = buildCurvedForkPath(fork);
    // The bar extension starts at barLeft < lp.cx
    expect(path).toContain("L 200,130");
  });
});

// ---- buildStraightForkPath ----

describe("buildStraightForkPath", () => {
  const baseFork: ForkPositions = {
    parents: [
      { cx: 100, bottom: 80 },
      { cx: 300, bottom: 80 },
    ],
    children: [{ cx: 200, top: 200 }],
    barY: 130,
  };

  it("returns a path with only M and L commands", () => {
    const path = buildStraightForkPath(baseFork);
    expect(path).not.toContain("Q ");
    expect(path).toContain("M ");
    expect(path).toContain("L ");
  });

  it("draws parent drops, horizontal bar, and child drops", () => {
    const path = buildStraightForkPath(baseFork);
    // Parent drops
    expect(path).toContain("M 100,80 L 100,130");
    expect(path).toContain("M 300,80 L 300,130");
    // Horizontal bar
    expect(path).toContain("M 100,130 L 300,130");
    // Child drop
    expect(path).toContain("M 200,130 L 200,200");
  });
});

// ---- buildForkPath ----

describe("buildForkPath", () => {
  const baseFork: ForkPositions = {
    parents: [
      { cx: 100, bottom: 80 },
      { cx: 300, bottom: 80 },
    ],
    children: [{ cx: 200, top: 200 }],
    barY: 130,
  };

  it("defaults to curved style", () => {
    const path = buildForkPath(baseFork);
    expect(path).toContain("Q ");
  });

  it("uses straight style when specified", () => {
    const path = buildForkPath(baseFork, "straight");
    expect(path).not.toContain("Q ");
  });

  it("uses straight style for elbows", () => {
    const path = buildForkPath(baseFork, "elbows");
    expect(path).not.toContain("Q ");
  });
});

// ---- computeEdgeFlags ----

describe("computeEdgeFlags", () => {
  function makeData(overrides: Partial<RelationshipEdgeData> = {}): RelationshipEdgeData {
    return { ...overrides };
  }

  function makeRel(
    type: RelationshipType,
    periods: DecryptedRelationship["periods"] = [],
  ): DecryptedRelationship {
    return {
      id: "r1",
      type,
      source_person_id: "a",
      target_person_id: "b",
      periods,
      active_period: null,
    };
  }

  it("identifies partner", () => {
    const flags = computeEdgeFlags(makeData({ relationship: makeRel(RelationshipType.Partner) }));
    expect(flags.isPartner).toBe(true);
    expect(flags.isExPartner).toBe(false);
  });

  it("identifies ex-partner when all periods have end_year", () => {
    const flags = computeEdgeFlags(
      makeData({
        relationship: makeRel(RelationshipType.Partner, [
          { start_year: 2000, end_year: 2010, status: "divorced" as never },
        ]),
      }),
    );
    expect(flags.isPartner).toBe(true);
    expect(flags.isExPartner).toBe(true);
  });

  it("identifies friend", () => {
    const flags = computeEdgeFlags(makeData({ relationship: makeRel(RelationshipType.Friend) }));
    expect(flags.isFriend).toBe(true);
  });

  it("identifies dashed types", () => {
    for (const type of [
      RelationshipType.StepParent,
      RelationshipType.AdoptiveParent,
      RelationshipType.StepSibling,
    ]) {
      const flags = computeEdgeFlags(makeData({ relationship: makeRel(type) }));
      expect(flags.isDashed).toBe(true);
    }
  });

  it("renders co-parent with solid line (not dashed)", () => {
    const flags = computeEdgeFlags(makeData({ relationship: makeRel(RelationshipType.CoParent) }));
    expect(flags.isDashed).toBe(false);
    expect(flags.isPartner).toBe(false);
    expect(flags.isFriend).toBe(false);
  });

  it("identifies half-sibling", () => {
    const flags = computeEdgeFlags(
      makeData({ relationship: makeRel(RelationshipType.HalfSibling) }),
    );
    expect(flags.isHalfSibling).toBe(true);
  });
});

// ---- computeTooltipContent ----

describe("computeTooltipContent", () => {
  const mockT = (key: string) => key;

  it("returns typeLabel from relType", () => {
    const result = computeTooltipContent(
      undefined,
      RelationshipType.BiologicalParent,
      undefined,
      { isPartner: false, isExPartner: false },
      mockT,
    );
    expect(result.typeLabel).toBe("relationship.type.biological_parent");
  });

  it("returns typeLabel from inferredType when no relType", () => {
    const result = computeTooltipContent(
      undefined,
      undefined,
      "half_sibling",
      { isPartner: false, isExPartner: false },
      mockT,
    );
    expect(result.typeLabel).toBe("relationship.type.half_sibling");
  });

  it("returns exPartner label when isExPartner", () => {
    const result = computeTooltipContent(
      undefined,
      RelationshipType.Partner,
      undefined,
      { isPartner: true, isExPartner: true },
      mockT,
    );
    expect(result.typeLabel).toBe("relationship.type.exPartner");
  });

  it("returns periodLine for partner with periods", () => {
    const rel: DecryptedRelationship = {
      id: "r1",
      type: RelationshipType.Partner,
      source_person_id: "a",
      target_person_id: "b",
      periods: [{ start_year: 2000, end_year: 2010, status: "married" as never }],
      active_period: null,
    };
    const result = computeTooltipContent(
      rel,
      RelationshipType.Partner,
      undefined,
      { isPartner: true, isExPartner: false },
      mockT,
    );
    expect(result.periodLine).toContain("2000");
    expect(result.periodLine).toContain("2010");
  });

  it("returns no periodLine for non-partner", () => {
    const result = computeTooltipContent(
      undefined,
      RelationshipType.BiologicalParent,
      undefined,
      { isPartner: false, isExPartner: false },
      mockT,
    );
    expect(result.periodLine).toBeUndefined();
  });
});

// ---- buildForkSelector ----

describe("buildForkSelector", () => {
  it("returns null when parentIds undefined", () => {
    const selector = buildForkSelector(undefined, ["c1"]);
    const result = selector({ nodeLookup: new Map() });
    expect(result).toBeNull();
  });

  it("returns null when childIds undefined", () => {
    const selector = buildForkSelector(["p1", "p2"], undefined);
    const result = selector({ nodeLookup: new Map() });
    expect(result).toBeNull();
  });

  it("returns null when parent not found in lookup", () => {
    const selector = buildForkSelector(["p1", "p2"], ["c1"]);
    const lookup = new Map([
      ["p1", { position: { x: 0, y: 0 } }],
      ["c1", { position: { x: 100, y: 200 } }],
    ]);
    const result = selector({ nodeLookup: lookup });
    expect(result).toBeNull();
  });

  it("returns positions when all nodes found", () => {
    const selector = buildForkSelector(["p1", "p2"], ["c1"]);
    const lookup = new Map([
      ["p1", { position: { x: 0, y: 0 } }],
      ["p2", { position: { x: 200, y: 0 } }],
      ["c1", { position: { x: 100, y: 200 } }],
    ]);
    const result = selector({ nodeLookup: lookup });
    expect(result).not.toBeNull();
    expect(result!.parents).toHaveLength(2);
    expect(result!.children).toHaveLength(1);
    expect(result!.barY).toBeGreaterThan(0);
  });

  it("skips missing children gracefully", () => {
    const selector = buildForkSelector(["p1", "p2"], ["c1", "c2"]);
    const lookup = new Map([
      ["p1", { position: { x: 0, y: 0 } }],
      ["p2", { position: { x: 200, y: 0 } }],
      ["c1", { position: { x: 100, y: 200 } }],
    ]);
    const result = selector({ nodeLookup: lookup });
    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(1);
  });
});

// ---- getCssVar ----

describe("getCssVar", () => {
  let spy: MockInstance;

  beforeEach(() => {
    spy = vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "  #abc123  ",
    } as unknown as CSSStyleDeclaration);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("returns the trimmed CSS variable value", () => {
    const result = getCssVar("--color-edge-default");
    expect(result).toBe("#abc123");
    expect(spy).toHaveBeenCalledWith(document.documentElement);
  });
});

// ---- computeEdgeStroke ----

describe("computeEdgeStroke", () => {
  let spy: MockInstance;

  const cssValues: Record<string, string> = {
    "--color-edge-default": "#default",
    "--color-edge-half-sibling": "#half",
    "--color-edge-partner": "#partner",
    "--color-edge-friend": "#friend",
    "--color-edge-step": "#step",
  };

  beforeEach(() => {
    spy = vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) => cssValues[name] ?? "",
    } as unknown as CSSStyleDeclaration);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  const baseFlags = {
    isPartner: false,
    isExPartner: false,
    isHalfSibling: false,
    isFriend: false,
    isDashed: false,
  };

  it("returns default stroke when no flags are set", () => {
    const result = computeEdgeStroke(baseFlags, undefined, undefined);
    expect(result.stroke).toBe("#default");
    expect(result.strokeWidth).toBe(1.5);
    expect(result.strokeDasharray).toBeUndefined();
  });

  it("returns half-sibling style when isHalfSibling flag is set", () => {
    const result = computeEdgeStroke({ ...baseFlags, isHalfSibling: true }, undefined, undefined);
    expect(result.stroke).toBe("#half");
    expect(result.strokeDasharray).toBe("4 4");
  });

  it("returns half-sibling style when inferredType is half_sibling", () => {
    const result = computeEdgeStroke(baseFlags, "half_sibling", undefined);
    expect(result.stroke).toBe("#half");
    expect(result.strokeDasharray).toBe("4 4");
  });

  it("returns full_sibling style with dashed default stroke", () => {
    const result = computeEdgeStroke(baseFlags, "full_sibling", undefined);
    expect(result.stroke).toBe("#default");
    expect(result.strokeDasharray).toBe("4 4");
  });

  it("returns ex-partner style", () => {
    const result = computeEdgeStroke({ ...baseFlags, isExPartner: true }, undefined, undefined);
    expect(result.stroke).toBe("#partner");
    expect(result.strokeDasharray).toBe("6 3");
  });

  it("returns partner style with thicker stroke", () => {
    const result = computeEdgeStroke({ ...baseFlags, isPartner: true }, undefined, undefined);
    expect(result.stroke).toBe("#partner");
    expect(result.strokeWidth).toBe(2.5);
    expect(result.strokeDasharray).toBeUndefined();
  });

  it("returns friend style", () => {
    const result = computeEdgeStroke({ ...baseFlags, isFriend: true }, undefined, undefined);
    expect(result.stroke).toBe("#friend");
    expect(result.strokeDasharray).toBe("2 4");
  });

  it("returns step/dashed style", () => {
    const result = computeEdgeStroke({ ...baseFlags, isDashed: true }, undefined, undefined);
    expect(result.stroke).toBe("#step");
    expect(result.strokeDasharray).toBe("6 3");
  });

  it("overrides stroke with coupleColor when provided", () => {
    const result = computeEdgeStroke(
      { ...baseFlags, isPartner: true },
      undefined,
      "hsl(210, 60%, 55%)",
    );
    expect(result.stroke).toBe("hsl(210, 60%, 55%)");
    expect(result.strokeWidth).toBe(2.5);
  });

  it("prioritizes half-sibling over partner", () => {
    const result = computeEdgeStroke(
      { ...baseFlags, isHalfSibling: true, isPartner: true },
      undefined,
      undefined,
    );
    expect(result.stroke).toBe("#half");
    expect(result.strokeDasharray).toBe("4 4");
  });
});

// ---- computeEdgePath ----

describe("computeEdgePath", () => {
  const baseForkPositions: ForkPositions = {
    parents: [
      { cx: 100, bottom: 80 },
      { cx: 300, bottom: 80 },
    ],
    children: [{ cx: 200, top: 200 }],
    barY: 130,
  };

  it("returns fork path when isForkPrimary with forkPositions", () => {
    const result = computeEdgePath({
      isForkPrimary: true,
      isForkHidden: false,
      forkPositions: baseForkPositions,
      sx: 0,
      sy: 0,
      tx: 100,
      ty: 200,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
    expect(result.edgePath).toContain("M ");
    expect(result.edgePath).toBe(result.hitPath);
    expect(result.labelX).toBe(200); // midpoint of 100 and 300
    expect(result.labelY).toBe(130); // barY
  });

  it("returns fork path with specified edgeStyle", () => {
    const result = computeEdgePath({
      isForkPrimary: true,
      isForkHidden: false,
      forkPositions: baseForkPositions,
      sx: 0,
      sy: 0,
      tx: 100,
      ty: 200,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      edgeStyle: "straight",
    });
    // straight fork should not contain Q curves
    expect(result.edgePath).not.toContain("Q ");
  });

  it("returns hidden fork path when isForkHidden", () => {
    const result = computeEdgePath({
      isForkPrimary: false,
      isForkHidden: true,
      forkPositions: null,
      sx: 50,
      sy: 80,
      tx: 200,
      ty: 300,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
    const barY = 80 + 50; // sy + BAR_Y_OFFSET
    expect(result.edgePath).toBe(`M 50,80 L 50,${barY} L 200,${barY} L 200,300`);
    expect(result.hitPath).toBe(result.edgePath);
    expect(result.labelX).toBe(125); // (50 + 200) / 2
    expect(result.labelY).toBe(barY);
  });

  it("returns bezier path for curved edgeStyle (default)", () => {
    const result = computeEdgePath({
      isForkPrimary: false,
      isForkHidden: false,
      forkPositions: null,
      sx: 0,
      sy: 0,
      tx: 100,
      ty: 200,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
    // Should return a valid path
    expect(result.edgePath.length).toBeGreaterThan(0);
    expect(result.hitPath).toBe(result.edgePath);
    expect(typeof result.labelX).toBe("number");
    expect(typeof result.labelY).toBe("number");
  });

  it("returns straight path for straight edgeStyle", () => {
    const result = computeEdgePath({
      isForkPrimary: false,
      isForkHidden: false,
      forkPositions: null,
      sx: 0,
      sy: 0,
      tx: 100,
      ty: 200,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      edgeStyle: "straight",
    });
    expect(result.edgePath.length).toBeGreaterThan(0);
    expect(result.hitPath).toBe(result.edgePath);
  });

  it("returns smooth step path for elbows edgeStyle", () => {
    const result = computeEdgePath({
      isForkPrimary: false,
      isForkHidden: false,
      forkPositions: null,
      sx: 0,
      sy: 0,
      tx: 100,
      ty: 200,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      edgeStyle: "elbows",
    });
    expect(result.edgePath.length).toBeGreaterThan(0);
    expect(result.hitPath).toBe(result.edgePath);
  });

  it("returns bezier path when edgeStyle is explicitly curved", () => {
    const result = computeEdgePath({
      isForkPrimary: false,
      isForkHidden: false,
      forkPositions: null,
      sx: 10,
      sy: 20,
      tx: 300,
      ty: 400,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      edgeStyle: "curved",
    });
    expect(result.edgePath.length).toBeGreaterThan(0);
  });
});

// ---- buildCurvedForkPath: barRight extension ----

describe("buildCurvedForkPath bar extensions", () => {
  it("extends bar to the right when child falls beyond right parent", () => {
    const fork: ForkPositions = {
      parents: [
        { cx: 100, bottom: 80 },
        { cx: 200, bottom: 80 },
      ],
      children: [{ cx: 350, top: 200 }],
      barY: 130,
    };
    const path = buildCurvedForkPath(fork);
    // barRight > rp.cx should add extension from rp.cx to barRight
    expect(path).toContain(`M 200,130`);
  });

  it("handles child directly below a parent (nearParent case)", () => {
    const fork: ForkPositions = {
      parents: [
        { cx: 100, bottom: 80 },
        { cx: 300, bottom: 80 },
      ],
      // Child cx is within R=16 of left parent cx=100
      children: [{ cx: 105, top: 200 }],
      barY: 130,
    };
    const path = buildCurvedForkPath(fork);
    // nearParent=true -> dir=0 -> straight drop, no Q curve for this child
    expect(path).toContain(`M 105,130 L 105,200`);
  });
});
