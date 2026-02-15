import { describe, expect, it } from "vitest";
import type { DecryptedRelationship } from "../../hooks/useTreeData";
import type { RelationshipEdgeData } from "../../hooks/useTreeLayout";
import { RelationshipType } from "../../types/domain";
import {
  buildCurvedForkPath,
  buildForkPath,
  buildForkSelector,
  buildStraightForkPath,
  computeEdgeFlags,
  computeTooltipContent,
  type ForkPositions,
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
