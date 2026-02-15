import * as dagre from "dagre";
import { describe, expect, it } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../hooks/useTreeData";
import { LifeEventCategory, RelationshipType, TraumaCategory } from "../types/domain";
import {
  adjustEdgeOverlaps,
  assignMarkerShapes,
  buildBioParentData,
  buildEntityLookups,
  buildJunctionForks,
  buildPersonNodes,
  buildRelationshipEdges,
  computeCoupleColors,
  computeFriendY,
  findFriendOnlyIds,
  findMaxFamilyX,
  groupEdgesBySide,
  handleSide,
  layoutDagreGraph,
  MARKER_SHAPES,
  NODE_HEIGHT,
  NODE_WIDTH,
  pickHandles,
  positionFriendNodes,
  type RelationshipEdgeType,
  resolveNodePosition,
} from "./treeLayoutHelpers";

function makePerson(
  id: string,
  name: string,
  position?: { x: number; y: number },
): DecryptedPerson {
  return {
    id,
    name,
    birth_year: 1980,
    death_year: null,
    gender: "female",
    is_adopted: false,
    notes: null,
    position,
  };
}

function makeRel(
  id: string,
  type: RelationshipType,
  source: string,
  target: string,
): DecryptedRelationship {
  return {
    id,
    type,
    source_person_id: source,
    target_person_id: target,
    periods: [],
    active_period: null,
  };
}

// ---- pickHandles ----

describe("pickHandles", () => {
  it("returns bottom/top for vertical downward", () => {
    const result = pickHandles({ x: 0, y: 0 }, { x: 0, y: 100 }, true);
    expect(result.sourceHandle).toBe("bottom");
    expect(result.targetHandle).toBe("top");
  });

  it("returns top-source/bottom-target for vertical upward", () => {
    const result = pickHandles({ x: 0, y: 100 }, { x: 0, y: 0 }, true);
    expect(result.sourceHandle).toBe("top-source");
    expect(result.targetHandle).toBe("bottom-target");
  });

  it("returns right/left for horizontal rightward", () => {
    const result = pickHandles({ x: 0, y: 0 }, { x: 100, y: 0 }, false);
    expect(result.sourceHandle).toBe("right");
    expect(result.targetHandle).toBe("left");
  });

  it("returns left-source/right-target for horizontal leftward", () => {
    const result = pickHandles({ x: 100, y: 0 }, { x: 0, y: 0 }, false);
    expect(result.sourceHandle).toBe("left-source");
    expect(result.targetHandle).toBe("right-target");
  });
});

// ---- findFriendOnlyIds ----

describe("findFriendOnlyIds", () => {
  it("returns empty set when no relationships", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const result = findFriendOnlyIds(persons, new Map());
    expect(result.size).toBe(0);
  });

  it("identifies friend-only persons", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Alice")],
      ["p2", makePerson("p2", "Friend")],
    ]);
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Friend, "p1", "p2")]]);
    const result = findFriendOnlyIds(persons, rels);
    // Both p1 and p2 have no family edges, both are friend-only
    expect(result.has("p1")).toBe(true);
    expect(result.has("p2")).toBe(true);
  });

  it("does not flag persons with family edges", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Parent")],
      ["p2", makePerson("p2", "Child")],
      ["p3", makePerson("p3", "Friend")],
    ]);
    const rels = new Map([
      ["r1", makeRel("r1", RelationshipType.BiologicalParent, "p1", "p2")],
      ["r2", makeRel("r2", RelationshipType.Friend, "p1", "p3")],
    ]);
    const result = findFriendOnlyIds(persons, rels);
    expect(result.has("p1")).toBe(false); // has family edge
    expect(result.has("p2")).toBe(false); // has family edge
    expect(result.has("p3")).toBe(true); // friend-only
  });
});

// ---- buildBioParentData ----

describe("buildBioParentData", () => {
  it("returns empty maps for no relationships", () => {
    const result = buildBioParentData(new Map());
    expect(result.bioParentsOf.size).toBe(0);
    expect(result.coupleChildren.size).toBe(0);
  });

  it("tracks single parent (no couple formed)", () => {
    const rels = new Map([
      ["r1", makeRel("r1", RelationshipType.BiologicalParent, "parent1", "child1")],
    ]);
    const result = buildBioParentData(rels);
    expect(result.bioParentsOf.get("child1")?.size).toBe(1);
    expect(result.coupleChildren.size).toBe(0);
  });

  it("forms couple when child has two biological parents", () => {
    const rels = new Map([
      ["r1", makeRel("r1", RelationshipType.BiologicalParent, "mom", "child1")],
      ["r2", makeRel("r2", RelationshipType.BiologicalParent, "dad", "child1")],
    ]);
    const result = buildBioParentData(rels);
    expect(result.bioParentsOf.get("child1")?.size).toBe(2);
    expect(result.coupleChildren.size).toBe(1);
    const key = ["dad", "mom"].join("|"); // sorted
    expect(result.coupleChildren.get(key)).toContain("child1");
  });
});

// ---- layoutDagreGraph ----

