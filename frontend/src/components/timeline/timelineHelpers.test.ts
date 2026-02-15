import { describe, expect, it } from "vitest";
import type {
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import { LifeEventCategory, RelationshipType, TraumaCategory } from "../../types/domain";
import {
  assignBaseGenerations,
  buildChildToParentsMap,
  buildRowLayout,
  computeGenerations,
  computeTimeDomain,
  equalizePartnerGenerations,
  filterTimelinePersons,
  setTooltipLines,
} from "./timelineHelpers";

// ---- Test helpers ----

function makePerson(id: string, overrides: Partial<DecryptedPerson> = {}): DecryptedPerson {
  return {
    id,
    name: `Person ${id}`,
    birth_year: 1980,
    death_year: null,
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
    // Should not throw, cycle guard returns 0
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
    // parent1 bumped to 1, child should be 2
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
    // a and b are family-connected, c is friend-only
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
    expect(result.has("c")).toBe(false);
  });

  it("includes unconnected persons with no relationships", () => {
    const persons = personsMap(makePerson("a"), makePerson("b"), makePerson("loner"));
    const rels = relsMap(makeRel("r1", RelationshipType.BiologicalParent, "a", "b"));
    const result = filterTimelinePersons(persons, rels);
    // loner has no relationships at all, should be included
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
      [
        "e1",
        {
          id: "e1",
          person_ids: ["a"],
          title: "Event",
          description: "",
          category: TraumaCategory.Loss,
          approximate_date: "1920",
          severity: 5,
          tags: [],
        },
      ],
    ]);
    const { minYear } = computeTimeDomain(persons, events, new Map());
    expect(minYear).toBe(1915); // 1920 - 5
  });

  it("extends range for life events", () => {
    const persons = personsMap(makePerson("a", { birth_year: 1980 }));
    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      [
        "le1",
        {
          id: "le1",
          person_ids: ["a"],
          title: "Move",
          description: "",
          category: LifeEventCategory.Relocation,
          approximate_date: "1920",
          impact: null,
          tags: [],
        },
      ],
    ]);
    const { minYear } = computeTimeDomain(persons, new Map(), lifeEvents);
    expect(minYear).toBe(1915); // 1920 - 5
  });
});

// ---- setTooltipLines ----

describe("setTooltipLines", () => {
  it("creates spans with text content", () => {
    const div = document.createElement("div");
    setTooltipLines(div, [{ text: "Hello" }, { text: "World", bold: true }]);
    const spans = div.querySelectorAll("span");
    expect(spans).toHaveLength(2);
    expect(spans[0].textContent).toBe("Hello");
    expect(spans[1].textContent).toBe("World");
    expect(spans[1].style.fontWeight).toBe("600");
  });

  it("adds br between lines", () => {
    const div = document.createElement("div");
    setTooltipLines(div, [{ text: "A" }, { text: "B" }]);
    const brs = div.querySelectorAll("br");
    expect(brs).toHaveLength(1);
  });

  it("clears previous content", () => {
    const div = document.createElement("div");
    div.textContent = "old content";
    setTooltipLines(div, [{ text: "new" }]);
    expect(div.textContent).toBe("new");
  });
});
