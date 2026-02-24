import { describe, expect, it } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import type { LinkedEntity } from "../types/domain";
import {
  buildPersonEntityGroups,
  derivePersonIds,
  type EntityMaps,
  resolveLinkedEntity,
} from "./patternEntities";

const t = (key: string) => key;

function makePerson(id: string, name: string): DecryptedPerson {
  return {
    id,
    name,
    birth_year: 1980,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "female",
    is_adopted: false,
    notes: null,
  };
}

function makeEvent(id: string, title: string, personIds: string[]): DecryptedEvent {
  return {
    id,
    title,
    description: "",
    category: "loss",
    approximate_date: "",
    severity: 5,
    tags: [],
    person_ids: personIds,
  };
}

function makeLifeEvent(id: string, title: string, personIds: string[]): DecryptedLifeEvent {
  return {
    id,
    title,
    description: "",
    category: "family",
    approximate_date: "",
    impact: 3,
    tags: [],
    person_ids: personIds,
  };
}

function makeTurningPoint(id: string, title: string, personIds: string[]): DecryptedTurningPoint {
  return {
    id,
    title,
    description: "",
    category: "cycle_breaking",
    approximate_date: "",
    significance: 7,
    tags: [],
    person_ids: personIds,
  };
}

function makeClassification(
  id: string,
  personIds: string[],
  overrides: Partial<DecryptedClassification> = {},
): DecryptedClassification {
  return {
    id,
    dsm_category: "anxiety",
    dsm_subcategory: null,
    status: "suspected",
    diagnosis_year: null,
    periods: [],
    notes: null,
    person_ids: personIds,
    ...overrides,
  };
}

function emptyMaps(): EntityMaps {
  return {
    events: new Map(),
    lifeEvents: new Map(),
    turningPoints: new Map(),
    classifications: new Map(),
    persons: new Map(),
  };
}

describe("resolveLinkedEntity", () => {
  it("resolves a trauma event", () => {
    const maps = emptyMaps();
    maps.events.set("e1", makeEvent("e1", "Loss of parent", ["p1"]));
    maps.persons.set("p1", makePerson("p1", "Alice"));

    const result = resolveLinkedEntity({ entity_type: "trauma_event", entity_id: "e1" }, maps, t);
    expect(result.label).toBe("Loss of parent");
    expect(result.personName).toBe("Alice");
    expect(result.personId).toBe("p1");
  });

  it("resolves a life event", () => {
    const maps = emptyMaps();
    maps.lifeEvents.set("le1", makeLifeEvent("le1", "Moved abroad", ["p2"]));
    maps.persons.set("p2", makePerson("p2", "Bob"));

    const result = resolveLinkedEntity({ entity_type: "life_event", entity_id: "le1" }, maps, t);
    expect(result.label).toBe("Moved abroad");
    expect(result.personName).toBe("Bob");
  });

  it("resolves a turning point", () => {
    const maps = emptyMaps();
    maps.turningPoints.set("tp1", makeTurningPoint("tp1", "Started therapy", ["p1"]));
    maps.persons.set("p1", makePerson("p1", "Alice"));

    const result = resolveLinkedEntity({ entity_type: "turning_point", entity_id: "tp1" }, maps, t);
    expect(result.label).toBe("Started therapy");
  });

  it("resolves a classification with subcategory", () => {
    const maps = emptyMaps();
    maps.classifications.set("c1", makeClassification("c1", ["p1"], { dsm_subcategory: "adhd" }));
    maps.persons.set("p1", makePerson("p1", "Alice"));

    const result = resolveLinkedEntity({ entity_type: "classification", entity_id: "c1" }, maps, t);
    expect(result.label).toBe("dsm.sub.adhd");
  });

  it("resolves a classification without subcategory", () => {
    const maps = emptyMaps();
    maps.classifications.set("c2", makeClassification("c2", ["p1"]));
    maps.persons.set("p1", makePerson("p1", "Alice"));

    const result = resolveLinkedEntity({ entity_type: "classification", entity_id: "c2" }, maps, t);
    expect(result.label).toBe("dsm.anxiety");
  });

  it("returns fallback for unknown entity type", () => {
    const maps = emptyMaps();
    const result = resolveLinkedEntity(
      { entity_type: "unknown" as LinkedEntity["entity_type"], entity_id: "x" },
      maps,
      t,
    );
    expect(result.label).toBe("?");
    expect(result.personName).toBe("");
    expect(result.personId).toBe("");
  });

  it("returns fallback label for missing entity", () => {
    const maps = emptyMaps();
    const result = resolveLinkedEntity({ entity_type: "trauma_event", entity_id: "nope" }, maps, t);
    expect(result.label).toBe("?");
  });
});

describe("derivePersonIds", () => {
  it("collects person IDs from mixed entity types", () => {
    const maps = emptyMaps();
    maps.events.set("e1", makeEvent("e1", "X", ["p1", "p2"]));
    maps.lifeEvents.set("le1", makeLifeEvent("le1", "Y", ["p2", "p3"]));

    const entities: LinkedEntity[] = [
      { entity_type: "trauma_event", entity_id: "e1" },
      { entity_type: "life_event", entity_id: "le1" },
    ];
    const ids = derivePersonIds(entities, maps);
    expect(ids.sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("deduplicates person IDs", () => {
    const maps = emptyMaps();
    maps.events.set("e1", makeEvent("e1", "X", ["p1"]));
    maps.events.set("e2", makeEvent("e2", "Y", ["p1"]));

    const entities: LinkedEntity[] = [
      { entity_type: "trauma_event", entity_id: "e1" },
      { entity_type: "trauma_event", entity_id: "e2" },
    ];
    expect(derivePersonIds(entities, maps)).toEqual(["p1"]);
  });

  it("returns empty for missing entities", () => {
    const maps = emptyMaps();
    const entities: LinkedEntity[] = [{ entity_type: "trauma_event", entity_id: "nope" }];
    expect(derivePersonIds(entities, maps)).toEqual([]);
  });
});

describe("buildPersonEntityGroups", () => {
  it("groups entities by person, sorted by name", () => {
    const maps = emptyMaps();
    maps.events.set("e1", makeEvent("e1", "Loss", ["p2"]));
    maps.lifeEvents.set("le1", makeLifeEvent("le1", "Moved", ["p1"]));
    maps.persons.set("p1", makePerson("p1", "Alice"));
    maps.persons.set("p2", makePerson("p2", "Bob"));

    const groups = buildPersonEntityGroups(maps, t);
    expect(groups).toHaveLength(2);
    expect(groups[0].personName).toBe("Alice");
    expect(groups[0].entities).toEqual([{ type: "life_event", id: "le1", label: "Moved" }]);
    expect(groups[1].personName).toBe("Bob");
    expect(groups[1].entities).toEqual([{ type: "trauma_event", id: "e1", label: "Loss" }]);
  });

  it("includes turning points and classifications", () => {
    const maps = emptyMaps();
    maps.turningPoints.set("tp1", makeTurningPoint("tp1", "Recovery", ["p1"]));
    maps.classifications.set("c1", makeClassification("c1", ["p1"]));
    maps.persons.set("p1", makePerson("p1", "Alice"));

    const groups = buildPersonEntityGroups(maps, t);
    expect(groups).toHaveLength(1);
    expect(groups[0].entities).toHaveLength(2);
    expect(groups[0].entities.map((e) => e.type).sort()).toEqual([
      "classification",
      "turning_point",
    ]);
  });

  it("returns empty array for empty maps", () => {
    expect(buildPersonEntityGroups(emptyMaps(), t)).toEqual([]);
  });
});
