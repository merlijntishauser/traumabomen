import { describe, expect, it } from "vitest";
import type { DecryptedPerson, DecryptedRelationship } from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";
import {
  assignBaseGenerations,
  buildChildToParentsMap,
  computeGenerations,
  equalizePartnerGenerations,
  filterTimelinePersons,
} from "./generations";

// ---- Test helpers ----

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
    gender: "unknown",
    is_adopted: false,
    notes: null,
    ...overrides,
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

function personsMap(...persons: DecryptedPerson[]): Map<string, DecryptedPerson> {
  return new Map(persons.map((p) => [p.id, p]));
}

function relsMap(...rels: DecryptedRelationship[]): Map<string, DecryptedRelationship> {
  return new Map(rels.map((r) => [r.id, r]));
}

// ---- buildChildToParentsMap ----

describe("buildChildToParentsMap", () => {
  it("returns empty map for no relationships", () => {
    expect(buildChildToParentsMap(new Map()).size).toBe(0);
  });

  it("maps child to biological parent", () => {
    const rels = relsMap(makeRel("r1", RelationshipType.BiologicalParent, "parent1", "child1"));
    const result = buildChildToParentsMap(rels);
    expect(result.get("child1")).toEqual(["parent1"]);
  });

  it("includes step and adoptive parents", () => {
    const rels = relsMap(
      makeRel("r1", RelationshipType.StepParent, "step", "child1"),
      makeRel("r2", RelationshipType.AdoptiveParent, "adopt", "child1"),
    );
    const result = buildChildToParentsMap(rels);
    expect(result.get("child1")).toHaveLength(2);
  });

  it("ignores non-parent relationships", () => {
    const rels = relsMap(makeRel("r1", RelationshipType.Partner, "a", "b"));
    expect(buildChildToParentsMap(rels).size).toBe(0);
  });
});

// ---- assignBaseGenerations ----

describe("assignBaseGenerations", () => {
  it("assigns generation 0 to root persons", () => {
    const persons = personsMap(makePerson("a"));
    const result = assignBaseGenerations(persons, new Map());
    expect(result.get("a")).toBe(0);
  });

  it("assigns generation 1 to children", () => {
    const persons = personsMap(makePerson("parent"), makePerson("child"));
    const childToParents = new Map([["child", ["parent"]]]);
    const result = assignBaseGenerations(persons, childToParents);
    expect(result.get("parent")).toBe(0);
    expect(result.get("child")).toBe(1);
  });

  it("handles cycles gracefully", () => {
    const persons = personsMap(makePerson("a"), makePerson("b"));
    const childToParents = new Map([
      ["a", ["b"]],
      ["b", ["a"]],
    ]);
    const result = assignBaseGenerations(persons, childToParents);
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
  });
});

// ---- equalizePartnerGenerations ----

describe("equalizePartnerGenerations", () => {
  it("equalizes partners to the same generation", () => {
    const gens = new Map([
      ["a", 0],
      ["b", 1],
    ]);
    const rels = relsMap(makeRel("r1", RelationshipType.Partner, "a", "b"));
    equalizePartnerGenerations(gens, rels, new Map());
    expect(gens.get("a")).toBe(gens.get("b"));
    expect(gens.get("a")).toBe(1);
  });

  it("propagates generation changes to children", () => {
    const gens = new Map([
      ["parent1", 0],
      ["parent2", 1],
      ["child", 1],
    ]);
    const rels = relsMap(makeRel("r1", RelationshipType.Partner, "parent1", "parent2"));
    const childToParents = new Map([["child", ["parent1"]]]);
    equalizePartnerGenerations(gens, rels, childToParents);
    expect(gens.get("parent1")).toBe(1);
    expect(gens.get("child")).toBe(2);
  });
});

// ---- computeGenerations ----

