import { describe, expect, it } from "vitest";
import { RelationshipType } from "../types/domain";
import { sharedBiologicalParentIds } from "./usePromoteMember";
import type { DecryptedRelationship } from "./useTreeData";

function rel(
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
  } as DecryptedRelationship;
}

function relMap(...rels: DecryptedRelationship[]): Map<string, DecryptedRelationship> {
  return new Map(rels.map((r) => [r.id, r]));
}

describe("sharedBiologicalParentIds", () => {
  it("returns the biological parents shared by all siblings", () => {
    const rels = relMap(
      rel("r1", RelationshipType.BiologicalParent, "mum", "p1"),
      rel("r2", RelationshipType.BiologicalParent, "dad", "p1"),
      rel("r3", RelationshipType.BiologicalParent, "mum", "p2"),
      rel("r4", RelationshipType.BiologicalParent, "dad", "p2"),
    );
    expect(sharedBiologicalParentIds(rels, ["p1", "p2"]).sort()).toEqual(["dad", "mum"]);
  });

  it("only includes parents shared by every sibling (intersection)", () => {
    const rels = relMap(
      rel("r1", RelationshipType.BiologicalParent, "mum", "p1"),
      rel("r2", RelationshipType.BiologicalParent, "dad", "p1"),
      rel("r3", RelationshipType.BiologicalParent, "mum", "p2"),
    );
    expect(sharedBiologicalParentIds(rels, ["p1", "p2"])).toEqual(["mum"]);
  });

  it("ignores step and adoptive parents", () => {
    const rels = relMap(
      rel("r1", RelationshipType.StepParent, "step", "p1"),
      rel("r2", RelationshipType.AdoptiveParent, "adopter", "p1"),
      rel("r3", RelationshipType.BiologicalParent, "mum", "p1"),
    );
    expect(sharedBiologicalParentIds(rels, ["p1"])).toEqual(["mum"]);
  });

  it("returns an empty list when there are no person ids", () => {
    expect(sharedBiologicalParentIds(new Map(), [])).toEqual([]);
  });

  it("returns an empty list when the siblings have no parents recorded", () => {
    expect(sharedBiologicalParentIds(new Map(), ["p1", "p2"])).toEqual([]);
  });
});