describe("layoutDagreGraph", () => {
  it("handles empty persons", () => {
    const result = layoutDagreGraph(new Map(), new Map(), new Set());
    expect(result.graph.nodeCount()).toBe(0);
  });

  it("positions nodes in the graph", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Alice")],
      ["p2", makePerson("p2", "Bob")],
    ]);
    const rels = new Map([["r1", makeRel("r1", RelationshipType.BiologicalParent, "p1", "p2")]]);
    const result = layoutDagreGraph(persons, rels, new Set());
    const n1 = result.graph.node("p1");
    const n2 = result.graph.node("p2");
    expect(n1).toBeDefined();
    expect(n2).toBeDefined();
    // Parent should be above child (lower Y)
    expect(n1.y).toBeLessThan(n2.y);
  });

  it("aligns partners at same Y level", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Alice")],
      ["p2", makePerson("p2", "Bob")],
    ]);
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Partner, "p1", "p2")]]);
    const result = layoutDagreGraph(persons, rels, new Set());
    const n1 = result.graph.node("p1");
    const n2 = result.graph.node("p2");
    expect(n1.y).toBe(n2.y);
    expect(result.partnerPairs).toHaveLength(1);
  });
});

// ---- positionFriendNodes ----

describe("positionFriendNodes", () => {
  it("returns empty map when no friends", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const { graph } = layoutDagreGraph(persons, new Map(), new Set());
    const result = positionFriendNodes(persons, new Map(), new Set(), graph);
    expect(result.size).toBe(0);
  });

  it("positions friends to the right of family tree", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Alice")],
      ["p2", makePerson("p2", "Friend")],
    ]);
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Friend, "p1", "p2")]]);
    const friendOnlyIds = new Set(["p2"]);
    const { graph } = layoutDagreGraph(persons, rels, friendOnlyIds);
    const result = positionFriendNodes(persons, rels, friendOnlyIds, graph);
    expect(result.has("p2")).toBe(true);
    const familyNode = graph.node("p1");
    expect(result.get("p2")!.x).toBeGreaterThan(familyNode.x);
  });

  it("avoids Y overlap between friend nodes", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Alice")],
      ["f1", makePerson("f1", "Friend1")],
      ["f2", makePerson("f2", "Friend2")],
    ]);
    const rels = new Map([
      ["r1", makeRel("r1", RelationshipType.Friend, "p1", "f1")],
      ["r2", makeRel("r2", RelationshipType.Friend, "p1", "f2")],
    ]);
    const friendOnlyIds = new Set(["f1", "f2"]);
    const { graph } = layoutDagreGraph(persons, rels, friendOnlyIds);
    const result = positionFriendNodes(persons, rels, friendOnlyIds, graph);
    const positions = [...result.values()];
    expect(positions.length).toBe(2);
    expect(Math.abs(positions[0].y - positions[1].y)).toBeGreaterThanOrEqual(NODE_HEIGHT);
  });
});

// ---- buildEntityLookups ----

describe("buildEntityLookups", () => {
  it("returns empty lookups for no entities", () => {
    const result = buildEntityLookups(new Map());
    expect(result.eventsByPerson.size).toBe(0);
    expect(result.lifeEventsByPerson.size).toBe(0);
    expect(result.classificationsByPerson.size).toBe(0);
  });

  it("groups events by person", () => {
    const events = new Map<string, DecryptedEvent>([
      [
        "e1",
        {
          id: "e1",
          title: "Loss",
          description: "",
          category: TraumaCategory.Loss,
          approximate_date: "1990",
          severity: 3,
          tags: [],
          person_ids: ["p1"],
        },
      ],
      [
        "e2",
        {
          id: "e2",
          title: "War",
          description: "",
          category: TraumaCategory.War,
          approximate_date: "1945",
          severity: 5,
          tags: [],
          person_ids: ["p1", "p2"],
        },
      ],
    ]);
    const result = buildEntityLookups(events);
    expect(result.eventsByPerson.get("p1")?.length).toBe(2);
    expect(result.eventsByPerson.get("p2")?.length).toBe(1);
  });

  it("handles all three entity types", () => {
    const events = new Map<string, DecryptedEvent>([
      [
        "e1",
        {
          id: "e1",
          title: "T",
          description: "",
          category: TraumaCategory.Loss,
          approximate_date: "1990",
          severity: 1,
          tags: [],
          person_ids: ["p1"],
        },
      ],
    ]);
    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      [
        "le1",
        {
          id: "le1",
          title: "L",
          description: "",
          category: LifeEventCategory.Family,
          approximate_date: "1990",
          impact: 1,
          tags: [],
          person_ids: ["p1"],
        },
      ],
    ]);
    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        {
          id: "c1",
          dsm_category: "mood",
          dsm_subcategory: null,
          status: "diagnosed",
          diagnosis_year: 2020,
          periods: [],
          notes: null,
          person_ids: ["p1"],
        },
      ],
    ]);
    const result = buildEntityLookups(events, lifeEvents, classifications);
    expect(result.eventsByPerson.get("p1")?.length).toBe(1);
    expect(result.lifeEventsByPerson.get("p1")?.length).toBe(1);
    expect(result.classificationsByPerson.get("p1")?.length).toBe(1);
  });
});

// ---- buildPersonNodes ----

