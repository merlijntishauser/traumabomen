import { describe, expect, it } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import { LifeEventCategory, TraumaCategory, TurningPointCategory } from "../types/domain";
import {
  buildLifelineEntries,
  buildLifelineRows,
  classificationEndYear,
  classificationStartYear,
} from "./lifeline";

function trauma(id: string, date: string): DecryptedEvent {
  return {
    id,
    person_ids: ["p1"],
    title: id,
    description: "",
    category: TraumaCategory.Loss,
    approximate_date: date,
    severity: 5,
    tags: [],
  };
}

function life(id: string, date: string): DecryptedLifeEvent {
  return {
    id,
    person_ids: ["p1"],
    title: id,
    description: "",
    category: LifeEventCategory.Family,
    approximate_date: date,
    impact: null,
    tags: [],
  };
}

function turning(id: string, date: string): DecryptedTurningPoint {
  return {
    id,
    person_ids: ["p1"],
    title: id,
    description: "",
    category: TurningPointCategory.Recovery,
    approximate_date: date,
    significance: null,
    tags: [],
  };
}

function cls(
  id: string,
  periods: { start_year: number; end_year: number | null }[],
  diagnosis_year: number | null = null,
): DecryptedClassification {
  return {
    id,
    person_ids: ["p1"],
    dsm_category: "depressive",
    dsm_subcategory: null,
    status: "suspected",
    diagnosis_year,
    periods,
    notes: null,
  };
}

const none = { events: [], lifeEvents: [], turningPoints: [], classifications: [] };

describe("classificationStartYear", () => {
  it("uses the earliest period start", () => {
    expect(
      classificationStartYear(
        cls("c", [
          { start_year: 1970, end_year: 1980 },
          { start_year: 1962, end_year: 1964 },
        ]),
      ),
    ).toBe(1962);
  });

  it("falls back to the diagnosis year without periods", () => {
    expect(classificationStartYear(cls("c", [], 1990))).toBe(1990);
  });

  it("is null with neither", () => {
    expect(classificationStartYear(cls("c", []))).toBeNull();
  });
});

describe("classificationEndYear", () => {
  it("uses the latest period end", () => {
    expect(
      classificationEndYear(
        cls("c", [
          { start_year: 1960, end_year: 1964 },
          { start_year: 1970, end_year: 1975 },
        ]),
      ),
    ).toBe(1975);
  });

  it("is null when a period is ongoing", () => {
    expect(
      classificationEndYear(
        cls("c", [
          { start_year: 1960, end_year: 1964 },
          { start_year: 1970, end_year: null },
        ]),
      ),
    ).toBeNull();
  });

  it("is null without periods", () => {
    expect(classificationEndYear(cls("c", [], 1990))).toBeNull();
  });
});

describe("buildLifelineEntries", () => {
  it("returns nothing for a person with nothing recorded", () => {
    expect(buildLifelineEntries(none)).toEqual([]);
  });

  it("orders entries of every kind by year", () => {
    const entries = buildLifelineEntries({
      events: [trauma("t1990", "1990")],
      lifeEvents: [life("l1960", "around 1960")],
      turningPoints: [turning("tp2000", "2000-2002")],
      classifications: [cls("c1975", [{ start_year: 1975, end_year: null }])],
    });
    expect(entries.map((e) => e.id)).toEqual(["l1960", "c1975", "t1990", "tp2000"]);
    expect(entries.map((e) => e.year)).toEqual([1960, 1975, 1990, 2000]);
  });

  it("orders entries in the same year by kind: trauma, life, classification, turning point", () => {
    const entries = buildLifelineEntries({
      events: [trauma("t", "1958")],
      lifeEvents: [life("l", "1958")],
      turningPoints: [turning("tp", "1958")],
      classifications: [cls("c", [], 1958)],
    });
    expect(entries.map((e) => e.kind)).toEqual([
      "trauma_event",
      "life_event",
      "classification",
      "turning_point",
    ]);
  });

  it("puts entries without a readable year last", () => {
    const entries = buildLifelineEntries({
      ...none,
      events: [trauma("undated", "childhood"), trauma("dated", "1980")],
    });
    expect(entries.map((e) => e.id)).toEqual(["dated", "undated"]);
    expect(entries[1].year).toBeNull();
  });

  it("carries a classification's end year", () => {
    const [entry] = buildLifelineEntries({
      ...none,
      classifications: [cls("c", [{ start_year: 1958, end_year: 1964 }])],
    });
    expect(entry).toMatchObject({ kind: "classification", year: 1958, endYear: 1964 });
  });
});

describe("buildLifelineRows", () => {
  it("frames the entries with birth and death", () => {
    const entries = buildLifelineEntries({ ...none, events: [trauma("t", "1944")] });
    const { rows } = buildLifelineRows(entries, 1927, 2011);
    expect(rows.map((r) => r.type)).toEqual(["birth", "entry", "death"]);
    expect(rows[0]).toEqual({ type: "birth", year: 1927 });
    expect(rows[2]).toEqual({ type: "death", year: 2011 });
  });

  it("leaves out birth and death when unknown", () => {
    const entries = buildLifelineEntries({ ...none, events: [trauma("t", "1944")] });
    expect(buildLifelineRows(entries, null, null).rows.map((r) => r.type)).toEqual(["entry"]);
  });

  it("names a silence of fifteen years or more between entries", () => {
    const entries = buildLifelineEntries({
      ...none,
      events: [trauma("a", "1971"), trauma("b", "1989"), trauma("c", "2003")],
    });
    const { rows } = buildLifelineRows(entries, null, null);
    expect(rows.map((r) => r.type)).toEqual(["entry", "gap", "entry", "entry"]);
    expect(rows[1]).toEqual({ type: "gap", years: 18, fromYear: 1971 });
  });

  it("does not count the stretch after birth as a gap", () => {
    const entries = buildLifelineEntries({ ...none, events: [trauma("t", "1990")] });
    expect(buildLifelineRows(entries, 1927, null).rows.map((r) => r.type)).toEqual([
      "birth",
      "entry",
    ]);
  });

  it("returns undated entries separately", () => {
    const entries = buildLifelineEntries({
      ...none,
      events: [trauma("dated", "1980"), trauma("undated", "")],
    });
    const { rows, undated } = buildLifelineRows(entries, null, null);
    expect(rows).toHaveLength(1);
    expect(undated.map((e) => e.id)).toEqual(["undated"]);
  });
});
