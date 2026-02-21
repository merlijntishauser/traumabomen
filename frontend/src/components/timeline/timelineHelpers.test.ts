import { describe, expect, it } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import {
  LifeEventCategory,
  RelationshipType,
  TraumaCategory,
  TurningPointCategory,
} from "../../types/domain";
import {
  AGE_LABEL_WIDTH,
  assignBaseGenerations,
  buildChildToParentsMap,
  buildColumnLayout,
  buildPersonDataMaps,
  buildRowLayout,
  computeAgeDomain,
  computeGenerations,
  computeTimeDomain,
  equalizePartnerGenerations,
  filterTimelinePersons,
  GEN_COL_GAP,
  LANE_WIDTH,
  MAX_LANE_WIDTH,
} from "./timelineHelpers";

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

function makeEvent(
  id: string,
  personIds: string[],
  overrides: Partial<DecryptedEvent> = {},
): DecryptedEvent {
  return {
    id,
    person_ids: personIds,
    title: `Event ${id}`,
    description: "",
    category: TraumaCategory.Loss,
    approximate_date: "2000",
    severity: 5,
    tags: [],
    ...overrides,
  };
}

function makeLifeEvent(
  id: string,
  personIds: string[],
  overrides: Partial<DecryptedLifeEvent> = {},
): DecryptedLifeEvent {
  return {
    id,
    person_ids: personIds,
    title: `LifeEvent ${id}`,
    description: "",
    category: LifeEventCategory.Career,
    approximate_date: "2000",
    impact: null,
    tags: [],
    ...overrides,
  };
}

function makeClassification(
  id: string,
  personIds: string[],
  overrides: Partial<DecryptedClassification> = {},
): DecryptedClassification {
  return {
    id,
    person_ids: personIds,
    dsm_category: "depressive",
    dsm_subcategory: null,
    status: "suspected",
    diagnosis_year: null,
    periods: [{ start_year: 2000, end_year: 2010 }],
    notes: null,
    ...overrides,
  };
}

function makeTurningPoint(
  id: string,
  personIds: string[],
  overrides: Partial<DecryptedTurningPoint> = {},
): DecryptedTurningPoint {
  return {
    id,
    person_ids: personIds,
    title: `TurningPoint ${id}`,
    description: "",
    category: TurningPointCategory.Recovery,
    approximate_date: "2000",
    significance: null,
    tags: [],
    ...overrides,
  };
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

describe("buildRowLayout", () => {
  it("creates rows sorted by generation", () => {
    const persons = personsMap(
      makePerson("parent", { birth_year: 1950 }),
      makePerson("child", { birth_year: 1980 }),
    );
    const rels = relsMap(makeRel("r1", RelationshipType.BiologicalParent, "parent", "child"));
    const layout = buildRowLayout(persons, rels, 400);

    expect(layout.rows).toHaveLength(2);
    expect(layout.rows[0].person.id).toBe("parent");
    expect(layout.rows[1].person.id).toBe("child");
    expect(layout.rows[0].generation).toBe(0);
    expect(layout.rows[1].generation).toBe(1);
  });

  it("sorts persons within generation by birth year", () => {
    const persons = personsMap(
      makePerson("b", { birth_year: 1990 }),
      makePerson("a", { birth_year: 1980 }),
    );
    const layout = buildRowLayout(persons, new Map(), 400);

    expect(layout.rows[0].person.id).toBe("a");
    expect(layout.rows[1].person.id).toBe("b");
  });

  it("computes totalHeight >= availableHeight", () => {
    const persons = personsMap(makePerson("a"));
    const layout = buildRowLayout(persons, new Map(), 1000);
    expect(layout.totalHeight).toBeGreaterThanOrEqual(1000);
  });
});

// ---- computeTimeDomain ----

describe("computeTimeDomain", () => {
  it("returns padded domain from birth/death years", () => {
    const persons = personsMap(
      makePerson("a", { birth_year: 1950, death_year: 2000 }),
      makePerson("b", { birth_year: 1980 }),
    );
    const { minYear, maxYear } = computeTimeDomain(persons, new Map(), new Map());
    expect(minYear).toBe(1945); // 1950 - 5
    expect(maxYear).toBeGreaterThan(2000); // current year + 5
  });

  it("extends range for events", () => {
    const persons = personsMap(makePerson("a", { birth_year: 1980 }));
    const events = new Map<string, DecryptedEvent>([
      ["e1", makeEvent("e1", ["a"], { approximate_date: "1920" })],
    ]);
    const { minYear } = computeTimeDomain(persons, events, new Map());
    expect(minYear).toBe(1915); // 1920 - 5
  });

  it("extends range for life events", () => {
    const persons = personsMap(makePerson("a", { birth_year: 1980 }));
    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      ["le1", makeLifeEvent("le1", ["a"], { approximate_date: "1920" })],
    ]);
    const { minYear } = computeTimeDomain(persons, new Map(), lifeEvents);
    expect(minYear).toBe(1915); // 1920 - 5
  });

  it("extends range for turning points", () => {
    const persons = personsMap(makePerson("a", { birth_year: 1980 }));
    const turningPoints = new Map<string, DecryptedTurningPoint>([
      ["tp1", makeTurningPoint("tp1", ["a"], { approximate_date: "1910" })],
    ]);
    const { minYear } = computeTimeDomain(persons, new Map(), new Map(), turningPoints);
    expect(minYear).toBe(1905); // 1910 - 5
  });

  it("works without turning points argument (backward compatible)", () => {
    const persons = personsMap(makePerson("a", { birth_year: 1980 }));
    const { minYear } = computeTimeDomain(persons, new Map(), new Map());
    expect(minYear).toBe(1975); // 1980 - 5
  });
});