describe("buildPersonNodes", () => {
  it("creates nodes with correct structure", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const { graph } = layoutDagreGraph(persons, new Map(), new Set());
    const lookups = buildEntityLookups(new Map());
    const result = buildPersonNodes(persons, graph, new Set(), new Map(), lookups, null);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe("p1");
    expect(result.nodes[0].type).toBe("person");
    expect(result.nodes[0].width).toBe(NODE_WIDTH);
    expect(result.nodes[0].height).toBe(NODE_HEIGHT);
  });

  it("marks friend-only nodes", () => {
    const persons = new Map([["f1", makePerson("f1", "Friend")]]);
    const { graph } = layoutDagreGraph(new Map(), new Map(), new Set(["f1"]));
    const lookups = buildEntityLookups(new Map());
    const friendPositions = new Map([["f1", { x: 500, y: 100 }]]);
    const result = buildPersonNodes(
      persons,
      graph,
      new Set(["f1"]),
      friendPositions,
      lookups,
      null,
    );
    expect(result.nodes[0].data.isFriendOnly).toBe(true);
  });

  it("selects the selected person", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const { graph } = layoutDagreGraph(persons, new Map(), new Set());
    const lookups = buildEntityLookups(new Map());
    const result = buildPersonNodes(persons, graph, new Set(), new Map(), lookups, "p1");
    expect(result.nodes[0].selected).toBe(true);
  });

  it("uses pinned position when available", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice", { x: 42, y: 99 })]]);
    const { graph } = layoutDagreGraph(persons, new Map(), new Set());
    const lookups = buildEntityLookups(new Map());
    const result = buildPersonNodes(persons, graph, new Set(), new Map(), lookups, null);
    expect(result.nodes[0].position).toEqual({ x: 42, y: 99 });
  });

  it("populates nodeCenter map", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const { graph } = layoutDagreGraph(persons, new Map(), new Set());
    const lookups = buildEntityLookups(new Map());
    const result = buildPersonNodes(persons, graph, new Set(), new Map(), lookups, null);
    expect(result.nodeCenter.has("p1")).toBe(true);
    const center = result.nodeCenter.get("p1")!;
    expect(center.x).toBe(result.nodes[0].position.x + NODE_WIDTH / 2);
    expect(center.y).toBe(result.nodes[0].position.y + NODE_HEIGHT / 2);
  });
});

// ---- buildJunctionForks ----

describe("buildJunctionForks", () => {
  it("returns empty when no couples", () => {
    const result = buildJunctionForks(new Map(), new Map(), new Map(), new Map());
    expect(result.forkPrimaryIds.size).toBe(0);
    expect(result.forkHiddenIds.size).toBe(0);
  });

  it("assigns primary and hidden fork edges", () => {
    const coupleChildren = new Map([["dad|mom", ["child1"]]]);
    const nodeCenter = new Map([
      ["dad", { x: 0, y: 0 }],
      ["mom", { x: 200, y: 0 }],
      ["child1", { x: 100, y: 200 }],
    ]);
    const rels = new Map([
      ["r1", makeRel("r1", RelationshipType.BiologicalParent, "dad", "child1")],
      ["r2", makeRel("r2", RelationshipType.BiologicalParent, "mom", "child1")],
    ]);
    const persons = new Map([
      ["dad", makePerson("dad", "Dad")],
      ["mom", makePerson("mom", "Mom")],
      ["child1", makePerson("child1", "Child")],
    ]);
    const result = buildJunctionForks(coupleChildren, nodeCenter, rels, persons);
    expect(result.forkPrimaryIds.size).toBe(1);
    expect(result.forkHiddenIds.size).toBe(1);
    expect(result.forkDataByEdge.size).toBe(1);
  });

  it("skips couples where parent nodes are missing", () => {
    const coupleChildren = new Map([["dad|mom", ["child1"]]]);
    const nodeCenter = new Map([["child1", { x: 100, y: 200 }]]);
    const rels = new Map([
      ["r1", makeRel("r1", RelationshipType.BiologicalParent, "dad", "child1")],
    ]);
    const result = buildJunctionForks(coupleChildren, nodeCenter, rels, new Map());
    expect(result.forkPrimaryIds.size).toBe(0);
  });
});

// ---- computeCoupleColors ----

describe("computeCoupleColors", () => {
  it("returns empty for no bio parents", () => {
    const result = computeCoupleColors(new Map());
    expect(result.childCoupleColor.size).toBe(0);
    expect(result.useCoupleColors).toBe(false);
  });

  it("does not enable couple colors for single couple", () => {
    const bioParentsOf = new Map([["child1", new Set(["mom", "dad"])]]);
    const result = computeCoupleColors(bioParentsOf);
    expect(result.childCoupleColor.size).toBe(1);
    expect(result.useCoupleColors).toBe(false);
  });

  it("enables couple colors and assigns distinct colors for 2+ couples", () => {
    const bioParentsOf = new Map([
      ["child1", new Set(["mom1", "dad1"])],
      ["child2", new Set(["mom2", "dad2"])],
    ]);
    const result = computeCoupleColors(bioParentsOf);
    expect(result.useCoupleColors).toBe(true);
    const color1 = result.childCoupleColor.get("child1");
    const color2 = result.childCoupleColor.get("child2");
    expect(color1).toBeDefined();
    expect(color2).toBeDefined();
    expect(color1).not.toBe(color2);
  });
});

