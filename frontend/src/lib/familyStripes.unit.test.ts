import { describe, expect, it } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import { LifeEventCategory, TraumaCategory, TurningPointCategory } from "../types/domain";
import {
  ageDomainSpan,
  buildStripeEntries,
  buildStripeLayout,
  busiestValue,
  clipSpan,
  coversYear,
  entriesByPerson,
  firstName,
  keyOf,
  lastYearOf,
  matchEntry,
  matchKey,
  readAt,
  type StripeEntry,
  sharedSurname,
  spanAt,
  stripeColor,
  traumaRuns,
  undatedByPerson,
  undatedEntries,
  yearDomainStart,
} from "./familyStripes";

const NOW = 2026;

function person(id: string, birth: number | null, death: number | null = null): DecryptedPerson {
  return {
    id,
    name: id,
    birth_year: birth,
    birth_month: null,
    birth_day: null,
    death_year: death,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "female",
    is_adopted: false,
    notes: null,
  };
}

function entry(partial: Partial<StripeEntry> & { id: string }): StripeEntry {
  return {
    kind: "trauma_event",
    category: "loss",
    title: partial.id,
    personIds: ["a"],
    spans: [{ from: 2000, to: 2000 }],
    approx: false,
    ...partial,
  };
}

function trauma(id: string, date: string, people = ["a"]): DecryptedEvent {
  return {
    id,
    person_ids: people,
    title: id,
    description: "",
    category: TraumaCategory.War,
    approximate_date: date,
    severity: 5,
    tags: [],
  };
}

describe("buildStripeEntries", () => {
  const life: DecryptedLifeEvent = {
    id: "l1",
    person_ids: ["a"],
    title: "Married",
    description: "",
    category: LifeEventCategory.Family,
    approximate_date: "1980",
    impact: null,
    tags: [],
  };
  const tp: DecryptedTurningPoint = {
    id: "tp1",
    person_ids: ["a"],
    title: "Started therapy",
    description: "",
    category: TurningPointCategory.Recovery,
    approximate_date: "2001",
    significance: null,
    tags: [],
  };
  const cls = (
    id: string,
    periods: DecryptedClassification["periods"],
    diagnosis: number | null,
  ): DecryptedClassification => ({
    id,
    person_ids: ["a"],
    dsm_category: "depressive",
    dsm_subcategory: null,
    status: "diagnosed",
    diagnosis_year: diagnosis,
    periods,
    notes: null,
  });

  it("turns every dated entry into a stripe and skips undated ones", () => {
    const out = buildStripeEntries(
      {
        events: new Map([
          ["t1", trauma("t1", "1944")],
          ["t2", trauma("t2", "after the war")],
        ]),
        lifeEvents: new Map([["l1", life]]),
        turningPoints: new Map([["tp1", tp]]),
        classifications: new Map([
          ["c1", cls("c1", [{ start_year: 1997, end_year: 2003 }], 1997)],
          ["c2", cls("c2", [], null)],
        ]),
      },
      () => "Depression",
      NOW,
    );
    expect(out.map((e) => e.id)).toEqual(["t1", "l1", "tp1", "c1"]);
    expect(out.find((e) => e.id === "c1")).toMatchObject({
      kind: "classification",
      category: "diagnosed",
      title: "Depression",
      spans: [{ from: 1997, to: 2003 }],
    });
  });

  it("runs an ongoing period, or a diagnosis without periods, to the present", () => {
    const out = buildStripeEntries(
      {
        events: new Map(),
        lifeEvents: new Map(),
        turningPoints: new Map(),
        classifications: new Map([
          ["c1", cls("c1", [{ start_year: 2010, end_year: null }], null)],
          ["c2", cls("c2", [], 2020)],
        ]),
      },
      () => "x",
      NOW,
    );
    expect(out[0].spans).toEqual([{ from: 2010, to: NOW }]);
    expect(out[1].spans).toEqual([{ from: 2020, to: NOW }]);
  });
});

describe("lastYearOf", () => {
  it("uses the death year when there is one", () => {
    expect(lastYearOf(person("a", 1932, 2005), NOW)).toEqual({ last: 2005, endUnknown: false });
  });

  it("draws a living person to the present", () => {
    expect(lastYearOf(person("a", 1958), NOW)).toEqual({ last: NOW, endUnknown: false });
  });

  it("does not draw someone born long ago as still living", () => {
    expect(lastYearOf(person("a", 1850), NOW)).toEqual({ last: 1930, endUnknown: true });
  });
});

