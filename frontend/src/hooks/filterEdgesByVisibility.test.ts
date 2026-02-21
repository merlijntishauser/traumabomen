import { describe, expect, it } from "vitest";
import type { RelationshipEdgeType } from "../lib/treeLayoutHelpers";
import { RelationshipType } from "../types/domain";
import type { DecryptedRelationship } from "./useTreeData";
import { filterEdgesByVisibility } from "./useTreeLayout";

function makeEdge(id: string, type: RelationshipType): RelationshipEdgeType {
  return {
    id,
    type: "relationship",
    source: "a",
    target: "b",
    data: {
      relationship: { type } as DecryptedRelationship,
      edgeStyle: "curved",
    },
  };
}

function makeInferredEdge(
  id: string,
  inferredType: "full_sibling" | "half_sibling",
): RelationshipEdgeType {
  return {
    id,
    type: "relationship",
    source: "a",
    target: "b",
    data: {
      inferredType,
      edgeStyle: "curved",
    },
  };
}

const ALL_VISIBLE = {
  showParentEdges: true,
  showPartnerEdges: true,
  showSiblingEdges: true,
  showFriendEdges: true,
};

describe("filterEdgesByVisibility", () => {
  it("returns all edges when all toggles are enabled", () => {
    const edges = [
      makeEdge("1", RelationshipType.BiologicalParent),
      makeEdge("2", RelationshipType.Partner),
      makeEdge("3", RelationshipType.BiologicalSibling),
      makeEdge("4", RelationshipType.Friend),
    ];
    expect(filterEdgesByVisibility(edges, ALL_VISIBLE)).toHaveLength(4);
  });

  it("returns all edges when settings is undefined", () => {
    const edges = [makeEdge("1", RelationshipType.Partner)];
    expect(filterEdgesByVisibility(edges, undefined)).toHaveLength(1);
  });

  it("hides parent edges when showParentEdges is false", () => {
    const edges = [
      makeEdge("1", RelationshipType.BiologicalParent),
      makeEdge("2", RelationshipType.StepParent),
      makeEdge("3", RelationshipType.AdoptiveParent),
      makeEdge("4", RelationshipType.CoParent),
      makeEdge("5", RelationshipType.Partner),
    ];
    const result = filterEdgesByVisibility(edges, { ...ALL_VISIBLE, showParentEdges: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("5");
  });

  it("hides partner edges when showPartnerEdges is false", () => {
    const edges = [
      makeEdge("1", RelationshipType.BiologicalParent),
      makeEdge("2", RelationshipType.Partner),
    ];
    const result = filterEdgesByVisibility(edges, { ...ALL_VISIBLE, showPartnerEdges: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("hides sibling edges when showSiblingEdges is false", () => {
    const edges = [
      makeEdge("1", RelationshipType.BiologicalSibling),
      makeEdge("2", RelationshipType.StepSibling),
      makeEdge("3", RelationshipType.HalfSibling),
      makeEdge("4", RelationshipType.Partner),
    ];
    const result = filterEdgesByVisibility(edges, { ...ALL_VISIBLE, showSiblingEdges: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("4");
  });

  it("hides friend edges when showFriendEdges is false", () => {
    const edges = [makeEdge("1", RelationshipType.Friend), makeEdge("2", RelationshipType.Partner)];
    const result = filterEdgesByVisibility(edges, { ...ALL_VISIBLE, showFriendEdges: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("hides inferred sibling edges when showSiblingEdges is false", () => {
    const edges = [
      makeInferredEdge("inf-1", "half_sibling"),
      makeInferredEdge("inf-2", "full_sibling"),
      makeEdge("3", RelationshipType.Partner),
    ];
    const result = filterEdgesByVisibility(edges, { ...ALL_VISIBLE, showSiblingEdges: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("can hide multiple types simultaneously", () => {
    const edges = [
      makeEdge("1", RelationshipType.BiologicalParent),
      makeEdge("2", RelationshipType.Partner),
      makeEdge("3", RelationshipType.Friend),
      makeEdge("4", RelationshipType.BiologicalSibling),
    ];
    const result = filterEdgesByVisibility(edges, {
      showParentEdges: false,
      showPartnerEdges: false,
      showSiblingEdges: true,
      showFriendEdges: true,
    });
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["3", "4"]);
  });
});