// ---- buildRelationshipEdges ----

describe("buildRelationshipEdges", () => {
  const emptyForkData = new Map() as BuildEdgesParamsType["forkDataByEdge"];
  type BuildEdgesParamsType = Parameters<typeof buildRelationshipEdges>[0];

  it("creates edge for parent relationship", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.BiologicalParent, "p1", "p2")]]);
    const persons = new Map([
      ["p1", makePerson("p1", "Parent")],
      ["p2", makePerson("p2", "Child")],
    ]);
    const nodeCenter = new Map([
      ["p1", { x: 90, y: 40 }],
      ["p2", { x: 90, y: 200 }],
    ]);
    const edges = buildRelationshipEdges({
      relationships: rels,
      persons,
      nodeCenter,
      childCoupleColor: new Map(),
      useCoupleColors: false,
      forkDataByEdge: emptyForkData,
      forkHiddenIds: new Set(),
      inferred: [],
      edgeStyle: "curved",
    });
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("p1");
    expect(edges[0].target).toBe("p2");
    expect(edges[0].data?.relationship?.type).toBe(RelationshipType.BiologicalParent);
  });

  it("creates edge for partner relationship", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Partner, "p1", "p2")]]);
    const persons = new Map([
      ["p1", makePerson("p1", "A")],
      ["p2", makePerson("p2", "B")],
    ]);
    const nodeCenter = new Map([
      ["p1", { x: 0, y: 0 }],
      ["p2", { x: 200, y: 0 }],
    ]);
    const edges = buildRelationshipEdges({
      relationships: rels,
      persons,
      nodeCenter,
      childCoupleColor: new Map(),
      useCoupleColors: false,
      forkDataByEdge: emptyForkData,
      forkHiddenIds: new Set(),
      inferred: [],
    });
    expect(edges).toHaveLength(1);
    expect(edges[0].data?.relationship?.type).toBe(RelationshipType.Partner);
  });

  it("creates inferred sibling edges", () => {
    const edges = buildRelationshipEdges({
      relationships: new Map(),
      persons: new Map([
        ["a", makePerson("a", "A")],
        ["b", makePerson("b", "B")],
      ]),
      nodeCenter: new Map([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 200, y: 0 }],
      ]),
      childCoupleColor: new Map(),
      useCoupleColors: false,
      forkDataByEdge: emptyForkData,
      forkHiddenIds: new Set(),
      inferred: [{ personAId: "a", personBId: "b", type: "half_sibling", sharedParentIds: ["p"] }],
    });
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe("inferred-a-b");
    expect(edges[0].data?.inferredType).toBe("half_sibling");
  });

  it("applies couple color to biological parent edge", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.BiologicalParent, "p1", "child")]]);
    const persons = new Map([
      ["p1", makePerson("p1", "P")],
      ["child", makePerson("child", "C")],
    ]);
    const nodeCenter = new Map([
      ["p1", { x: 90, y: 40 }],
      ["child", { x: 90, y: 200 }],
    ]);
    const edges = buildRelationshipEdges({
      relationships: rels,
      persons,
      nodeCenter,
      childCoupleColor: new Map([["child", "hsl(210, 60%, 55%)"]]),
      useCoupleColors: true,
      forkDataByEdge: emptyForkData,
      forkHiddenIds: new Set(),
      inferred: [],
    });
    expect(edges[0].data?.coupleColor).toBe("hsl(210, 60%, 55%)");
  });
});

// ---- adjustEdgeOverlaps ----