describe("buildStripeLayout", () => {
  it("groups by generation, sorts by birth, and sets aside people without a birth year", () => {
    const persons = new Map([
      ["c", person("c", 1962)],
      ["b", person("b", 1958)],
      ["a", person("a", 1932, 2005)],
      ["x", person("x", null)],
    ]);
    const generations = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 1],
      ["x", 1],
    ]);
    const layout = buildStripeLayout(persons, generations, NOW);
    expect(layout.generations.map((g) => g.rows.map((r) => r.person.id))).toEqual([
      ["a"],
      ["b", "c"],
    ]);
    expect(layout.rows.map((r) => r.person.id)).toEqual(["a", "b", "c"]);
    expect(layout.unplaced.map((p) => p.id)).toEqual(["x"]);
  });

  it("puts people without a generation in the first one", () => {
    const layout = buildStripeLayout(new Map([["a", person("a", 1990)]]), new Map(), NOW);
    expect(layout.generations[0].generation).toBe(0);
  });
});

describe("domains", () => {
  const layout = buildStripeLayout(
    new Map([
      ["a", person("a", 1932, 2005)],
      ["b", person("b", 1985)],
    ]),
    new Map(),
    NOW,
  );

  it("starts the years ruler on the decade before the earliest birth", () => {
    expect(yearDomainStart(layout.rows, NOW)).toBe(1930);
    expect(
      yearDomainStart(
        buildStripeLayout(new Map([["a", person("a", 1930)]]), new Map(), NOW).rows,
        NOW,
      ),
    ).toBe(1920);
  });

  it("sizes the age ruler to the oldest age reached", () => {
    expect(ageDomainSpan(layout.rows)).toBe(80);
    expect(ageDomainSpan([])).toBe(30);
  });
});

describe("coversYear and clipSpan", () => {
  it("checks every span", () => {
    const e = entry({
      id: "e",
      spans: [
        { from: 1990, to: 1992 },
        { from: 2000, to: 2001 },
      ],
    });
    expect(coversYear(e, 1991)).toBe(true);
    expect(coversYear(e, 1995)).toBe(false);
    expect(coversYear(e, 2001)).toBe(true);
  });

  it("clips a span to a life", () => {
    expect(clipSpan({ from: 1935, to: 2012 }, 1940, 2000)).toEqual({ from: 1940, to: 2000 });
    expect(clipSpan({ from: 1900, to: 1910 }, 1940, 2000)).toBeNull();
  });
});

describe("traumaRuns", () => {
  it("merges consecutive years and splits where the set of events changes", () => {
    const war = entry({ id: "war", spans: [{ from: 1940, to: 1945 }] });
    const loss = entry({ id: "loss", spans: [{ from: 1945, to: 1945 }] });
    const runs = traumaRuns([war, loss], 1935, 2000);
    expect(runs.map((r) => [r.start, r.end, r.entries.map((e) => e.id)])).toEqual([
      [1940, 1944, ["war"]],
      [1945, 1945, ["war", "loss"]],
    ]);
  });

  it("ignores everything that is not a trauma event and clips to the life", () => {
    const life = entry({ id: "l", kind: "life_event", spans: [{ from: 1950, to: 1950 }] });
    const early = entry({ id: "early", spans: [{ from: 1920, to: 1937 }] });
    expect(traumaRuns([life, early], 1935, 2000).map((r) => [r.start, r.end])).toEqual([
      [1935, 1937],
    ]);
  });
});

