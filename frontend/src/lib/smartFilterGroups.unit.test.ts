import { describe, expect, it } from "vitest";
import type { DecryptedPerson, DecryptedRelationship } from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";
import { computeSmartFilterGroups } from "./smartFilterGroups";

function makePerson(id: string, overrides: Partial<DecryptedPerson> = {}): DecryptedPerson {
  return {
    id,
    name: `Person ${id}`,
    birth_year: 1980,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "other",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

function makeRel(
  id: string,
  source: string,
  target: string,
  type: RelationshipType,
): DecryptedRelationship {
  return {
    id,
    source_person_id: source,
    target_person_id: target,
    type,
    periods: [],
    active_period: null,
  };
}

describe("computeSmartFilterGroups", () => {
  describe("demographic groups", () => {
    it("creates women and men groups from gender field", () => {
      const persons = new Map([
        ["p1", makePerson("p1", { gender: "female" })],
        ["p2", makePerson("p2", { gender: "male" })],
        ["p3", makePerson("p3", { gender: "female" })],
      ]);
      const rels = new Map<string, DecryptedRelationship>();
      const gens = new Map([
        ["p1", 0],
        ["p2", 0],
        ["p3", 0],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      const women = groups.demographic.find((g) => g.key === "gender:female");
      const men = groups.demographic.find((g) => g.key === "gender:male");
      expect(women).toBeDefined();
      expect(women!.personIds).toEqual(new Set(["p1", "p3"]));
      expect(men).toBeDefined();
      expect(men!.personIds).toEqual(new Set(["p2"]));
    });

    it("creates adopted group", () => {
      const persons = new Map([
        ["p1", makePerson("p1", { is_adopted: true })],
        ["p2", makePerson("p2", { is_adopted: false })],
      ]);
      const rels = new Map<string, DecryptedRelationship>();
      const gens = new Map([
        ["p1", 0],
        ["p2", 0],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      const adopted = groups.demographic.find((g) => g.key === "demographic:adopted");
      expect(adopted).toBeDefined();
      expect(adopted!.personIds).toEqual(new Set(["p1"]));
    });

    it("omits empty demographic groups", () => {
      const persons = new Map([["p1", makePerson("p1", { gender: "other" })]]);
      const rels = new Map<string, DecryptedRelationship>();
      const gens = new Map([["p1", 0]]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      expect(groups.demographic.find((g) => g.key === "gender:female")).toBeUndefined();
      expect(groups.demographic.find((g) => g.key === "gender:male")).toBeUndefined();
      expect(groups.demographic.find((g) => g.key === "demographic:adopted")).toBeUndefined();
    });
  });

  describe("role groups", () => {
    it("identifies parents from parent-type relationships", () => {
      const persons = new Map([
        ["parent1", makePerson("parent1")],
        ["child1", makePerson("child1")],
      ]);
      const rels = new Map([
        ["r1", makeRel("r1", "parent1", "child1", RelationshipType.BiologicalParent)],
      ]);
      const gens = new Map([
        ["parent1", 0],
        ["child1", 1],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      const parents = groups.roles.find((g) => g.key === "role:parents");
      expect(parents).toBeDefined();
      expect(parents!.personIds).toEqual(new Set(["parent1"]));
    });

    it("identifies grandparents (parents whose children are also parents)", () => {
      const persons = new Map([
        ["gp", makePerson("gp")],
        ["parent", makePerson("parent")],
        ["child", makePerson("child")],
      ]);
      const rels = new Map([
        ["r1", makeRel("r1", "gp", "parent", RelationshipType.BiologicalParent)],
        ["r2", makeRel("r2", "parent", "child", RelationshipType.BiologicalParent)],
      ]);
      const gens = new Map([
        ["gp", 0],
        ["parent", 1],
        ["child", 2],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      const grandparents = groups.roles.find((g) => g.key === "role:grandparents");
      expect(grandparents).toBeDefined();
      expect(grandparents!.personIds).toEqual(new Set(["gp"]));

      const parents = groups.roles.find((g) => g.key === "role:parents");
      expect(parents!.personIds).toEqual(new Set(["gp", "parent"]));
    });

    it("identifies partners", () => {
      const persons = new Map([
        ["p1", makePerson("p1")],
        ["p2", makePerson("p2")],
      ]);
      const rels = new Map([["r1", makeRel("r1", "p1", "p2", RelationshipType.Partner)]]);
      const gens = new Map([
        ["p1", 0],
        ["p2", 0],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      const partners = groups.roles.find((g) => g.key === "role:partners");
      expect(partners).toBeDefined();
      expect(partners!.personIds).toEqual(new Set(["p1", "p2"]));
    });

    it("identifies explicit siblings", () => {
      const persons = new Map([
        ["p1", makePerson("p1")],
        ["p2", makePerson("p2")],
      ]);
      const rels = new Map([["r1", makeRel("r1", "p1", "p2", RelationshipType.BiologicalSibling)]]);
      const gens = new Map([
        ["p1", 0],
        ["p2", 0],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      const siblings = groups.roles.find((g) => g.key === "role:siblings");
      expect(siblings).toBeDefined();
      expect(siblings!.personIds).toEqual(new Set(["p1", "p2"]));
    });

    it("identifies inferred half-siblings", () => {
      const persons = new Map([
        ["parent", makePerson("parent")],
        ["child1", makePerson("child1")],
        ["child2", makePerson("child2")],
      ]);
      const rels = new Map([
        ["r1", makeRel("r1", "parent", "child1", RelationshipType.BiologicalParent)],
        ["r2", makeRel("r2", "parent", "child2", RelationshipType.BiologicalParent)],
      ]);
      const gens = new Map([
        ["parent", 0],
        ["child1", 1],
        ["child2", 1],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      const siblings = groups.roles.find((g) => g.key === "role:siblings");
      expect(siblings).toBeDefined();
      expect(siblings!.personIds.has("child1")).toBe(true);
      expect(siblings!.personIds.has("child2")).toBe(true);
    });

    it("includes step-parents in parent group", () => {
      const persons = new Map([
        ["step", makePerson("step")],
        ["child", makePerson("child")],
      ]);
      const rels = new Map([["r1", makeRel("r1", "step", "child", RelationshipType.StepParent)]]);
      const gens = new Map([
        ["step", 0],
        ["child", 1],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      const parents = groups.roles.find((g) => g.key === "role:parents");
      expect(parents).toBeDefined();
      expect(parents!.personIds.has("step")).toBe(true);
    });

    it("omits empty role groups", () => {
      const persons = new Map([["p1", makePerson("p1")]]);
      const rels = new Map<string, DecryptedRelationship>();
      const gens = new Map([["p1", 0]]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      expect(groups.roles).toHaveLength(0);
    });
  });

  describe("generation groups", () => {
    it("groups persons by generation number", () => {
      const persons = new Map([
        ["p1", makePerson("p1")],
        ["p2", makePerson("p2")],
        ["p3", makePerson("p3")],
      ]);
      const rels = new Map<string, DecryptedRelationship>();
      const gens = new Map([
        ["p1", 0],
        ["p2", 0],
        ["p3", 1],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      expect(groups.generations).toHaveLength(2);
      expect(groups.generations[0].key).toBe("gen:0");
      expect(groups.generations[0].labelKey).toBe("Gen 1");
      expect(groups.generations[0].personIds).toEqual(new Set(["p1", "p2"]));
      expect(groups.generations[1].key).toBe("gen:1");
      expect(groups.generations[1].labelKey).toBe("Gen 2");
      expect(groups.generations[1].personIds).toEqual(new Set(["p3"]));
    });

    it("sorts generation groups by generation number", () => {
      const persons = new Map([
        ["p1", makePerson("p1")],
        ["p2", makePerson("p2")],
        ["p3", makePerson("p3")],
      ]);
      const rels = new Map<string, DecryptedRelationship>();
      const gens = new Map([
        ["p1", 2],
        ["p2", 0],
        ["p3", 1],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      expect(groups.generations[0].key).toBe("gen:0");
      expect(groups.generations[1].key).toBe("gen:1");
      expect(groups.generations[2].key).toBe("gen:2");
    });

    it("excludes persons not in the persons map", () => {
      const persons = new Map([["p1", makePerson("p1")]]);
      const rels = new Map<string, DecryptedRelationship>();
      // generations map has an extra person not in persons
      const gens = new Map([
        ["p1", 0],
        ["p_ghost", 0],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      expect(groups.generations[0].personIds).toEqual(new Set(["p1"]));
    });
  });

  describe("multi-generational family", () => {
    it("correctly computes all group types for a blended family", () => {
      const persons = new Map([
        ["gma", makePerson("gma", { gender: "female" })],
        ["gpa", makePerson("gpa", { gender: "male" })],
        ["mom", makePerson("mom", { gender: "female" })],
        ["dad", makePerson("dad", { gender: "male" })],
        ["kid", makePerson("kid", { gender: "male", is_adopted: true })],
      ]);
      const rels = new Map([
        ["r1", makeRel("r1", "gpa", "mom", RelationshipType.BiologicalParent)],
        ["r2", makeRel("r2", "gma", "mom", RelationshipType.BiologicalParent)],
        ["r3", makeRel("r3", "mom", "kid", RelationshipType.BiologicalParent)],
        ["r4", makeRel("r4", "dad", "kid", RelationshipType.AdoptiveParent)],
        ["r5", makeRel("r5", "gpa", "gma", RelationshipType.Partner)],
        ["r6", makeRel("r6", "mom", "dad", RelationshipType.Partner)],
      ]);
      const gens = new Map([
        ["gma", 0],
        ["gpa", 0],
        ["mom", 1],
        ["dad", 1],
        ["kid", 2],
      ]);

      const groups = computeSmartFilterGroups(persons, rels, gens);

      // Demographic
      const women = groups.demographic.find((g) => g.key === "gender:female")!;
      expect(women.personIds).toEqual(new Set(["gma", "mom"]));
      const men = groups.demographic.find((g) => g.key === "gender:male")!;
      expect(men.personIds).toEqual(new Set(["gpa", "dad", "kid"]));
      const adopted = groups.demographic.find((g) => g.key === "demographic:adopted")!;
      expect(adopted.personIds).toEqual(new Set(["kid"]));

      // Roles
      const parents = groups.roles.find((g) => g.key === "role:parents")!;
      expect(parents.personIds).toEqual(new Set(["gpa", "gma", "mom", "dad"]));
      const grandparents = groups.roles.find((g) => g.key === "role:grandparents")!;
      expect(grandparents.personIds).toEqual(new Set(["gpa", "gma"]));
      const partners = groups.roles.find((g) => g.key === "role:partners")!;
      expect(partners.personIds).toEqual(new Set(["gpa", "gma", "mom", "dad"]));

      // Generations
      expect(groups.generations).toHaveLength(3);
      expect(groups.generations[0].personIds).toEqual(new Set(["gma", "gpa"]));
      expect(groups.generations[1].personIds).toEqual(new Set(["mom", "dad"]));
      expect(groups.generations[2].personIds).toEqual(new Set(["kid"]));
    });
  });
});