describe("adjustEdgeOverlaps", () => {
  function makeEdge(
    id: string,
    source: string,
    target: string,
    sourceHandle: string,
    targetHandle: string,
  ): RelationshipEdgeType {
    return {
      id,
      type: "relationship",
      source,
      target,
      sourceHandle,
      targetHandle,
      data: {},
    };
  }

  it("does nothing when edges do not overlap", () => {
    const edges = [makeEdge("e1", "a", "b", "bottom", "top")];
    const nodeCenter = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 0, y: 200 }],
    ]);
    adjustEdgeOverlaps(edges, nodeCenter, false);
    expect(edges[0].data?.sourceOffset).toBeUndefined();
    expect(edges[0].data?.targetOffset).toBeUndefined();
  });

  it("spreads offsets when edges share a handle side", () => {
    const edges = [
      makeEdge("e1", "a", "b", "bottom", "top"),
      makeEdge("e2", "a", "c", "bottom", "top"),
    ];
    const nodeCenter = new Map([
      ["a", { x: 100, y: 0 }],
      ["b", { x: 50, y: 200 }],
      ["c", { x: 150, y: 200 }],
    ]);
    adjustEdgeOverlaps(edges, nodeCenter, false);
    // Both edges share source "a" bottom handle -> should have offsets
    const offsets = edges.map((e) => e.data?.sourceOffset?.x ?? 0);
    expect(offsets[0]).not.toBe(offsets[1]);
  });

  it("assigns marker shapes when showMarkers is true", () => {
    const edges = [
      makeEdge("e1", "a", "b", "bottom", "top"),
      makeEdge("e2", "a", "c", "bottom", "top"),
    ];
    const nodeCenter = new Map([
      ["a", { x: 100, y: 0 }],
      ["b", { x: 50, y: 200 }],
      ["c", { x: 150, y: 200 }],
    ]);
    adjustEdgeOverlaps(edges, nodeCenter, true);
    const shapes = edges.map((e) => e.data?.markerShape);
    expect(shapes.every((s) => s !== undefined)).toBe(true);
    expect(MARKER_SHAPES).toContain(shapes[0]);
  });

  it("skips junction fork and junction hidden edges", () => {
    const edges: RelationshipEdgeType[] = [
      {
        id: "e1",
        type: "relationship",
        source: "a",
        target: "b",
        sourceHandle: "bottom",
        targetHandle: "top",
        data: {
          junctionFork: {
            parentIds: ["a", "x"],
            childIds: ["b"],
            parentNames: ["A", "X"],
            childNames: ["B"],
          },
        },
      },
      {
        id: "e2",
        type: "relationship",
        source: "a",
        target: "c",
        sourceHandle: "bottom",
        targetHandle: "top",
        data: { junctionHidden: true },
      },
    ];
    const nodeCenter = new Map([
      ["a", { x: 100, y: 0 }],
      ["b", { x: 50, y: 200 }],
      ["c", { x: 150, y: 200 }],
    ]);
    // Should not throw, and should not add offsets since junction edges are skipped
    adjustEdgeOverlaps(edges, nodeCenter, false);
    expect(edges[0].data?.sourceOffset).toBeUndefined();
    expect(edges[1].data?.sourceOffset).toBeUndefined();
  });

  it("spreads offsets on vertical (left/right) side groups", () => {
    // Two edges sharing a node on the "right" side
    const edges = [
      makeEdge("e1", "a", "b", "right", "left"),
      makeEdge("e2", "a", "c", "right", "left"),
    ];
    const nodeCenter = new Map([
      ["a", { x: 0, y: 100 }],
      ["b", { x: 300, y: 50 }],
      ["c", { x: 300, y: 150 }],
    ]);
    adjustEdgeOverlaps(edges, nodeCenter, false);
    // Both edges share source "a" right handle -> should have vertical (y) offsets
    const offsets = edges.map((e) => e.data?.sourceOffset?.y ?? 0);
    expect(offsets[0]).not.toBe(offsets[1]);
  });

  it("spreads target offsets when edges share a target handle", () => {
    // Two edges from different sources pointing to the same target
    const edges = [
      makeEdge("e1", "a", "c", "bottom", "top"),
      makeEdge("e2", "b", "c", "bottom", "top"),
    ];
    const nodeCenter = new Map([
      ["a", { x: 50, y: 0 }],
      ["b", { x: 150, y: 0 }],
      ["c", { x: 100, y: 200 }],
    ]);
    adjustEdgeOverlaps(edges, nodeCenter, false);
    // Both edges share target "c" top handle -> should have target offsets
    const offsets = edges.map((e) => e.data?.targetOffset?.x ?? 0);
    expect(offsets[0]).not.toBe(offsets[1]);
  });
});

// ---- handleSide ----

describe("handleSide", () => {
  it("returns top for top-prefixed handle", () => {
    expect(handleSide("top")).toBe("top");
    expect(handleSide("top-source")).toBe("top");
  });

  it("returns bottom for bottom-prefixed handle", () => {
    expect(handleSide("bottom")).toBe("bottom");
    expect(handleSide("bottom-target")).toBe("bottom");
  });

  it("returns left for left-prefixed handle", () => {
    expect(handleSide("left")).toBe("left");
    expect(handleSide("left-source")).toBe("left");
  });

  it("returns right for anything else", () => {
    expect(handleSide("right")).toBe("right");
    expect(handleSide("right-target")).toBe("right");
    expect(handleSide("unknown")).toBe("right");
  });
});

// ---- groupEdgesBySide ----

describe("groupEdgesBySide", () => {
  function makeEdge(
    id: string,
    source: string,
    target: string,
    sourceHandle: string,
    targetHandle: string,
  ): RelationshipEdgeType {
    return {
      id,
      type: "relationship",
      source,
      target,
      sourceHandle,
      targetHandle,
      data: {},
    };
  }

  it("groups edges by source and target node+side", () => {
    const edges = [
      makeEdge("e1", "a", "b", "bottom", "top"),
      makeEdge("e2", "a", "c", "bottom", "top"),
    ];
    const groups = groupEdgesBySide(edges);
    // "a:bottom" should have two entries (from e1 and e2 source)
    expect(groups.get("a:bottom")?.length).toBe(2);
    // "b:top" and "c:top" should each have one
    expect(groups.get("b:top")?.length).toBe(1);
    expect(groups.get("c:top")?.length).toBe(1);
  });

  it("skips junction fork edges", () => {
    const edges: RelationshipEdgeType[] = [
      {
        id: "e1",
        type: "relationship",
        source: "a",
        target: "b",
        sourceHandle: "bottom",
        targetHandle: "top",
        data: {
          junctionFork: {
            parentIds: ["a", "x"],
            childIds: ["b"],
            parentNames: ["A", "X"],
            childNames: ["B"],
          },
        },
      },
    ];
    const groups = groupEdgesBySide(edges);
    expect(groups.size).toBe(0);
  });

  it("skips junction hidden edges", () => {
    const edges: RelationshipEdgeType[] = [
      {
        id: "e1",
        type: "relationship",
        source: "a",
        target: "b",
        sourceHandle: "bottom",
        targetHandle: "top",
        data: { junctionHidden: true },
      },
    ];
    const groups = groupEdgesBySide(edges);
    expect(groups.size).toBe(0);
  });
});

