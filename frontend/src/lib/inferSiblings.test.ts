import { describe, expect, it } from "vitest";
import type { DecryptedRelationship } from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";
import { inferSiblings } from "./inferSiblings";

function makeRel(
  overrides: Partial<DecryptedRelationship> & { id: string },
): DecryptedRelationship {
  return {
    type: RelationshipType.BiologicalParent,
    source_person_id: "",
    target_person_id: "",
    periods: [],
    active_period: null,
    ...overrides,
  };
}

function toMap(rels: DecryptedRelationship[]): Map<string, DecryptedRelationship> {
  return new Map(rels.map((r) => [r.id, r]));
}

describe("inferSiblings", () => {
  it("returns empty array when no relationships exist", () => {
    expect(inferSiblings(new Map())).toEqual([]);
  });

  it("infers half-sibling when two children share one parent", () => {
    const rels = toMap([
      makeRel({ id: "r1", source_person_id: "parent1", target_person_id: "childA" }),
      makeRel({ id: "r2", source_person_id: "parent1", target_person_id: "childB" }),
    ]);
    const result = inferSiblings(rels);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("half_sibling");
    expect(result[0].sharedParentIds).toEqual(["parent1"]);
  });

  it("infers full-sibling when two children share two parents", () => {
    const rels = toMap([
      makeRel({ id: "r1", source_person_id: "parent1", target_person_id: "childA" }),
      makeRel({ id: "r2", source_person_id: "parent2", target_person_id: "childA" }),
      makeRel({ id: "r3", source_person_id: "parent1", target_person_id: "childB" }),
      makeRel({ id: "r4", source_person_id: "parent2", target_person_id: "childB" }),
    ]);
    const result = inferSiblings(rels);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("full_sibling");
    expect(result[0].sharedParentIds).toHaveLength(2);
  });

  it("does not infer siblings when children share no parents", () => {
    const rels = toMap([
      makeRel({ id: "r1", source_person_id: "parent1", target_person_id: "childA" }),
      makeRel({ id: "r2", source_person_id: "parent2", target_person_id: "childB" }),
    ]);
    expect(inferSiblings(rels)).toEqual([]);
  });

  it("skips pairs with explicit biological sibling edge", () => {
    const rels = toMap([
      makeRel({ id: "r1", source_person_id: "parent1", target_person_id: "childA" }),
      makeRel({ id: "r2", source_person_id: "parent1", target_person_id: "childB" }),
      makeRel({
        id: "r3",
        type: RelationshipType.BiologicalSibling,
        source_person_id: "childA",
        target_person_id: "childB",
      }),
    ]);
    expect(inferSiblings(rels)).toEqual([]);
  });

  it("skips pairs with explicit half-sibling edge", () => {
    const rels = toMap([
      makeRel({ id: "r1", source_person_id: "parent1", target_person_id: "childA" }),
      makeRel({ id: "r2", source_person_id: "parent1", target_person_id: "childB" }),
      makeRel({
        id: "r3",
        type: RelationshipType.HalfSibling,
        source_person_id: "childA",
        target_person_id: "childB",
      }),
    ]);
    expect(inferSiblings(rels)).toEqual([]);
  });

  it("skips pairs with explicit step-sibling edge", () => {
    const rels = toMap([
      makeRel({ id: "r1", source_person_id: "parent1", target_person_id: "childA" }),
      makeRel({ id: "r2", source_person_id: "parent1", target_person_id: "childB" }),
      makeRel({
        id: "r3",
        type: RelationshipType.StepSibling,
        source_person_id: "childB",
        target_person_id: "childA",
      }),
    ]);
    expect(inferSiblings(rels)).toEqual([]);
  });

  it("ignores non-biological-parent relationships for inference", () => {
    const rels = toMap([
      makeRel({
        id: "r1",
        type: RelationshipType.StepParent,
        source_person_id: "parent1",
        target_person_id: "childA",
      }),
      makeRel({
        id: "r2",
        type: RelationshipType.StepParent,
        source_person_id: "parent1",
        target_person_id: "childB",
      }),
    ]);
    expect(inferSiblings(rels)).toEqual([]);
  });

  it("handles multiple sibling pairs", () => {
    const rels = toMap([
      makeRel({ id: "r1", source_person_id: "parent1", target_person_id: "childA" }),
      makeRel({ id: "r2", source_person_id: "parent1", target_person_id: "childB" }),
      makeRel({ id: "r3", source_person_id: "parent1", target_person_id: "childC" }),
    ]);
    const result = inferSiblings(rels);
    expect(result).toHaveLength(3); // A-B, A-C, B-C
  });
});