describe("computeGenerations", () => {
  it("returns empty map for no persons", () => {
    expect(computeGenerations(new Map(), new Map()).size).toBe(0);
  });

  it("assigns generations across family tree", () => {
    const persons = personsMap(
      makePerson("grandparent"),
      makePerson("parent"),
      makePerson("child"),
    );
    const rels = relsMap(
      makeRel("r1", RelationshipType.BiologicalParent, "grandparent", "parent"),
      makeRel("r2", RelationshipType.BiologicalParent, "parent", "child"),
    );
    const result = computeGenerations(persons, rels);
    expect(result.get("grandparent")).toBe(0);
    expect(result.get("parent")).toBe(1);
    expect(result.get("child")).toBe(2);
  });

  it("equalizes partner without parents to same generation as partner with parents", () => {
    // Scenario: grandparent -> father (gen 1), father's 2nd wife has no parents in tree
    const persons = personsMap(
      makePerson("grandparent"),
      makePerson("father"),
      makePerson("2nd_wife"),
      makePerson("child"),
    );
    const rels = relsMap(
      makeRel("r1", RelationshipType.BiologicalParent, "grandparent", "father"),
      makeRel("r2", RelationshipType.Partner, "father", "2nd_wife"),
      makeRel("r3", RelationshipType.BiologicalParent, "father", "child"),
    );
    const result = computeGenerations(persons, rels);
    expect(result.get("grandparent")).toBe(0);
    expect(result.get("father")).toBe(1);
    expect(result.get("2nd_wife")).toBe(1); // should match father, not gen 0
    expect(result.get("child")).toBe(2);
  });

  it("equalizes 2nd wife with full family tree (grandparents, mother, children)", () => {
    // Full scenario: grandparents -> father + mother -> child, father also has 2nd wife (no parents)
    const persons = personsMap(
      makePerson("gp1"),
      makePerson("gp2"),
      makePerson("father"),
      makePerson("mother"),
      makePerson("2nd_wife"),
      makePerson("child"),
    );
    const rels = relsMap(
      makeRel("r1", RelationshipType.BiologicalParent, "gp1", "father"),
      makeRel("r2", RelationshipType.BiologicalParent, "gp2", "father"),
      makeRel("r3", RelationshipType.Partner, "gp1", "gp2"),
      makeRel("r4", RelationshipType.Partner, "father", "mother"),
      makeRel("r5", RelationshipType.Partner, "father", "2nd_wife"),
      makeRel("r6", RelationshipType.BiologicalParent, "father", "child"),
      makeRel("r7", RelationshipType.BiologicalParent, "mother", "child"),
    );
    const result = computeGenerations(persons, rels);
    expect(result.get("gp1")).toBe(0);
    expect(result.get("gp2")).toBe(0);
    expect(result.get("father")).toBe(1);
    expect(result.get("mother")).toBe(1);
    expect(result.get("2nd_wife")).toBe(1); // should match father
    expect(result.get("child")).toBe(2);
  });

  it("equalizes step-parent partner to same generation", () => {
    // 2nd wife is step-parent to child
    const persons = personsMap(
      makePerson("gp1"),
      makePerson("father"),
      makePerson("2nd_wife"),
      makePerson("child"),
    );
    const rels = relsMap(
      makeRel("r1", RelationshipType.BiologicalParent, "gp1", "father"),
      makeRel("r2", RelationshipType.Partner, "father", "2nd_wife"),
      makeRel("r3", RelationshipType.StepParent, "2nd_wife", "child"),
      makeRel("r4", RelationshipType.BiologicalParent, "father", "child"),
    );
    const result = computeGenerations(persons, rels);
    expect(result.get("gp1")).toBe(0);
    expect(result.get("father")).toBe(1);
    expect(result.get("2nd_wife")).toBe(1);
    expect(result.get("child")).toBe(2);
  });

  it("handles partner relationship referencing a person not in the persons map", () => {
    const persons = personsMap(makePerson("a"));
    // "ghost" is in the partner relationship but not in the persons map
    const rels = relsMap(makeRel("r1", RelationshipType.Partner, "a", "ghost"));
    const result = computeGenerations(persons, rels);
    expect(result.get("a")).toBe(0);
    expect(result.has("ghost")).toBe(false);
  });

  it("handles parent relationship where parent is not in persons map", () => {
    const persons = personsMap(makePerson("child"));
    // "ghost-parent" is not in the persons map - gets filtered out in generation computation
    const rels = relsMap(makeRel("r1", RelationshipType.BiologicalParent, "ghost-parent", "child"));
    const result = computeGenerations(persons, rels);
    // Child is treated as if it has no parents (ghost filtered out)
    expect(result.has("child")).toBe(true);
  });

  it("handles child not in persons map referenced by parent relationship", () => {
    const persons = personsMap(makePerson("parent"));
    // Relationship references a child not in the persons map
    const rels = relsMap(makeRel("r1", RelationshipType.BiologicalParent, "parent", "ghost-child"));
    const result = computeGenerations(persons, rels);
    expect(result.get("parent")).toBe(0);
  });

  it("handles co-parents where one parent is missing from persons map", () => {
    const persons = personsMap(makePerson("parent"), makePerson("child"));
    // Two parents listed for child, but "ghost" isn't in the persons map
    const rels = relsMap(
      makeRel("r1", RelationshipType.BiologicalParent, "parent", "child"),
      makeRel("r2", RelationshipType.BiologicalParent, "ghost", "child"),
    );
    const result = computeGenerations(persons, rels);
    expect(result.get("parent")).toBe(0);
    expect(result.get("child")).toBe(1);
  });

  it("equalizes co-parents via step-parent without explicit partner relationship", () => {
    // 2nd wife is step-parent of child but has NO Partner relationship to father
    const persons = personsMap(
      makePerson("gp1"),
      makePerson("father"),
      makePerson("2nd_wife"),
      makePerson("child"),
    );
    const rels = relsMap(
      makeRel("r1", RelationshipType.BiologicalParent, "gp1", "father"),
      makeRel("r2", RelationshipType.BiologicalParent, "father", "child"),
      makeRel("r3", RelationshipType.StepParent, "2nd_wife", "child"),
    );
    const result = computeGenerations(persons, rels);
    expect(result.get("gp1")).toBe(0);
    expect(result.get("father")).toBe(1);
    expect(result.get("2nd_wife")).toBe(1); // co-parent equalization
    expect(result.get("child")).toBe(2);
  });
});

// ---- filterTimelinePersons ----

describe("filterTimelinePersons", () => {
  it("includes all persons when no relationships", () => {
    const persons = personsMap(makePerson("a"), makePerson("b"));
    const result = filterTimelinePersons(persons, new Map());
    expect(result.size).toBe(2);
  });

  it("excludes friend-only persons", () => {
    const persons = personsMap(makePerson("a"), makePerson("b"), makePerson("c"));
    const rels = relsMap(
      makeRel("r1", RelationshipType.BiologicalParent, "a", "b"),
      makeRel("r2", RelationshipType.Friend, "b", "c"),
    );
    const result = filterTimelinePersons(persons, rels);
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
    expect(result.has("c")).toBe(false);
  });

  it("includes unconnected persons with no relationships", () => {
    const persons = personsMap(makePerson("a"), makePerson("b"), makePerson("loner"));
    const rels = relsMap(makeRel("r1", RelationshipType.BiologicalParent, "a", "b"));
    const result = filterTimelinePersons(persons, rels);
    expect(result.has("loner")).toBe(true);
  });
});

// ---- buildRowLayout ----