// ---- buildPersonDataMaps ----

describe("buildPersonDataMaps", () => {
  it("returns empty maps for empty inputs", () => {
    const result = buildPersonDataMaps(new Map(), new Map(), new Map());
    expect(result.eventsByPerson.size).toBe(0);
    expect(result.lifeEventsByPerson.size).toBe(0);
    expect(result.classificationsByPerson.size).toBe(0);
  });

  it("groups events by person id", () => {
    const events = new Map<string, DecryptedEvent>([
      ["e1", makeEvent("e1", ["a"])],
      ["e2", makeEvent("e2", ["a", "b"])],
    ]);
    const result = buildPersonDataMaps(events, new Map(), new Map());
    expect(result.eventsByPerson.get("a")).toHaveLength(2);
    expect(result.eventsByPerson.get("b")).toHaveLength(1);
  });

  it("groups life events by person id", () => {
    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      ["le1", makeLifeEvent("le1", ["a"])],
      ["le2", makeLifeEvent("le2", ["b"])],
    ]);
    const result = buildPersonDataMaps(new Map(), lifeEvents, new Map());
    expect(result.lifeEventsByPerson.get("a")).toHaveLength(1);
    expect(result.lifeEventsByPerson.get("b")).toHaveLength(1);
  });

  it("groups classifications by person id", () => {
    const classifications = new Map<string, DecryptedClassification>([
      ["c1", makeClassification("c1", ["a", "b"])],
    ]);
    const result = buildPersonDataMaps(new Map(), new Map(), classifications);
    expect(result.classificationsByPerson.get("a")).toHaveLength(1);
    expect(result.classificationsByPerson.get("b")).toHaveLength(1);
  });

  it("handles multi-person events correctly", () => {
    const events = new Map<string, DecryptedEvent>([["e1", makeEvent("e1", ["a", "b", "c"])]]);
    const result = buildPersonDataMaps(events, new Map(), new Map());
    expect(result.eventsByPerson.get("a")).toHaveLength(1);
    expect(result.eventsByPerson.get("b")).toHaveLength(1);
    expect(result.eventsByPerson.get("c")).toHaveLength(1);
    // All three point to the same event object
    expect(result.eventsByPerson.get("a")![0]).toBe(result.eventsByPerson.get("b")![0]);
  });

  it("returns empty array for persons with no data", () => {
    const events = new Map<string, DecryptedEvent>([["e1", makeEvent("e1", ["a"])]]);
    const result = buildPersonDataMaps(events, new Map(), new Map());
    expect(result.eventsByPerson.get("b")).toBeUndefined();
    expect(result.lifeEventsByPerson.get("a")).toBeUndefined();
    expect(result.classificationsByPerson.get("a")).toBeUndefined();
  });

  it("returns empty turningPointsByPerson when no turning points provided", () => {
    const result = buildPersonDataMaps(new Map(), new Map(), new Map());
    expect(result.turningPointsByPerson.size).toBe(0);
  });

  it("groups turning points by person id", () => {
    const turningPoints = new Map<string, DecryptedTurningPoint>([
      ["tp1", makeTurningPoint("tp1", ["a"])],
      ["tp2", makeTurningPoint("tp2", ["a", "b"])],
    ]);
    const result = buildPersonDataMaps(new Map(), new Map(), new Map(), turningPoints);
    expect(result.turningPointsByPerson.get("a")).toHaveLength(2);
    expect(result.turningPointsByPerson.get("b")).toHaveLength(1);
  });

  it("handles multi-person turning points correctly", () => {
    const turningPoints = new Map<string, DecryptedTurningPoint>([
      ["tp1", makeTurningPoint("tp1", ["a", "b", "c"])],
    ]);
    const result = buildPersonDataMaps(new Map(), new Map(), new Map(), turningPoints);
    expect(result.turningPointsByPerson.get("a")).toHaveLength(1);
    expect(result.turningPointsByPerson.get("b")).toHaveLength(1);
    expect(result.turningPointsByPerson.get("c")).toHaveLength(1);
    expect(result.turningPointsByPerson.get("a")![0]).toBe(
      result.turningPointsByPerson.get("b")![0],
    );
  });
});