describe("readAt", () => {
  const rows = buildStripeLayout(
    new Map([
      ["ada", person("ada", 1910, 1947)],
      ["cat", person("cat", 1958)],
      ["sophie", person("sophie", 1985)],
      ["lucas", person("lucas", 1988)],
      ["emma", person("emma", 2014)],
      ["rob", person("rob", 1960)],
    ]),
    new Map(),
    NOW,
  ).rows;
  const divorce = entry({
    id: "divorce",
    personIds: ["sophie", "lucas"],
    spans: [{ from: 1997, to: 1997 }],
  });
  const hardship = entry({
    id: "hardship",
    personIds: ["cat", "sophie", "lucas"],
    spans: [{ from: 1997, to: 2000 }],
  });

  it("lists who was alive and what the year held, grouping identical years", () => {
    const r = readAt(rows, [divorce, hardship], "years", 1997, NOW);
    expect(r.blocks.map((b) => b.people.map((p) => p.person.id))).toEqual([
      ["cat"],
      ["sophie", "lucas"],
    ]);
    expect(r.blocks[1].entries.map((e) => e.id)).toEqual(["divorce", "hardship"]);
    expect(r.quiet.map((p) => p.person.id)).toEqual(["rob"]);
    expect(r.notYet.map((p) => p.person.id)).toEqual(["emma"]);
    expect(r.gone.map((p) => p.person.id)).toEqual(["ada"]);
  });

  it("reads each person's own year in age mode and never groups", () => {
    const r = readAt(rows, [divorce, hardship], "age", 12, NOW);
    const sophie = r.blocks.find((b) => b.people[0].person.id === "sophie");
    expect(sophie?.years).toEqual([1997]);
    expect(r.blocks.every((b) => b.people.length === 1)).toBe(true);
    // Emma turns 12 in the present year, so she is read, not "not yet"
    expect(r.quiet.map((p) => p.person.id)).toContain("emma");
    expect(readAt(rows, [], "age", 13, NOW).notYet.map((p) => p.person.id)).toEqual(["emma"]);
  });
});

describe("busiestValue", () => {
  it("opens on the year that holds the most, the latest on a tie", () => {
    const rows = buildStripeLayout(new Map([["a", person("a", 1950)]]), new Map(), NOW).rows;
    const one = entry({ id: "1", spans: [{ from: 1960, to: 1960 }] });
    const two = entry({ id: "2", spans: [{ from: 1970, to: 1970 }] });
    const three = entry({ id: "3", spans: [{ from: 1970, to: 1970 }] });
    expect(busiestValue(rows, [one, two, three], "years", 1950, NOW, NOW)).toBe(1970);
    expect(busiestValue(rows, [one], "age", 0, 70, NOW)).toBe(10);
    expect(busiestValue(rows, [], "years", 1950, NOW, NOW)).toBe(NOW);
  });
});

describe("highlighting", () => {
  const entries = [
    entry({ id: "d1", title: "Divorce", kind: "life_event", category: "family" }),
    entry({ id: "d2", title: " divorce ", kind: "life_event", category: "family" }),
    entry({ id: "l1", title: "Death of her mother", category: "loss", approx: true }),
    entry({ id: "tp", title: "Started therapy", kind: "turning_point", category: "recovery" }),
  ];

  it("names key items by kind and category", () => {
    expect(keyOf(entries[0])).toBe("life_event:family");
    expect(keyOf(entries[3])).toBe("turning_point:recovery");
  });

  it("matches an entry with every entry of the same title", () => {
    expect([...matchEntry(entries, "d1")]).toEqual(["d1", "d2"]);
    expect(matchEntry(entries, "missing").size).toBe(0);
  });

  it("matches a key item to every entry it describes", () => {
    expect([...matchKey(entries, "life_event:family")]).toEqual(["d1", "d2"]);
    expect([...matchKey(entries, "approx")]).toEqual(["l1"]);
    expect([...matchKey(entries, "turning_point:recovery")]).toEqual(["tp"]);
  });
});

describe("stripeColor", () => {
  it("points every kind at its theme variable", () => {
    expect(stripeColor({ kind: "trauma_event", category: "war" })).toBe("var(--color-trauma-war)");
    expect(stripeColor({ kind: "life_event", category: "family" })).toBe(
      "var(--color-life-family)",
    );
    expect(stripeColor({ kind: "classification", category: "suspected" })).toBe(
      "var(--color-classification-suspected)",
    );
    expect(stripeColor({ kind: "turning_point", category: "cycle_breaking" })).toBe(
      "var(--color-tp-cycle-breaking)",
    );
  });
});

describe("spanAt", () => {
  it("finds the span covering a year, else the first", () => {
    const e = entry({
      id: "e",
      spans: [
        { from: 1990, to: 1992 },
        { from: 2000, to: 2003 },
      ],
    });
    expect(spanAt(e, 2001)).toEqual({ from: 2000, to: 2003 });
    expect(spanAt(e, 1995)).toEqual({ from: 1990, to: 1992 });
  });
});