// ---- assignMarkerShapes ----

describe("assignMarkerShapes", () => {
  function makeEdge(
    id: string,
    source: string,
    target: string,
    sourceHandle: string,
    targetHandle: string,
  ): RelationshipEdgeType {
    return {
      id,
      type: "relationship",
      source,
      target,
      sourceHandle,
      targetHandle,
      data: {},
    };
  }

  it("does not assign shapes when groups have single edges", () => {
    const edges = [makeEdge("e1", "a", "b", "bottom", "top")];
    const sideGroups = groupEdgesBySide(edges);
    assignMarkerShapes(edges, sideGroups);
    expect(edges[0].data?.markerShape).toBeUndefined();
  });

  it("assigns distinct shapes to overlapping edges", () => {
    const edges = [
      makeEdge("e1", "a", "b", "bottom", "top"),
      makeEdge("e2", "a", "c", "bottom", "top"),
      makeEdge("e3", "a", "d", "bottom", "top"),
    ];
    const sideGroups = groupEdgesBySide(edges);
    assignMarkerShapes(edges, sideGroups);
    const shapes = edges.map((e) => e.data?.markerShape);
    // All three should have shapes
    expect(shapes.every((s) => s !== undefined)).toBe(true);
    // All shapes should be from MARKER_SHAPES
    for (const s of shapes) {
      expect(MARKER_SHAPES).toContain(s);
    }
  });
});

// ---- resolveNodePosition ----

describe("resolveNodePosition", () => {
  function makeGraph(): dagre.graphlib.Graph {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB" });
    g.setDefaultEdgeLabel(() => ({}));
    return g;
  }

  it("returns person.position when pinned", () => {
    const person = makePerson("p1", "Alice", { x: 42, y: 99 });
    const g = makeGraph();
    const result = resolveNodePosition(person, g, false, undefined);
    expect(result).toEqual({ x: 42, y: 99 });
  });

  it("returns friend position when provided (offset by half node size)", () => {
    const person = makePerson("p1", "Alice");
    const g = makeGraph();
    const result = resolveNodePosition(person, g, true, { x: 500, y: 200 });
    expect(result).toEqual({ x: 500 - NODE_WIDTH / 2, y: 200 - NODE_HEIGHT / 2 });
  });

  it("returns graph position for non-friend-only when in graph", () => {
    const person = makePerson("p1", "Alice");
    const g = makeGraph();
    g.setNode("p1", { width: NODE_WIDTH, height: NODE_HEIGHT, x: 300, y: 150 });
    const result = resolveNodePosition(person, g, false, undefined);
    expect(result).toEqual({ x: 300 - NODE_WIDTH / 2, y: 150 - NODE_HEIGHT / 2 });
  });

  it("returns (0,0) when friend-only with no friendPos and no graph position", () => {
    const person = makePerson("p1", "Alice");
    const g = makeGraph();
    const result = resolveNodePosition(person, g, true, undefined);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it("returns (0,0) when non-friend-only but not in graph", () => {
    const person = makePerson("p1", "Alice");
    const g = makeGraph();
    const result = resolveNodePosition(person, g, false, undefined);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it("prioritizes pinned position over friend position", () => {
    const person = makePerson("p1", "Alice", { x: 10, y: 20 });
    const g = makeGraph();
    const result = resolveNodePosition(person, g, true, { x: 500, y: 200 });
    expect(result).toEqual({ x: 10, y: 20 });
  });
});

// ---- findMaxFamilyX ----

describe("findMaxFamilyX", () => {
  it("returns 0 when no non-friend nodes", () => {
    const persons = new Map([["f1", makePerson("f1", "Friend")]]);
    const friendOnlyIds = new Set(["f1"]);
    const { graph } = layoutDagreGraph(new Map(), new Map(), new Set());
    const result = findMaxFamilyX(persons, friendOnlyIds, graph);
    expect(result).toBe(0);
  });

  it("returns rightmost x + half node width for family nodes", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Alice")],
      ["p2", makePerson("p2", "Bob")],
    ]);
    const { graph } = layoutDagreGraph(persons, new Map(), new Set());
    const result = findMaxFamilyX(persons, new Set(), graph);
    // Should be greater than 0 since dagre places nodes
    expect(result).toBeGreaterThan(0);
  });
});

// ---- computeFriendY ----

describe("computeFriendY", () => {
  it("returns 0 when friend has no connections in the graph", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Friend, "f1", "p1")]]);
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB" });
    g.setDefaultEdgeLabel(() => ({}));
    // p1 is NOT in the graph
    const result = computeFriendY("f1", rels, g, []);
    expect(result).toBe(0);
  });

  it("returns average Y of connected family members", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Friend, "f1", "p1")]]);
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB" });
    g.setDefaultEdgeLabel(() => ({}));
    g.setNode("p1", { width: NODE_WIDTH, height: NODE_HEIGHT, x: 100, y: 200 });
    const result = computeFriendY("f1", rels, g, []);
    expect(result).toBe(200);
  });

  it("avoids overlap with used Y positions", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Friend, "f1", "p1")]]);
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB" });
    g.setDefaultEdgeLabel(() => ({}));
    g.setNode("p1", { width: NODE_WIDTH, height: NODE_HEIGHT, x: 100, y: 200 });
    // Already a friend at y=200
    const result = computeFriendY("f1", rels, g, [200]);
    expect(result).toBeGreaterThan(200);
    expect(result).toBe(200 + NODE_HEIGHT + 20); // NODE_HEIGHT + FRIEND_Y_GAP
  });

  it("skips non-friend relationships", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.BiologicalParent, "f1", "p1")]]);
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB" });
    g.setDefaultEdgeLabel(() => ({}));
    g.setNode("p1", { width: NODE_WIDTH, height: NODE_HEIGHT, x: 100, y: 200 });
    const result = computeFriendY("f1", rels, g, []);
    // No friend relationships, so connectedYs is empty, result is 0
    expect(result).toBe(0);
  });
});

