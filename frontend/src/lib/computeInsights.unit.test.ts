import { describe, expect, it } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import { computeInsights, type InsightInput, parseYear } from "./computeInsights";

function makePerson(id: string, overrides: Partial<DecryptedPerson> = {}): DecryptedPerson {
  return {
    id,
    name: `Person ${id}`,
    birth_year: 1960,
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

function makeEvent(
  id: string,
  personIds: string[],
  category: string,
  date: string,
  severity = 5,
): DecryptedEvent {
  return {
    id,
    person_ids: personIds,
    title: `Event ${id}`,
    description: "",
    category: category as DecryptedEvent["category"],
    approximate_date: date,
    severity,
    tags: [],
  };
}

function makeTurningPoint(
  id: string,
  personIds: string[],
  category: string,
  date: string,
): DecryptedTurningPoint {
  return {
    id,
    person_ids: personIds,
    title: `TP ${id}`,
    description: "",
    category: category as DecryptedTurningPoint["category"],
    approximate_date: date,
    significance: 5,
    tags: [],
  };
}

function makeClassification(
  id: string,
  personIds: string[],
  dsmCategory: string,
  opts: Partial<DecryptedClassification> = {},
): DecryptedClassification {
  return {
    id,
    person_ids: personIds,
    dsm_category: dsmCategory,
    dsm_subcategory: null,
    status: "diagnosed",
    diagnosis_year: null,
    periods: [],
    notes: null,
    ...opts,
  };
}

function emptyInput(): InsightInput {
  return {
    persons: new Map(),
    events: new Map(),
    lifeEvents: new Map(),
    turningPoints: new Map(),
    classifications: new Map(),
    generations: new Map(),
  };
}

describe("parseYear", () => {
  it("parses a plain year", () => {
    expect(parseYear("1985")).toBe(1985);
  });

  it("parses the first year from a range", () => {
    expect(parseYear("1985-1990")).toBe(1985);
  });

  it("returns null for non-year text", () => {
    expect(parseYear("circa")).toBeNull();
    expect(parseYear("")).toBeNull();
  });
});

describe("computeInsights", () => {
  it("returns empty array for empty tree", () => {
    expect(computeInsights(emptyInput())).toEqual([]);
  });

  it("returns empty array for tree below thresholds", () => {
    const input = emptyInput();
    const p = makePerson("p1");
    input.persons.set("p1", p);
    input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1990"));
    input.generations.set("p1", 0);

    const insights = computeInsights(input);
    // Only one event, one person: below all thresholds
    expect(insights).toEqual([]);
  });

  describe("generational patterns", () => {
    it("detects trauma category across 2+ generations", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1", { birth_year: 1940 }));
      input.persons.set("p2", makePerson("p2", { birth_year: 1970 }));
      input.events.set("e1", makeEvent("e1", ["p1"], "addiction", "1970"));
      input.events.set("e2", makeEvent("e2", ["p2"], "addiction", "2000"));
      input.generations.set("p1", 0);
      input.generations.set("p2", 1);

      const insights = computeInsights(input);
      const gen = insights.filter((i) => i.category === "generational");
      expect(gen.length).toBeGreaterThanOrEqual(1);
      expect(gen[0].titleKey).toBe("insights.categoryAcrossGenerations");
      expect(gen[0].titleValues.count).toBe(2);
    });

    it("detects addiction across 3 generations", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.persons.set("p2", makePerson("p2"));
      input.persons.set("p3", makePerson("p3"));
      input.events.set("e1", makeEvent("e1", ["p1"], "addiction", "1960"));
      input.events.set("e2", makeEvent("e2", ["p2"], "addiction", "1985"));
      input.events.set("e3", makeEvent("e3", ["p3"], "addiction", "2010"));
      input.generations.set("p1", 0);
      input.generations.set("p2", 1);
      input.generations.set("p3", 2);

      const insights = computeInsights(input);
      const gen = insights.find((i) => i.titleKey === "insights.categoryAcrossGenerations");
      expect(gen).toBeDefined();
      expect(gen!.titleValues.count).toBe(3);
    });

    it("does not produce insight for single-generation tree", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.persons.set("p2", makePerson("p2"));
      input.events.set("e1", makeEvent("e1", ["p1"], "addiction", "1970"));
      input.events.set("e2", makeEvent("e2", ["p2"], "addiction", "1975"));
      input.generations.set("p1", 0);
      input.generations.set("p2", 0);

      const insights = computeInsights(input);
      const gen = insights.filter((i) => i.titleKey === "insights.categoryAcrossGenerations");
      expect(gen).toHaveLength(0);
    });

    it("detects classification across 2 generations", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.persons.set("p2", makePerson("p2"));
      input.classifications.set(
        "c1",
        makeClassification("c1", ["p1"], "anxiety", { dsm_subcategory: "generalized_anxiety" }),
      );
      input.classifications.set(
        "c2",
        makeClassification("c2", ["p2"], "anxiety", { dsm_subcategory: "generalized_anxiety" }),
      );
      input.generations.set("p1", 0);
      input.generations.set("p2", 1);

      const insights = computeInsights(input);
      const cls = insights.find((i) => i.titleKey === "insights.classificationAcrossGenerations");
      expect(cls).toBeDefined();
      expect(cls!.titleValues.count).toBe(2);
    });
  });

  describe("temporal clustering", () => {
    it("detects age clustering when SD < 10", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1", { birth_year: 1950 }));
      input.persons.set("p2", makePerson("p2", { birth_year: 1955 }));
      input.persons.set("p3", makePerson("p3", { birth_year: 1960 }));
      // Ages at event: 32, 35, 37 (SD ~2.05)
      input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1982"));
      input.events.set("e2", makeEvent("e2", ["p2"], "loss", "1990"));
      input.events.set("e3", makeEvent("e3", ["p3"], "loss", "1997"));
      input.generations.set("p1", 0);
      input.generations.set("p2", 0);
      input.generations.set("p3", 0);

      const insights = computeInsights(input);
      const temporal = insights.find((i) => i.titleKey === "insights.ageClustering");
      expect(temporal).toBeDefined();
    });

    it("does not produce clustering when events are spread", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1", { birth_year: 1950 }));
      input.persons.set("p2", makePerson("p2", { birth_year: 1950 }));
      input.persons.set("p3", makePerson("p3", { birth_year: 1950 }));
      // Ages at event: 10, 40, 70 (SD ~24.5)
      input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1960"));
      input.events.set("e2", makeEvent("e2", ["p2"], "loss", "1990"));
      input.events.set("e3", makeEvent("e3", ["p3"], "loss", "2020"));
      input.generations.set("p1", 0);
      input.generations.set("p2", 0);
      input.generations.set("p3", 0);

      const insights = computeInsights(input);
      const temporal = insights.find((i) => i.titleKey === "insights.ageClustering");
      expect(temporal).toBeUndefined();
    });

    it("detects dense year window", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      // 3 events in a 5-year window (100% in 20-year window)
      input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1980"));
      input.events.set("e2", makeEvent("e2", ["p1"], "abuse", "1982"));
      input.events.set("e3", makeEvent("e3", ["p1"], "illness", "1985"));
      input.generations.set("p1", 0);

      const insights = computeInsights(input);
      const dense = insights.find((i) => i.titleKey === "insights.denseYearWindow");
      expect(dense).toBeDefined();
    });

    it("skips classification when person has no birth year for diagnosis age", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1", { birth_year: null }));
      input.persons.set("p2", makePerson("p2", { birth_year: 1970 }));
      input.persons.set("p3", makePerson("p3", { birth_year: 1975 }));
      input.classifications.set(
        "c1",
        makeClassification("c1", ["p1"], "anxiety", { diagnosis_year: 1990 }),
      );
      input.classifications.set(
        "c2",
        makeClassification("c2", ["p2"], "depressive", { diagnosis_year: 2000 }),
      );
      input.classifications.set(
        "c3",
        makeClassification("c3", ["p3"], "depressive", { diagnosis_year: 2005 }),
      );
      input.generations.set("p1", 0);
      input.generations.set("p2", 1);
      input.generations.set("p3", 1);

      const insights = computeInsights(input);
      const avg = insights.find((i) => i.titleKey === "insights.averageDiagnosisAge");
      expect(avg).toBeDefined();
      // p1 skipped (no birth_year), only p2 (age 30) and p3 (age 30)
      expect(avg!.titleValues.age).toBe(30);
      expect(avg!.detailValues.count).toBe(2);
    });

    it("produces average diagnosis age from 2+ persons", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1", { birth_year: 1960 }));
      input.persons.set("p2", makePerson("p2", { birth_year: 1970 }));
      input.classifications.set(
        "c1",
        makeClassification("c1", ["p1"], "anxiety", { diagnosis_year: 1990 }),
      );
      input.classifications.set(
        "c2",
        makeClassification("c2", ["p2"], "depressive", { diagnosis_year: 2000 }),
      );
      input.generations.set("p1", 0);
      input.generations.set("p2", 1);

      const insights = computeInsights(input);
      const avg = insights.find((i) => i.titleKey === "insights.averageDiagnosisAge");
      expect(avg).toBeDefined();
      expect(avg!.titleValues.age).toBe(30); // (30 + 30) / 2
    });
  });

  describe("category summaries", () => {
    it("finds most common category with 3+ events", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1980"));
      input.events.set("e2", makeEvent("e2", ["p1"], "loss", "1985"));
      input.events.set("e3", makeEvent("e3", ["p1"], "abuse", "1990"));
      input.generations.set("p1", 0);

      const insights = computeInsights(input);
      const summary = insights.find((i) => i.titleKey === "insights.mostCommonCategory");
      expect(summary).toBeDefined();
      expect(summary!.titleValues.count).toBe(2);
    });

    it("does not produce most common with fewer than 3 events", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1980"));
      input.events.set("e2", makeEvent("e2", ["p1"], "abuse", "1985"));
      input.generations.set("p1", 0);

      const insights = computeInsights(input);
      const summary = insights.find((i) => i.titleKey === "insights.mostCommonCategory");
      expect(summary).toBeUndefined();
    });

    it("detects shared classification across 2+ persons", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.persons.set("p2", makePerson("p2"));
      input.classifications.set("c1", makeClassification("c1", ["p1"], "anxiety"));
      input.classifications.set("c2", makeClassification("c2", ["p2"], "anxiety"));
      input.generations.set("p1", 0);
      input.generations.set("p2", 1);

      const insights = computeInsights(input);
      const shared = insights.find((i) => i.titleKey === "insights.sharedClassification");
      expect(shared).toBeDefined();
      expect(shared!.titleValues.count).toBe(2);
    });

    it("shows total event count with 5+ events", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.persons.set("p2", makePerson("p2"));
      for (let i = 1; i <= 5; i++) {
        input.events.set(`e${i}`, makeEvent(`e${i}`, ["p1"], "loss", `${1980 + i}`));
      }
      input.generations.set("p1", 0);
      input.generations.set("p2", 1);

      const insights = computeInsights(input);
      const total = insights.find((i) => i.titleKey === "insights.totalEvents");
      expect(total).toBeDefined();
      expect(total!.titleValues.events).toBe(5);
    });
  });

  describe("resilience indicators", () => {
    it("detects turning point following trauma within 5 years", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1990"));
      input.turningPoints.set("tp1", makeTurningPoint("tp1", ["p1"], "recovery", "1993"));
      input.generations.set("p1", 0);

      const insights = computeInsights(input);
      const res = insights.find((i) => i.titleKey === "insights.turningPointsFollowTrauma");
      expect(res).toBeDefined();
      expect(res!.titleValues.count).toBe(1);
    });

    it("does not count turning point with unparseable date", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1990"));
      input.turningPoints.set("tp1", makeTurningPoint("tp1", ["p1"], "recovery", "unknown"));
      input.generations.set("p1", 0);

      const insights = computeInsights(input);
      const res = insights.find((i) => i.titleKey === "insights.turningPointsFollowTrauma");
      expect(res).toBeUndefined();
    });

    it("does not count turning point with no person ids", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1990"));
      input.turningPoints.set("tp1", makeTurningPoint("tp1", [], "recovery", "1993"));
      input.generations.set("p1", 0);

      const insights = computeInsights(input);
      const res = insights.find((i) => i.titleKey === "insights.turningPointsFollowTrauma");
      expect(res).toBeUndefined();
    });

    it("does not count turning point before trauma event", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1990"));
      input.turningPoints.set("tp1", makeTurningPoint("tp1", ["p1"], "recovery", "1985"));
      input.generations.set("p1", 0);

      const insights = computeInsights(input);
      const res = insights.find((i) => i.titleKey === "insights.turningPointsFollowTrauma");
      expect(res).toBeUndefined();
    });

    it("skips trauma events belonging to a different person", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.persons.set("p2", makePerson("p2"));
      // Trauma event belongs to p2, turning point belongs to p1
      input.events.set("e1", makeEvent("e1", ["p2"], "loss", "1990"));
      input.turningPoints.set("tp1", makeTurningPoint("tp1", ["p1"], "recovery", "1993"));
      input.generations.set("p1", 0);
      input.generations.set("p2", 0);

      const insights = computeInsights(input);
      const res = insights.find((i) => i.titleKey === "insights.turningPointsFollowTrauma");
      expect(res).toBeUndefined();
    });

    it("does not count turning point 10 years after trauma", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.events.set("e1", makeEvent("e1", ["p1"], "loss", "1980"));
      input.turningPoints.set("tp1", makeTurningPoint("tp1", ["p1"], "recovery", "1991"));
      input.generations.set("p1", 0);

      const insights = computeInsights(input);
      const res = insights.find((i) => i.titleKey === "insights.turningPointsFollowTrauma");
      expect(res).toBeUndefined();
    });

    it("detects cycle-breaking in 2+ generations", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.persons.set("p2", makePerson("p2"));
      input.turningPoints.set("tp1", makeTurningPoint("tp1", ["p1"], "cycle_breaking", "1990"));
      input.turningPoints.set("tp2", makeTurningPoint("tp2", ["p2"], "cycle_breaking", "2015"));
      input.generations.set("p1", 0);
      input.generations.set("p2", 1);

      const insights = computeInsights(input);
      const cycle = insights.find((i) => i.titleKey === "insights.cycleBreakingGenerations");
      expect(cycle).toBeDefined();
      expect(cycle!.titleValues.count).toBe(2);
    });

    it("finds most common turning point category with 3+", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.turningPoints.set("tp1", makeTurningPoint("tp1", ["p1"], "recovery", "1990"));
      input.turningPoints.set("tp2", makeTurningPoint("tp2", ["p1"], "recovery", "1995"));
      input.turningPoints.set("tp3", makeTurningPoint("tp3", ["p1"], "achievement", "2000"));
      input.generations.set("p1", 0);

      const insights = computeInsights(input);
      const tp = insights.find((i) => i.titleKey === "insights.mostCommonTurningPoint");
      expect(tp).toBeDefined();
      expect(tp!.titleValues.count).toBe(2);
    });
  });

  describe("priority sorting", () => {
    it("sorts generational insights above summary insights", () => {
      const input = emptyInput();
      input.persons.set("p1", makePerson("p1"));
      input.persons.set("p2", makePerson("p2"));
      input.persons.set("p3", makePerson("p3"));
      // Generational: addiction across 2 gens
      input.events.set("e1", makeEvent("e1", ["p1"], "addiction", "1970"));
      input.events.set("e2", makeEvent("e2", ["p2"], "addiction", "2000"));
      // Summary: 3+ events for most common category
      input.events.set("e3", makeEvent("e3", ["p1"], "loss", "1975"));
      input.events.set("e4", makeEvent("e4", ["p3"], "loss", "1980"));
      input.events.set("e5", makeEvent("e5", ["p3"], "loss", "1985"));
      input.generations.set("p1", 0);
      input.generations.set("p2", 1);
      input.generations.set("p3", 0);

      const insights = computeInsights(input);
      const genIdx = insights.findIndex((i) => i.category === "generational");
      const sumIdx = insights.findIndex((i) => i.category === "summary");
      expect(genIdx).toBeLessThan(sumIdx);
    });
  });
});
