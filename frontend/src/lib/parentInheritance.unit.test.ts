import { describe, expect, it } from "vitest";
import type { DecryptedRelationship } from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";
import { buildSiblingParentInheritance, collectBiologicalParentIds } from "./parentInheritance";

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
  };
}

describe("collectBiologicalParentIds", () => {
  it("returns empty when relationships map is empty", () => {
    expect(collectBiologicalParentIds(new Map(), "child")).toEqual([]);
  });

  it("returns empty when child has no biological parents", () => {
    const rels = new Map([
      ["r1", rel("r1", RelationshipType.BiologicalParent, "p1", "other-child")],
      ["r2", rel("r2", RelationshipType.Friend, "p1", "child")],
    ]);
    expect(collectBiologicalParentIds(rels, "child")).toEqual([]);
  });

  it("returns the single biological parent of a child", () => {
    const rels = new Map([["r1", rel("r1", RelationshipType.BiologicalParent, "mum", "child")]]);
    expect(collectBiologicalParentIds(rels, "child")).toEqual(["mum"]);
  });

  it("returns both biological parents of a child", () => {
    const rels = new Map([
      ["r1", rel("r1", RelationshipType.BiologicalParent, "mum", "child")],
      ["r2", rel("r2", RelationshipType.BiologicalParent, "dad", "child")],
    ]);
    expect(collectBiologicalParentIds(rels, "child").sort()).toEqual(["dad", "mum"]);
  });

  it("ignores step, adoptive, and co-parent relationships", () => {
    const rels = new Map([
      ["r1", rel("r1", RelationshipType.BiologicalParent, "biomum", "child")],
      ["r2", rel("r2", RelationshipType.StepParent, "stepdad", "child")],
      ["r3", rel("r3", RelationshipType.AdoptiveParent, "adoptmum", "child")],
      ["r4", rel("r4", RelationshipType.CoParent, "coparent", "child")],
    ]);
    expect(collectBiologicalParentIds(rels, "child")).toEqual(["biomum"]);
  });

  it("ignores edges where the child is the source instead of target", () => {
    // A reversed BiologicalParent edge means the "child" is acting as parent
    // in that record. collectBiologicalParentIds should not return their
    // child's id as a parent.
    const rels = new Map([
      ["r1", rel("r1", RelationshipType.BiologicalParent, "child", "grandchild")],
    ]);
    expect(collectBiologicalParentIds(rels, "child")).toEqual([]);
  });

  it("ignores sibling and partner edges entirely", () => {
    const rels = new Map([
      ["r1", rel("r1", RelationshipType.BiologicalSibling, "sib1", "child")],
      ["r2", rel("r2", RelationshipType.Partner, "partner", "child")],
      ["r3", rel("r3", RelationshipType.HalfSibling, "halfsib", "child")],
    ]);
    expect(collectBiologicalParentIds(rels, "child")).toEqual([]);
  });
});

describe("buildSiblingParentInheritance", () => {
  it("returns empty for non-sibling relationship types", () => {
    const rels = new Map([["r1", rel("r1", RelationshipType.BiologicalParent, "mum", "existing")]]);
    expect(
      buildSiblingParentInheritance(RelationshipType.Partner, "new", "existing", rels),
    ).toEqual([]);
  });

  it("returns empty for half_sibling — half-siblings share only one unknown parent", () => {
    const rels = new Map([
      ["r1", rel("r1", RelationshipType.BiologicalParent, "mum", "existing")],
      ["r2", rel("r2", RelationshipType.BiologicalParent, "dad", "existing")],
    ]);
    expect(
      buildSiblingParentInheritance(RelationshipType.HalfSibling, "new", "existing", rels),
    ).toEqual([]);
  });

  it("returns empty for step_sibling — step-siblings have no biological link", () => {
    const rels = new Map([["r1", rel("r1", RelationshipType.BiologicalParent, "mum", "existing")]]);
    expect(
      buildSiblingParentInheritance(RelationshipType.StepSibling, "new", "existing", rels),
    ).toEqual([]);
  });

  it("returns empty when the existing sibling has no biological parents recorded", () => {
    expect(
      buildSiblingParentInheritance(
        RelationshipType.BiologicalSibling,
        "new",
        "existing",
        new Map(),
      ),
    ).toEqual([]);
  });

  it("emits one parent edge per biological parent of the existing sibling", () => {
    const rels = new Map([
      ["r1", rel("r1", RelationshipType.BiologicalParent, "mum", "existing")],
      ["r2", rel("r2", RelationshipType.BiologicalParent, "dad", "existing")],
    ]);
    const edges = buildSiblingParentInheritance(
      RelationshipType.BiologicalSibling,
      "new",
      "existing",
      rels,
    );
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.targetPersonId === "new")).toBe(true);
    expect(edges.map((e) => e.sourcePersonId).sort()).toEqual(["dad", "mum"]);
  });

  it("does not clone step or adoptive parents — only biological", () => {
    const rels = new Map([
      ["r1", rel("r1", RelationshipType.BiologicalParent, "biomum", "existing")],
      ["r2", rel("r2", RelationshipType.StepParent, "stepdad", "existing")],
      ["r3", rel("r3", RelationshipType.AdoptiveParent, "adoptmum", "existing")],
    ]);
    const edges = buildSiblingParentInheritance(
      RelationshipType.BiologicalSibling,
      "new",
      "existing",
      rels,
    );
    expect(edges).toEqual([{ sourcePersonId: "biomum", targetPersonId: "new" }]);
  });

  it("does not clone the new person's own existing parents — looks at the sibling only", () => {
    // The new person already has a parent recorded somehow, but inheritance
    // must look up the existing sibling's parents, not the new person's.
    const rels = new Map([
      ["r1", rel("r1", RelationshipType.BiologicalParent, "mum-of-new", "new")],
      ["r2", rel("r2", RelationshipType.BiologicalParent, "mum-of-existing", "existing")],
    ]);
    const edges = buildSiblingParentInheritance(
      RelationshipType.BiologicalSibling,
      "new",
      "existing",
      rels,
    );
    expect(edges).toEqual([{ sourcePersonId: "mum-of-existing", targetPersonId: "new" }]);
  });
});