// ---- buildPersonNodes edge cases ----

describe("buildPersonNodes additional cases", () => {
  it("sets isFriendOnly to undefined for non-friend nodes", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const { graph } = layoutDagreGraph(persons, new Map(), new Set());
    const lookups = buildEntityLookups(new Map());
    const result = buildPersonNodes(persons, graph, new Set(), new Map(), lookups, null);
    expect(result.nodes[0].data.isFriendOnly).toBeUndefined();
  });

  it("sets selected to false when selectedPersonId does not match", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const { graph } = layoutDagreGraph(persons, new Map(), new Set());
    const lookups = buildEntityLookups(new Map());
    const result = buildPersonNodes(persons, graph, new Set(), new Map(), lookups, "other");
    expect(result.nodes[0].selected).toBe(false);
  });

  it("attaches events, lifeEvents, and classifications to nodes", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const events = new Map<string, DecryptedEvent>([
      [
        "e1",
        {
          id: "e1",
          title: "T",
          description: "",
          category: TraumaCategory.Loss,
          approximate_date: "1990",
          severity: 1,
          tags: [],
          person_ids: ["p1"],
        },
      ],
    ]);
    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      [
        "le1",
        {
          id: "le1",
          title: "L",
          description: "",
          category: LifeEventCategory.Family,
          approximate_date: "1990",
          impact: 1,
          tags: [],
          person_ids: ["p1"],
        },
      ],
    ]);
    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        {
          id: "c1",
          dsm_category: "mood",
          dsm_subcategory: null,
          status: "diagnosed",
          diagnosis_year: 2020,
          periods: [],
          notes: null,
          person_ids: ["p1"],
        },
      ],
    ]);
    const lookups = buildEntityLookups(events, lifeEvents, classifications);
    const { graph } = layoutDagreGraph(persons, new Map(), new Set());
    const result = buildPersonNodes(persons, graph, new Set(), new Map(), lookups, null);
    expect(result.nodes[0].data.events).toHaveLength(1);
    expect(result.nodes[0].data.lifeEvents).toHaveLength(1);
    expect(result.nodes[0].data.classifications).toHaveLength(1);
  });
});

// ---- buildJunctionForks edge cases ----

describe("buildJunctionForks additional cases", () => {
  it("skips couples where all children have no nodeCenter", () => {
    const coupleChildren = new Map([["dad|mom", ["child1"]]]);
    const nodeCenter = new Map([
      ["dad", { x: 0, y: 0 }],
      ["mom", { x: 200, y: 0 }],
      // child1 is NOT in nodeCenter
    ]);
    const rels = new Map([
      ["r1", makeRel("r1", RelationshipType.BiologicalParent, "dad", "child1")],
      ["r2", makeRel("r2", RelationshipType.BiologicalParent, "mom", "child1")],
    ]);
    const persons = new Map([
      ["dad", makePerson("dad", "Dad")],
      ["mom", makePerson("mom", "Mom")],
      ["child1", makePerson("child1", "Child")],
    ]);
    const result = buildJunctionForks(coupleChildren, nodeCenter, rels, persons);
    expect(result.forkPrimaryIds.size).toBe(0);
    expect(result.forkHiddenIds.size).toBe(0);
  });

  it("uses ? for unknown person names", () => {
    const coupleChildren = new Map([["dad|mom", ["child1"]]]);
    const nodeCenter = new Map([
      ["dad", { x: 0, y: 0 }],
      ["mom", { x: 200, y: 0 }],
      ["child1", { x: 100, y: 200 }],
    ]);
    const rels = new Map([
      ["r1", makeRel("r1", RelationshipType.BiologicalParent, "dad", "child1")],
      ["r2", makeRel("r2", RelationshipType.BiologicalParent, "mom", "child1")],
    ]);
    // Empty persons map -> names will be "?"
    const result = buildJunctionForks(coupleChildren, nodeCenter, rels, new Map());
    const forkData = result.forkDataByEdge.values().next().value;
    expect(forkData).toBeDefined();
    expect(forkData!.parentNames).toEqual(["?", "?"]);
    expect(forkData!.childNames).toEqual(["?"]);
  });
});