// ---- buildColumnLayout ----

describe("buildColumnLayout", () => {
  it("creates columns for a single generation", () => {
    const persons = personsMap(
      makePerson("a", { birth_year: 1980 }),
      makePerson("b", { birth_year: 1990 }),
    );
    const layout = buildColumnLayout(persons, new Map(), 800);

    expect(layout.columns).toHaveLength(2);
    expect(layout.sortedGens).toEqual([0]);
    expect(layout.columns[0].person.id).toBe("a");
    expect(layout.columns[1].person.id).toBe("b");
  });

  it("creates separate columns for multiple generations", () => {
    const persons = personsMap(
      makePerson("parent", { birth_year: 1950 }),
      makePerson("child", { birth_year: 1980 }),
    );
    const rels = relsMap(makeRel("r1", RelationshipType.BiologicalParent, "parent", "child"));
    const layout = buildColumnLayout(persons, rels, 800);

    expect(layout.sortedGens).toEqual([0, 1]);
    expect(layout.columns).toHaveLength(2);
    // Parent in gen 0, child in gen 1
    expect(layout.columns[0].generation).toBe(0);
    expect(layout.columns[1].generation).toBe(1);
  });

  it("positions columns with gap between generations", () => {
    const persons = personsMap(
      makePerson("parent", { birth_year: 1950 }),
      makePerson("child", { birth_year: 1980 }),
    );
    const rels = relsMap(makeRel("r1", RelationshipType.BiologicalParent, "parent", "child"));
    // Use a narrow width so lanes stay at LANE_WIDTH
    const narrowWidth = AGE_LABEL_WIDTH + 2 * LANE_WIDTH + GEN_COL_GAP;
    const layout = buildColumnLayout(persons, rels, narrowWidth);

    const gen0Start = layout.genStarts.get(0)!;
    const gen0Width = layout.genWidths.get(0)!;
    const gen1Start = layout.genStarts.get(1)!;

    expect(gen0Start).toBe(AGE_LABEL_WIDTH);
    expect(gen0Width).toBe(LANE_WIDTH);
    expect(gen1Start).toBe(AGE_LABEL_WIDTH + LANE_WIDTH + GEN_COL_GAP);
  });

  it("sorts persons within generation by birth year", () => {
    const persons = personsMap(
      makePerson("b", { birth_year: 1990 }),
      makePerson("a", { birth_year: 1980 }),
    );
    const layout = buildColumnLayout(persons, new Map(), 800);

    expect(layout.columns[0].person.id).toBe("a");
    expect(layout.columns[1].person.id).toBe("b");
  });

  it("returns totalWidth >= availableWidth", () => {
    const persons = personsMap(makePerson("a"));
    const layout = buildColumnLayout(persons, new Map(), 2000);
    expect(layout.totalWidth).toBeGreaterThanOrEqual(2000);
  });

  it("widens lanes when container is wider than minimum content", () => {
    const persons = personsMap(
      makePerson("a", { birth_year: 1980 }),
      makePerson("b", { birth_year: 1990 }),
    );
    // Minimum content: AGE_LABEL_WIDTH + 2 * LANE_WIDTH = 40 + 72 = 112 (single gen, no gap)
    // With availableWidth=800, extra = 688, effectiveLane = min(120, 36+344) = 120
    const layout = buildColumnLayout(persons, new Map(), 800);

    expect(layout.columns[0].laneWidth).toBe(MAX_LANE_WIDTH);
    expect(layout.columns[1].laneWidth).toBe(MAX_LANE_WIDTH);
    // Columns should be positioned using widened lanes
    expect(layout.columns[0].x).toBe(AGE_LABEL_WIDTH);
    expect(layout.columns[1].x).toBe(AGE_LABEL_WIDTH + MAX_LANE_WIDTH);
  });

  it("caps lane width at MAX_LANE_WIDTH", () => {
    const persons = personsMap(makePerson("a", { birth_year: 1980 }));
    // 1 person, very wide container
    const layout = buildColumnLayout(persons, new Map(), 5000);

    expect(layout.columns[0].laneWidth).toBe(MAX_LANE_WIDTH);
  });

  it("keeps LANE_WIDTH when container matches minimum content width", () => {
    const persons = personsMap(
      makePerson("a", { birth_year: 1980 }),
      makePerson("b", { birth_year: 1990 }),
    );
    const minWidth = AGE_LABEL_WIDTH + 2 * LANE_WIDTH;
    const layout = buildColumnLayout(persons, new Map(), minWidth);

    expect(layout.columns[0].laneWidth).toBe(LANE_WIDTH);
    expect(layout.columns[1].laneWidth).toBe(LANE_WIDTH);
  });
});

// ---- computeAgeDomain ----

describe("computeAgeDomain", () => {
  it("returns 0 to maxLifespan + 5", () => {
    const persons = personsMap(
      makePerson("a", { birth_year: 1950, death_year: 2020 }),
      makePerson("b", { birth_year: 1980, death_year: 2000 }),
    );
    const { minAge, maxAge } = computeAgeDomain(persons);
    expect(minAge).toBe(0);
    expect(maxAge).toBe(75); // 70 (2020-1950) + 5
  });

  it("uses current year for living persons", () => {
    const currentYear = new Date().getFullYear();
    const persons = personsMap(makePerson("a", { birth_year: 1980 }));
    const { maxAge } = computeAgeDomain(persons);
    expect(maxAge).toBe(currentYear - 1980 + 5);
  });

  it("returns 5 when all persons lack birth_year", () => {
    const persons = personsMap(makePerson("a", { birth_year: null }));
    const { minAge, maxAge } = computeAgeDomain(persons);
    expect(minAge).toBe(0);
    expect(maxAge).toBe(5);
  });
});
