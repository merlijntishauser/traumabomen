import { describe, expect, it } from "vitest";
import { buildDemoState } from "./buildDemoState";
import type { DemoFixture } from "./createDemoTree";

const FIXTURE: DemoFixture = {
  treeName: "Demo: Sandbox",
  persons: [
    {
      id: "p1",
      name: "Ada",
      birth_year: 1942,
      death_year: 1998,
      gender: "female",
      is_adopted: false,
      notes: "matriarch",
    },
    {
      id: "p2",
      name: "Ben",
      birth_year: 1970,
      death_year: null,
      gender: "male",
      is_adopted: true,
      notes: "",
    },
  ],
  relationships: [
    {
      id: "r1",
      source_person_id: "p1",
      target_person_id: "p2",
      type: "biological_parent",
      periods: [],
    },
    {
      id: "r2",
      source_person_id: "p1",
      target_person_id: "p2",
      type: "partner",
      periods: [{ start_year: 1965, end_year: null }],
    },
  ],
  events: [
    {
      id: "e1",
      person_ids: ["p1", "p2"],
      title: "Loss",
      description: "a loss",
      category: "loss",
      approximate_date: "1980",
      severity: 4,
      tags: ["a"],
    },
  ],
  lifeEvents: [
    {
      id: "le1",
      person_ids: ["p2"],
      title: "Graduated",
      description: "school",
      category: "education",
      approximate_date: "1988",
      impact: 3,
      tags: [],
    },
  ],
  turningPoints: [
    {
      id: "tp1",
      person_ids: ["p1"],
      title: "Moved",
      description: "a move",
      category: "relocation",
      approximate_date: "1975",
      significance: 5,
      tags: [],
    },
  ],
  classifications: [
    {
      id: "c1",
      person_ids: ["p2"],
      dsm_category: "Neurodevelopmental",
      dsm_subcategory: "",
      status: "suspected",
      diagnosis_year: null,
      periods: [{ start_year: 1990, end_year: 2000 }],
      notes: "",
    },
  ],
  patterns: [
    {
      id: "pat1",
      name: "Recurrence",
      description: "across generations",
      color: "#abc",
      person_ids: ["p1", "p2"],
      linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
    },
  ],
  siblingGroups: [
    {
      id: "sg1",
      person_ids: ["p2"],
      members: [{ name: "Cara", birth_year: 1972 }],
    },
  ],
};

describe("buildDemoState", () => {
  const state = buildDemoState(FIXTURE);

  it("keeps the tree name and maps every entity type by fixture id", () => {
    expect(state.treeName).toBe("Demo: Sandbox");
    expect([...state.persons.keys()]).toEqual(["p1", "p2"]);
    expect(state.relationships.size).toBe(2);
    expect(state.events.has("e1")).toBe(true);
    expect(state.lifeEvents.has("le1")).toBe(true);
    expect(state.turningPoints.has("tp1")).toBe(true);
    expect(state.classifications.has("c1")).toBe(true);
    expect(state.patterns.has("pat1")).toBe(true);
    expect(state.siblingGroups.has("sg1")).toBe(true);
  });

  it("fills person fields and nulls the month/day/cause not present in the fixture", () => {
    const ada = state.persons.get("p1");
    expect(ada).toMatchObject({
      id: "p1",
      name: "Ada",
      birth_year: 1942,
      death_year: 1998,
      gender: "female",
      is_adopted: false,
      notes: "matriarch",
    });
    expect(ada?.birth_month).toBeNull();
    expect(ada?.birth_day).toBeNull();
    expect(ada?.death_month).toBeNull();
    expect(ada?.death_day).toBeNull();
    expect(ada?.cause_of_death).toBeNull();
  });

  it("preserves relationship ends and defaults a missing period status to together", () => {
    const partner = state.relationships.get("r2");
    expect(partner?.source_person_id).toBe("p1");
    expect(partner?.target_person_id).toBe("p2");
    expect(partner?.active_period).toBeNull();
    expect(partner?.periods[0]).toMatchObject({ start_year: 1965, end_year: null });
    expect(partner?.periods[0]?.status).toBe("together");
  });

  it("keeps linked-entity person_ids so events resolve to their persons", () => {
    expect(state.events.get("e1")?.person_ids).toEqual(["p1", "p2"]);
    expect(state.lifeEvents.get("le1")?.person_ids).toEqual(["p2"]);
    expect(state.classifications.get("c1")?.person_ids).toEqual(["p2"]);
    expect(state.patterns.get("pat1")?.person_ids).toEqual(["p1", "p2"]);
  });

  it("coerces empty classification subcategory and notes to null", () => {
    const c = state.classifications.get("c1");
    expect(c?.dsm_subcategory).toBeNull();
    expect(c?.notes).toBeNull();
    expect(c?.status).toBe("suspected");
  });

  it("carries pattern links and sibling-group members through unchanged", () => {
    expect(state.patterns.get("pat1")?.linked_entities).toEqual([
      { entity_type: "trauma_event", entity_id: "e1" },
    ]);
    expect(state.siblingGroups.get("sg1")?.members).toEqual([{ name: "Cara", birth_year: 1972 }]);
  });
});