// ---- layoutDagreGraph additional cases ----

describe("layoutDagreGraph additional cases", () => {
  it("excludes friend-only nodes from the graph", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Alice")],
      ["f1", makePerson("f1", "Friend")],
    ]);
    const friendOnlyIds = new Set(["f1"]);
    const result = layoutDagreGraph(persons, new Map(), friendOnlyIds);
    expect(result.graph.node("p1")).toBeDefined();
    expect(result.graph.node("f1")).toBeUndefined();
  });

  it("handles sibling relationships with minlen 0", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "A")],
      ["p2", makePerson("p2", "B")],
    ]);
    const rels = new Map([["r1", makeRel("r1", RelationshipType.BiologicalSibling, "p1", "p2")]]);
    const result = layoutDagreGraph(persons, rels, new Set());
    expect(result.graph.node("p1")).toBeDefined();
    expect(result.graph.node("p2")).toBeDefined();
  });
});

// ---- buildRelationshipEdges additional cases ----

describe("buildRelationshipEdges additional cases", () => {
  type BuildEdgesParamsType = Parameters<typeof buildRelationshipEdges>[0];
  const emptyForkData = new Map() as BuildEdgesParamsType["forkDataByEdge"];

  it("uses default handles when node positions are missing from nodeCenter", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Partner, "p1", "p2")]]);
    const persons = new Map([
      ["p1", makePerson("p1", "A")],
      ["p2", makePerson("p2", "B")],
    ]);
    // Empty nodeCenter -> resolveEdgeHandles falls back to defaultHandles
    const edges = buildRelationshipEdges({
      relationships: rels,
      persons,
      nodeCenter: new Map(),
      childCoupleColor: new Map(),
      useCoupleColors: false,
      forkDataByEdge: emptyForkData,
      forkHiddenIds: new Set(),
      inferred: [],
    });
    expect(edges).toHaveLength(1);
    // Partner is not a parent type -> preferVertical=false -> default horizontal handles
    expect(edges[0].sourceHandle).toBe("right");
    expect(edges[0].targetHandle).toBe("left");
  });

  it("sets junctionHidden for hidden fork edges", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.BiologicalParent, "p1", "c1")]]);
    const persons = new Map([
      ["p1", makePerson("p1", "P")],
      ["c1", makePerson("c1", "C")],
    ]);
    const nodeCenter = new Map([
      ["p1", { x: 90, y: 40 }],
      ["c1", { x: 90, y: 200 }],
    ]);
    const edges = buildRelationshipEdges({
      relationships: rels,
      persons,
      nodeCenter,
      childCoupleColor: new Map(),
      useCoupleColors: false,
      forkDataByEdge: emptyForkData,
      forkHiddenIds: new Set(["r1"]),
      inferred: [],
    });
    expect(edges[0].data?.junctionHidden).toBe(true);
  });

  it("sets junctionFork data on fork primary edge", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.BiologicalParent, "p1", "c1")]]);
    const persons = new Map([
      ["p1", makePerson("p1", "P")],
      ["c1", makePerson("c1", "C")],
    ]);
    const nodeCenter = new Map([
      ["p1", { x: 90, y: 40 }],
      ["c1", { x: 90, y: 200 }],
    ]);
    const forkData = {
      parentIds: ["p1", "p2"] as [string, string],
      childIds: ["c1"],
      parentNames: ["P", "P2"] as [string, string],
      childNames: ["C"],
    };
    const forkDataByEdge = new Map([["r1", forkData]]);
    const edges = buildRelationshipEdges({
      relationships: rels,
      persons,
      nodeCenter,
      childCoupleColor: new Map(),
      useCoupleColors: false,
      forkDataByEdge,
      forkHiddenIds: new Set(),
      inferred: [],
    });
    expect(edges[0].data?.junctionFork).toBe(forkData);
  });

  it("does not set coupleColor for non-bio-parent edges", () => {
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Partner, "p1", "p2")]]);
    const persons = new Map([
      ["p1", makePerson("p1", "A")],
      ["p2", makePerson("p2", "B")],
    ]);
    const nodeCenter = new Map([
      ["p1", { x: 0, y: 0 }],
      ["p2", { x: 200, y: 0 }],
    ]);
    const edges = buildRelationshipEdges({
      relationships: rels,
      persons,
      nodeCenter,
      childCoupleColor: new Map([["p2", "hsl(0,0%,0%)"]]),
      useCoupleColors: true,
      forkDataByEdge: emptyForkData,
      forkHiddenIds: new Set(),
      inferred: [],
    });
    expect(edges[0].data?.coupleColor).toBeUndefined();
  });
});