describe("names", () => {
  it("finds a surname everyone shares", () => {
    expect(sharedSurname(["Sophie Porter", "Lucas Porter"])).toBe("Porter");
    expect(sharedSurname(["Sophie Porter", "Lucas Ellison"])).toBeNull();
    expect(sharedSurname(["Sophie Porter"])).toBeNull();
    expect(sharedSurname(["Sophie", "Lucas"])).toBeNull();
  });

  it("takes the first name", () => {
    expect(firstName(" Ada Blake ")).toBe("Ada");
    expect(firstName("Ada")).toBe("Ada");
  });
});

describe("entriesByPerson", () => {
  it("lists each person's entries, including people with none", () => {
    const rows = buildStripeLayout(
      new Map([
        ["a", person("a", 1950)],
        ["b", person("b", 1960)],
      ]),
      new Map(),
      NOW,
    ).rows;
    const shared = entry({ id: "s", personIds: ["a", "b"] });
    const stray = entry({ id: "x", personIds: ["gone"] });
    const map = entriesByPerson(rows, [shared, stray]);
    expect(map.get("a")?.map((e) => e.id)).toEqual(["s"]);
    expect(map.get("b")?.map((e) => e.id)).toEqual(["s"]);
    expect(map.has("gone")).toBe(false);
  });
});

describe("undated entries", () => {
  const cls = (id: string, periods: DecryptedClassification["periods"], diagnosis: number | null) =>
    ({
      id,
      person_ids: ["a"],
      dsm_category: "anxiety",
      dsm_subcategory: null,
      status: "suspected",
      diagnosis_year: diagnosis,
      periods,
      notes: null,
    }) as DecryptedClassification;

  it("collects every entry without a year to place, of every kind", () => {
    const life: DecryptedLifeEvent = {
      id: "l1",
      person_ids: ["b"],
      title: "Moved away",
      description: "",
      category: LifeEventCategory.Relocation,
      approximate_date: "after the war",
      impact: null,
      tags: [],
    };
    const tp: DecryptedTurningPoint = {
      id: "tp1",
      person_ids: ["a"],
      title: "Found a mentor",
      description: "",
      category: TurningPointCategory.ProtectiveRelationship,
      approximate_date: "",
      significance: null,
      tags: [],
    };
    const undated = undatedEntries({
      events: new Map([
        ["t1", trauma("t1", "after the war", ["a", "b"])],
        ["t2", trauma("t2", "1944")],
      ]),
      lifeEvents: new Map([["l1", life]]),
      turningPoints: new Map([["tp1", tp]]),
      classifications: new Map([
        ["c1", cls("c1", [], null)],
        ["c2", cls("c2", [], 2001)],
      ]),
    });
    expect(undated.map((e) => [e.id, e.kind])).toEqual([
      ["t1", "trauma_event"],
      ["l1", "life_event"],
      ["tp1", "turning_point"],
      ["c1", "classification"],
    ]);
    const byPerson = undatedByPerson(undated);
    expect(byPerson.get("a")?.map((e) => e.id)).toEqual(["t1", "tp1", "c1"]);
    expect(byPerson.get("b")?.map((e) => e.id)).toEqual(["t1", "l1"]);
  });
});

describe("entries dated by age or stage of life", () => {
  const rows = buildStripeLayout(
    new Map([
      ["mum", person("mum", 1958)],
      ["son", person("son", 1985)],
    ]),
    new Map(),
    NOW,
  ).rows;

  it("are read per person, so a shared childhood lands on each person's own years", () => {
    const [childhood, eighties] = buildStripeEntries(
      {
        events: new Map([
          ["c", trauma("c", "as a child", ["mum", "son"])],
          ["s", trauma("s", "summer of '86", ["son"])],
        ]),
        lifeEvents: new Map(),
        turningPoints: new Map(),
        classifications: new Map(),
      },
      () => "",
      NOW,
    );
    expect(childhood).toMatchObject({
      spans: [],
      approx: true,
      relative: { kind: "ages", from: 0, to: 12 },
    });
    expect(eighties).toMatchObject({ approx: false, relative: { kind: "short" } });
    const byPerson = entriesByPerson(rows, [childhood, eighties]);
    expect(byPerson.get("mum")?.map((e) => e.spans)).toEqual([[{ from: 1958, to: 1970 }]]);
    expect(byPerson.get("son")?.map((e) => e.spans)).toEqual([
      [{ from: 1985, to: 1997 }],
      [{ from: 1986, to: 1986 }],
    ]);
    expect(readAt(rows, [childhood], "years", 1965, NOW).blocks[0].people[0].person.id).toBe("mum");
  });
});
