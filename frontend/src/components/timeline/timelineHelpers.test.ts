import { describe, expect, it } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import {
  LifeEventCategory,
  PartnerStatus,
  RelationshipType,
  TraumaCategory,
} from "../../types/domain";
import type { PersonRow, TimelineRenderContext } from "./timelineHelpers";
import {
  assignBaseGenerations,
  BAR_HEIGHT,
  buildChildToParentsMap,
  buildRowLayout,
  computeGenerations,
  computeTimeDomain,
  equalizePartnerGenerations,
  filterTimelinePersons,
  MARKER_RADIUS,
  ROW_HEIGHT,
  renderClassificationStrips,
  renderLifeBars,
  renderLifeEventMarkers,
  renderPartnerLines,
  renderTraumaMarkers,
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

// ---- D3 rendering helper tests ----

// Mock D3 selection that tracks appended elements, attributes, and event handlers
function mockSelection() {
  const appended: Array<{
    tag: string;
    attrs: Record<string, unknown>;
    styles: Record<string, unknown>;
    handlers: Record<string, (...args: never[]) => unknown>;
  }> = [];
  let current: (typeof appended)[number] | null = null;

  const sel: any = {
    append(tag: string) {
      current = { tag, attrs: {}, styles: {}, handlers: {} };
      appended.push(current);
      return sel;
    },
    attr(key: string, value: unknown) {
      if (current) current.attrs[key] = value;
      return sel;
    },
    style(key: string, value: unknown) {
      if (current) current.styles[key] = value;
      return sel;
    },
    on(event: string, handler: (...args: never[]) => unknown) {
      if (current) current.handlers[event] = handler;
      return sel;
    },
  };
  return { sel, appended };
}

function makeRow(person: DecryptedPerson, generation: number, y: number): PersonRow {
  return { person, generation, y };
}

type MockElement = {
  tag: string;
  attrs: Record<string, unknown>;
  styles: Record<string, unknown>;
  handlers: Record<string, (...args: never[]) => unknown>;
};

function makeCtx(rows: PersonRow[]): TimelineRenderContext & { appended: MockElement[] } {
  const { sel, appended } = mockSelection();
  return {
    timeGroup: sel,
    scale: ((v: number) => v * 10) as any,
    rows,
    tooltip: document.createElement("div"),
    cssVar: (name: string) => name,
    tRef: { current: (key: string) => key },
    currentYear: 2025,
    appended,
  };
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

// ---- renderLifeBars ----

describe("renderLifeBars", () => {
  it("renders a rect for each row with birth_year", () => {
    const p1 = makePerson("a", { birth_year: 1950, death_year: 2000 });
    const p2 = makePerson("b", { birth_year: 1980 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    renderLifeBars(ctx);

    expect(ctx.appended).toHaveLength(2);
    expect(ctx.appended[0].tag).toBe("rect");
    expect(ctx.appended[1].tag).toBe("rect");
  });

  it("skips rows without birth_year", () => {
    const p1 = makePerson("a", { birth_year: null });
    const p2 = makePerson("b", { birth_year: 1980 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    renderLifeBars(ctx);

    expect(ctx.appended).toHaveLength(1);
    expect(ctx.appended[0].tag).toBe("rect");
  });

  it("uses death_year for width when present", () => {
    const p = makePerson("a", { birth_year: 1950, death_year: 2000 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    renderLifeBars(ctx);

    const rect = ctx.appended[0];
    const expectedX1 = 1950 * 10;
    const expectedX2 = 2000 * 10;
    expect(rect.attrs.x).toBe(expectedX1);
    expect(rect.attrs.width).toBe(expectedX2 - expectedX1);
  });

  it("uses currentYear for width when death_year is null", () => {
    const p = makePerson("a", { birth_year: 1980, death_year: null });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    renderLifeBars(ctx);

    const rect = ctx.appended[0];
    const expectedX1 = 1980 * 10;
    const expectedX2 = 2025 * 10; // currentYear
    expect(rect.attrs.x).toBe(expectedX1);
    expect(rect.attrs.width).toBe(expectedX2 - expectedX1);
  });

  it("sets correct y position centered in row", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rowY = 40;
    const rows = [makeRow(p, 0, rowY)];
    const ctx = makeCtx(rows);

    renderLifeBars(ctx);

    const expectedBarY = rowY + (ROW_HEIGHT - BAR_HEIGHT) / 2;
    expect(ctx.appended[0].attrs.y).toBe(expectedBarY);
  });

  it("sets fill and stroke from cssVar", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    renderLifeBars(ctx);

    expect(ctx.appended[0].attrs.fill).toBe("--color-lifebar-fill");
    expect(ctx.appended[0].attrs.stroke).toBe("--color-lifebar-stroke");
  });

  it("clamps width to zero minimum", () => {
    // Create a scenario where death_year < birth_year (edge case)
    const p = makePerson("a", { birth_year: 2000, death_year: 1990 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    renderLifeBars(ctx);

    expect(ctx.appended[0].attrs.width).toBe(0);
  });

  it("renders nothing for empty rows", () => {
    const ctx = makeCtx([]);
    renderLifeBars(ctx);
    expect(ctx.appended).toHaveLength(0);
  });
});

// ---- renderPartnerLines ----

describe("renderPartnerLines", () => {
  it("renders lines for partner relationships", () => {
    const p1 = makePerson("a", { birth_year: 1950 });
    const p2 = makePerson("b", { birth_year: 1955 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    const rels = relsMap({
      ...makeRel("r1", RelationshipType.Partner, "a", "b"),
      periods: [{ start_year: 1975, end_year: null, status: PartnerStatus.Married }],
    });
    const persons = personsMap(p1, p2);

    renderPartnerLines(ctx, rels, persons);

    // Each period produces 2 lines: the visible line + an invisible hover line
    expect(ctx.appended).toHaveLength(2);
    expect(ctx.appended[0].tag).toBe("line");
    expect(ctx.appended[1].tag).toBe("line");
  });

  it("skips non-partner relationships", () => {
    const p1 = makePerson("a", { birth_year: 1950 });
    const p2 = makePerson("b", { birth_year: 1955 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    const rels = relsMap(makeRel("r1", RelationshipType.BiologicalParent, "a", "b"));
    const persons = personsMap(p1, p2);

    renderPartnerLines(ctx, rels, persons);

    expect(ctx.appended).toHaveLength(0);
  });

  it("skips relationships where persons are not in rows", () => {
    const p1 = makePerson("a", { birth_year: 1950 });
    const rows = [makeRow(p1, 0, 20)];
    const ctx = makeCtx(rows);

    const p2 = makePerson("b", { birth_year: 1955 });
    const rels = relsMap({
      ...makeRel("r1", RelationshipType.Partner, "a", "b"),
      periods: [{ start_year: 1975, end_year: null, status: PartnerStatus.Together }],
    });
    const persons = personsMap(p1, p2);

    renderPartnerLines(ctx, rels, persons);

    // "b" is not in rows, so the relationship is skipped
    expect(ctx.appended).toHaveLength(0);
  });

  it("renders dashed stroke for separated periods", () => {
    const p1 = makePerson("a", { birth_year: 1950 });
    const p2 = makePerson("b", { birth_year: 1955 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    const rels = relsMap({
      ...makeRel("r1", RelationshipType.Partner, "a", "b"),
      periods: [{ start_year: 1975, end_year: 1980, status: PartnerStatus.Separated }],
    });
    const persons = personsMap(p1, p2);

    renderPartnerLines(ctx, rels, persons);

    // First line is the visible one with dashed style
    expect(ctx.appended[0].attrs["stroke-dasharray"]).toBe("6 3");
  });

  it("renders dashed stroke for divorced periods", () => {
    const p1 = makePerson("a", { birth_year: 1950 });
    const p2 = makePerson("b", { birth_year: 1955 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    const rels = relsMap({
      ...makeRel("r1", RelationshipType.Partner, "a", "b"),
      periods: [{ start_year: 1975, end_year: 1985, status: PartnerStatus.Divorced }],
    });
    const persons = personsMap(p1, p2);

    renderPartnerLines(ctx, rels, persons);

    expect(ctx.appended[0].attrs["stroke-dasharray"]).toBe("6 3");
  });

  it("renders solid stroke for together/married periods", () => {
    const p1 = makePerson("a", { birth_year: 1950 });
    const p2 = makePerson("b", { birth_year: 1955 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    const rels = relsMap({
      ...makeRel("r1", RelationshipType.Partner, "a", "b"),
      periods: [{ start_year: 1975, end_year: null, status: PartnerStatus.Together }],
    });
    const persons = personsMap(p1, p2);

    renderPartnerLines(ctx, rels, persons);

    expect(ctx.appended[0].attrs["stroke-dasharray"]).toBeNull();
  });

  it("renders two lines per period (visible + hover target)", () => {
    const p1 = makePerson("a", { birth_year: 1950 });
    const p2 = makePerson("b", { birth_year: 1955 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    const rels = relsMap({
      ...makeRel("r1", RelationshipType.Partner, "a", "b"),
      periods: [
        { start_year: 1975, end_year: 1985, status: PartnerStatus.Married },
        { start_year: 1990, end_year: null, status: PartnerStatus.Together },
      ],
    });
    const persons = personsMap(p1, p2);

    renderPartnerLines(ctx, rels, persons);

    // 2 periods x 2 lines each = 4 total
    expect(ctx.appended).toHaveLength(4);
  });

  it("positions lines at midpoint between partner rows", () => {
    const p1 = makePerson("a", { birth_year: 1950 });
    const p2 = makePerson("b", { birth_year: 1955 });
    const row1Y = 20;
    const row2Y = 56;
    const rows = [makeRow(p1, 0, row1Y), makeRow(p2, 0, row2Y)];
    const ctx = makeCtx(rows);

    const rels = relsMap({
      ...makeRel("r1", RelationshipType.Partner, "a", "b"),
      periods: [{ start_year: 1975, end_year: null, status: PartnerStatus.Married }],
    });
    const persons = personsMap(p1, p2);

    renderPartnerLines(ctx, rels, persons);

    const expectedMidY = (row1Y + ROW_HEIGHT / 2 + row2Y + ROW_HEIGHT / 2) / 2;
    expect(ctx.appended[0].attrs.y1).toBe(expectedMidY);
    expect(ctx.appended[0].attrs.y2).toBe(expectedMidY);
  });

  it("uses scale for x coordinates", () => {
    const p1 = makePerson("a", { birth_year: 1950 });
    const p2 = makePerson("b", { birth_year: 1955 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    const rels = relsMap({
      ...makeRel("r1", RelationshipType.Partner, "a", "b"),
      periods: [{ start_year: 1975, end_year: 2000, status: PartnerStatus.Married }],
    });
    const persons = personsMap(p1, p2);

    renderPartnerLines(ctx, rels, persons);

    expect(ctx.appended[0].attrs.x1).toBe(1975 * 10);
    expect(ctx.appended[0].attrs.x2).toBe(2000 * 10);
  });

  it("partner line mouseenter shows tooltip with names and status", () => {
    const p1 = makePerson("a", { name: "Alice", birth_year: 1950 });
    const p2 = makePerson("b", { name: "Bob", birth_year: 1955 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    const rels = relsMap({
      ...makeRel("r1", RelationshipType.Partner, "a", "b"),
      periods: [{ start_year: 1975, end_year: 2000, status: PartnerStatus.Married }],
    });
    const persons = personsMap(p1, p2);

    renderPartnerLines(ctx, rels, persons);

    // The second appended element is the invisible hover line
    const hoverLine = ctx.appended[1];
    expect(hoverLine.handlers.mouseenter).toBeDefined();
    expect(hoverLine.handlers.mouseleave).toBeDefined();

    // Trigger mouseenter
    hoverLine.handlers.mouseenter({ clientX: 200, clientY: 100 } as MouseEvent);
    expect(ctx.tooltip.style.display).toBe("block");
    expect(ctx.tooltip.innerHTML).toContain("Alice");
    expect(ctx.tooltip.innerHTML).toContain("Bob");

    // Trigger mouseleave
    hoverLine.handlers.mouseleave({} as MouseEvent);
    expect(ctx.tooltip.style.display).toBe("none");
  });
});

// ---- renderTraumaMarkers ----

describe("renderTraumaMarkers", () => {
  it("renders circles for trauma events", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const events = new Map<string, DecryptedEvent>([["e1", makeEvent("e1", ["a"])]]);
    const persons = personsMap(p);
    const traumaColors = { [TraumaCategory.Loss]: "#ff0000" } as Record<TraumaCategory, string>;

    renderTraumaMarkers(ctx, events, persons, traumaColors);

    expect(ctx.appended).toHaveLength(1);
    expect(ctx.appended[0].tag).toBe("circle");
  });

  it("positions circle at scaled year and row center", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rowY = 20;
    const rows = [makeRow(p, 0, rowY)];
    const ctx = makeCtx(rows);

    const events = new Map<string, DecryptedEvent>([
      ["e1", makeEvent("e1", ["a"], { approximate_date: "1995" })],
    ]);
    const persons = personsMap(p);
    const traumaColors = { [TraumaCategory.Loss]: "#ff0000" } as Record<TraumaCategory, string>;

    renderTraumaMarkers(ctx, events, persons, traumaColors);

    expect(ctx.appended[0].attrs.cx).toBe(1995 * 10);
    expect(ctx.appended[0].attrs.cy).toBe(rowY + ROW_HEIGHT / 2);
  });

  it("uses correct color from traumaColors map", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const events = new Map<string, DecryptedEvent>([
      ["e1", makeEvent("e1", ["a"], { category: TraumaCategory.Abuse })],
    ]);
    const persons = personsMap(p);
    const traumaColors = {
      [TraumaCategory.Abuse]: "#cc0000",
    } as Record<TraumaCategory, string>;

    renderTraumaMarkers(ctx, events, persons, traumaColors);

    expect(ctx.appended[0].attrs.fill).toBe("#cc0000");
  });

  it("sets marker radius and class", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const events = new Map<string, DecryptedEvent>([["e1", makeEvent("e1", ["a"])]]);
    const persons = personsMap(p);
    const traumaColors = { [TraumaCategory.Loss]: "#ff0000" } as Record<TraumaCategory, string>;

    renderTraumaMarkers(ctx, events, persons, traumaColors);

    expect(ctx.appended[0].attrs.r).toBe(MARKER_RADIUS);
    expect(ctx.appended[0].attrs.class).toBe("tl-marker");
  });

  it("skips events with non-numeric dates", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const events = new Map<string, DecryptedEvent>([
      ["e1", makeEvent("e1", ["a"], { approximate_date: "circa 2000" })],
    ]);
    const persons = personsMap(p);
    const traumaColors = { [TraumaCategory.Loss]: "#ff0000" } as Record<TraumaCategory, string>;

    renderTraumaMarkers(ctx, events, persons, traumaColors);

    expect(ctx.appended).toHaveLength(0);
  });

  it("skips events for persons not in rows", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const events = new Map<string, DecryptedEvent>([["e1", makeEvent("e1", ["missing-person"])]]);
    const persons = personsMap(p);
    const traumaColors = { [TraumaCategory.Loss]: "#ff0000" } as Record<TraumaCategory, string>;

    renderTraumaMarkers(ctx, events, persons, traumaColors);

    expect(ctx.appended).toHaveLength(0);
  });

  it("renders a marker for each person linked to a multi-person event", () => {
    const p1 = makePerson("a", { birth_year: 1980 });
    const p2 = makePerson("b", { birth_year: 1985 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    const events = new Map<string, DecryptedEvent>([["e1", makeEvent("e1", ["a", "b"])]]);
    const persons = personsMap(p1, p2);
    const traumaColors = { [TraumaCategory.Loss]: "#ff0000" } as Record<TraumaCategory, string>;

    renderTraumaMarkers(ctx, events, persons, traumaColors);

    expect(ctx.appended).toHaveLength(2);
    expect(ctx.appended[0].tag).toBe("circle");
    expect(ctx.appended[1].tag).toBe("circle");
  });

  it("trauma marker mouseenter shows tooltip with event details", () => {
    const p = makePerson("a", { birth_year: 1980, name: "Alice" });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const events = new Map<string, DecryptedEvent>([
      [
        "e1",
        makeEvent("e1", ["a"], { title: "War trauma", approximate_date: "1945", severity: 8 }),
      ],
    ]);
    const persons = personsMap(p);
    const colors = { [TraumaCategory.Loss]: "#ff0000" } as Record<TraumaCategory, string>;

    renderTraumaMarkers(ctx, events, persons, colors);

    const circle = ctx.appended[0];
    circle.handlers.mouseenter({ clientX: 100, clientY: 200 } as MouseEvent);

    expect(ctx.tooltip.style.display).toBe("block");
    expect(ctx.tooltip.innerHTML).toContain("War trauma");
    expect(ctx.tooltip.innerHTML).toContain("Alice");

    circle.handlers.mouseleave();
    expect(ctx.tooltip.style.display).toBe("none");
  });
});

// ---- renderLifeEventMarkers ----

describe("renderLifeEventMarkers", () => {
  it("renders a rotated rect for each life event marker", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const lifeEvents = new Map<string, DecryptedLifeEvent>([["le1", makeLifeEvent("le1", ["a"])]]);
    const persons = personsMap(p);
    const colors = { [LifeEventCategory.Career]: "#00ff00" } as Record<LifeEventCategory, string>;

    renderLifeEventMarkers(ctx, lifeEvents, persons, colors);

    expect(ctx.appended).toHaveLength(1);
    expect(ctx.appended[0].tag).toBe("rect");
    expect(ctx.appended[0].attrs.transform).toContain("rotate(45");
  });

  it("skips events with non-numeric dates", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      ["le1", makeLifeEvent("le1", ["a"], { approximate_date: "unknown" })],
    ]);
    const persons = personsMap(p);
    const colors = { [LifeEventCategory.Career]: "#00ff00" } as Record<LifeEventCategory, string>;

    renderLifeEventMarkers(ctx, lifeEvents, persons, colors);

    expect(ctx.appended).toHaveLength(0);
  });

  it("skips events for persons not in rows", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      ["le1", makeLifeEvent("le1", ["missing"])],
    ]);
    const persons = personsMap(p);
    const colors = { [LifeEventCategory.Career]: "#00ff00" } as Record<LifeEventCategory, string>;

    renderLifeEventMarkers(ctx, lifeEvents, persons, colors);

    expect(ctx.appended).toHaveLength(0);
  });

  it("uses correct diamond size and position", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rowY = 40;
    const rows = [makeRow(p, 0, rowY)];
    const ctx = makeCtx(rows);

    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      ["le1", makeLifeEvent("le1", ["a"], { approximate_date: "2005" })],
    ]);
    const persons = personsMap(p);
    const colors = { [LifeEventCategory.Career]: "#00ff00" } as Record<LifeEventCategory, string>;

    renderLifeEventMarkers(ctx, lifeEvents, persons, colors);

    const diamondSize = MARKER_RADIUS * 0.9;
    const cx = 2005 * 10;
    const cy = rowY + ROW_HEIGHT / 2;
    expect(ctx.appended[0].attrs.x).toBe(cx - diamondSize);
    expect(ctx.appended[0].attrs.y).toBe(cy - diamondSize);
    expect(ctx.appended[0].attrs.width).toBe(diamondSize * 2);
    expect(ctx.appended[0].attrs.height).toBe(diamondSize * 2);
  });

  it("sets correct fill color from lifeEventColors", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      ["le1", makeLifeEvent("le1", ["a"], { category: LifeEventCategory.Relocation })],
    ]);
    const persons = personsMap(p);
    const colors = {
      [LifeEventCategory.Relocation]: "#0000ff",
    } as Record<LifeEventCategory, string>;

    renderLifeEventMarkers(ctx, lifeEvents, persons, colors);

    expect(ctx.appended[0].attrs.fill).toBe("#0000ff");
  });

  it("sets tl-marker class", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const lifeEvents = new Map<string, DecryptedLifeEvent>([["le1", makeLifeEvent("le1", ["a"])]]);
    const persons = personsMap(p);
    const colors = { [LifeEventCategory.Career]: "#00ff00" } as Record<LifeEventCategory, string>;

    renderLifeEventMarkers(ctx, lifeEvents, persons, colors);

    expect(ctx.appended[0].attrs.class).toBe("tl-marker");
  });

  it("renders a marker for each person linked to a multi-person event", () => {
    const p1 = makePerson("a", { birth_year: 1980 });
    const p2 = makePerson("b", { birth_year: 1985 });
    const rows = [makeRow(p1, 0, 20), makeRow(p2, 0, 56)];
    const ctx = makeCtx(rows);

    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      ["le1", makeLifeEvent("le1", ["a", "b"])],
    ]);
    const persons = personsMap(p1, p2);
    const colors = { [LifeEventCategory.Career]: "#00ff00" } as Record<LifeEventCategory, string>;

    renderLifeEventMarkers(ctx, lifeEvents, persons, colors);

    expect(ctx.appended).toHaveLength(2);
  });

  it("life event marker mouseenter shows tooltip with event details", () => {
    const p = makePerson("a", { birth_year: 1980, name: "Bob" });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      ["le1", makeLifeEvent("le1", ["a"], { title: "Graduated", impact: 7 })],
    ]);
    const persons = personsMap(p);
    const colors = { [LifeEventCategory.Career]: "#00ff00" } as Record<LifeEventCategory, string>;

    renderLifeEventMarkers(ctx, lifeEvents, persons, colors);

    const rect = ctx.appended[0];
    rect.handlers.mouseenter({ clientX: 50, clientY: 100 } as MouseEvent);

    expect(ctx.tooltip.style.display).toBe("block");
    expect(ctx.tooltip.innerHTML).toContain("Graduated");
    expect(ctx.tooltip.innerHTML).toContain("Bob");

    rect.handlers.mouseleave();
    expect(ctx.tooltip.style.display).toBe("none");
  });

  it("life event marker tooltip excludes impact line when null", () => {
    const p = makePerson("a", { birth_year: 1980, name: "Carol" });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const lifeEvents = new Map<string, DecryptedLifeEvent>([
      ["le1", makeLifeEvent("le1", ["a"], { title: "Moved", impact: null })],
    ]);
    const persons = personsMap(p);
    const colors = { [LifeEventCategory.Career]: "#00ff00" } as Record<LifeEventCategory, string>;

    renderLifeEventMarkers(ctx, lifeEvents, persons, colors);

    const rect = ctx.appended[0];
    rect.handlers.mouseenter({ clientX: 0, clientY: 0 } as MouseEvent);

    expect(ctx.tooltip.innerHTML).toContain("Moved");
    // The impact line should not appear
    expect(ctx.tooltip.innerHTML).not.toContain("timeline.impact");
  });
});

// ---- renderClassificationStrips ----

describe("renderClassificationStrips", () => {
  it("renders strips for classification periods", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      ["c1", makeClassification("c1", ["a"], { periods: [{ start_year: 2000, end_year: 2010 }] })],
    ]);

    renderClassificationStrips(ctx, classifications);

    // One period => one rect
    expect(ctx.appended.length).toBeGreaterThanOrEqual(1);
    expect(ctx.appended[0].tag).toBe("rect");
  });

  it("skips persons without birth_year", () => {
    const p = makePerson("a", { birth_year: null });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      ["c1", makeClassification("c1", ["a"])],
    ]);

    renderClassificationStrips(ctx, classifications);

    expect(ctx.appended).toHaveLength(0);
  });

  it("skips persons not in rows", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      ["c1", makeClassification("c1", ["missing"])],
    ]);

    renderClassificationStrips(ctx, classifications);

    expect(ctx.appended).toHaveLength(0);
  });

  it("renders diagnosis triangle for diagnosed classifications", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: 2005,
          periods: [{ start_year: 2000, end_year: 2010 }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    // Should have: 1 rect (period strip) + 1 path (diagnosis triangle)
    const paths = ctx.appended.filter((e) => e.tag === "path");
    expect(paths).toHaveLength(1);
    expect(paths[0].attrs.class).toBe("tl-marker");
  });

  it("does not render diagnosis triangle for suspected classifications", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          status: "suspected",
          diagnosis_year: null,
          periods: [{ start_year: 2000, end_year: 2010 }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    const paths = ctx.appended.filter((e) => e.tag === "path");
    expect(paths).toHaveLength(0);
  });

  it("does not render diagnosis triangle when diagnosis_year is null", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: null,
          periods: [{ start_year: 2000, end_year: 2010 }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    const paths = ctx.appended.filter((e) => e.tag === "path");
    expect(paths).toHaveLength(0);
  });

  it("uses diagnosed color for diagnosed classifications", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: 2005,
          periods: [{ start_year: 2000, end_year: 2010 }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    // The rect should use the diagnosed CSS variable
    const rects = ctx.appended.filter((e) => e.tag === "rect");
    expect(rects[0].attrs.fill).toBe("--color-classification-diagnosed");
  });

  it("uses suspected color for suspected classifications", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          status: "suspected",
          periods: [{ start_year: 2000, end_year: 2010 }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    const rects = ctx.appended.filter((e) => e.tag === "rect");
    expect(rects[0].attrs.fill).toBe("--color-classification-suspected");
  });

  it("renders multiple periods as separate rects", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          periods: [
            { start_year: 2000, end_year: 2005 },
            { start_year: 2008, end_year: 2012 },
          ],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    const rects = ctx.appended.filter((e) => e.tag === "rect");
    expect(rects).toHaveLength(2);
  });

  it("renders strips for multiple classifications on same person", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      ["c1", makeClassification("c1", ["a"], { periods: [{ start_year: 2000, end_year: 2010 }] })],
      [
        "c2",
        makeClassification("c2", ["a"], {
          dsm_category: "anxiety",
          periods: [{ start_year: 2005, end_year: 2015 }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    // 2 classifications x 1 period each = 2 rects
    const rects = ctx.appended.filter((e) => e.tag === "rect");
    expect(rects).toHaveLength(2);
  });

  it("uses scale for x coordinates of period strips", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      ["c1", makeClassification("c1", ["a"], { periods: [{ start_year: 2000, end_year: 2010 }] })],
    ]);

    renderClassificationStrips(ctx, classifications);

    const rects = ctx.appended.filter((e) => e.tag === "rect");
    expect(rects[0].attrs.x).toBe(2000 * 10);
    expect(rects[0].attrs.width).toBe(Math.max(0, 2010 * 10 - 2000 * 10));
  });

  it("uses currentYear for open-ended periods", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      ["c1", makeClassification("c1", ["a"], { periods: [{ start_year: 2000, end_year: null }] })],
    ]);

    renderClassificationStrips(ctx, classifications);

    const rects = ctx.appended.filter((e) => e.tag === "rect");
    expect(rects[0].attrs.width).toBe(Math.max(0, 2025 * 10 - 2000 * 10));
  });

  it("positions diagnosis triangle at scaled diagnosis_year", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rowY = 20;
    const rows = [makeRow(p, 0, rowY)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: 2005,
          periods: [{ start_year: 2000, end_year: 2010 }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    const paths = ctx.appended.filter((e) => e.tag === "path");
    expect(paths).toHaveLength(1);

    // Verify the path "d" attribute contains the scaled diagnosis year coordinates
    const dx = 2005 * 10;
    const dy = rowY + ROW_HEIGHT / 2;
    const triSize = MARKER_RADIUS * 0.85;
    const expectedPath = `M${dx},${dy - triSize} L${dx + triSize},${dy + triSize} L${dx - triSize},${dy + triSize} Z`;
    expect(paths[0].attrs.d).toBe(expectedPath);
  });

  it("classification strip mouseenter shows tooltip with category and period info", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          dsm_category: "depressive",
          dsm_subcategory: null,
          status: "suspected",
          periods: [{ start_year: 2000, end_year: 2010 }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    const rects = ctx.appended.filter((e) => e.tag === "rect");
    expect(rects).toHaveLength(1);

    const mouseEvent = { clientX: 100, clientY: 200 } as MouseEvent;
    rects[0].handlers.mouseenter(mouseEvent);

    expect(ctx.tooltip.style.display).toBe("block");
    expect(ctx.tooltip.style.left).toBe("112px");
    expect(ctx.tooltip.style.top).toBe("190px");
    expect(ctx.tooltip.innerHTML).toContain("dsm.depressive");
    expect(ctx.tooltip.innerHTML).toContain("2000");

    rects[0].handlers.mouseleave();
    expect(ctx.tooltip.style.display).toBe("none");
  });

  it("classification strip mouseenter shows subcategory when present", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          dsm_category: "neurodevelopmental",
          dsm_subcategory: "adhd",
          status: "diagnosed",
          diagnosis_year: 2005,
          periods: [{ start_year: 2000, end_year: null }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    const rects = ctx.appended.filter((e) => e.tag === "rect");
    expect(rects).toHaveLength(1);

    const mouseEvent = { clientX: 50, clientY: 100 } as MouseEvent;
    rects[0].handlers.mouseenter(mouseEvent);

    expect(ctx.tooltip.innerHTML).toContain("dsm.neurodevelopmental");
    expect(ctx.tooltip.innerHTML).toContain("dsm.sub.adhd");
    expect(ctx.tooltip.innerHTML).toContain(" -"); // end_year null -> " -"
  });

  it("diagnosis triangle mouseenter shows tooltip with diagnosed info", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rowY = 20;
    const rows = [makeRow(p, 0, rowY)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          dsm_category: "anxiety",
          dsm_subcategory: null,
          status: "diagnosed",
          diagnosis_year: 2005,
          periods: [{ start_year: 2000, end_year: 2010 }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    const paths = ctx.appended.filter((e) => e.tag === "path");
    expect(paths).toHaveLength(1);

    const mouseEvent = { clientX: 150, clientY: 250 } as MouseEvent;
    paths[0].handlers.mouseenter(mouseEvent);

    expect(ctx.tooltip.style.display).toBe("block");
    expect(ctx.tooltip.style.left).toBe("162px");
    expect(ctx.tooltip.style.top).toBe("240px");
    expect(ctx.tooltip.innerHTML).toContain("dsm.anxiety");
    expect(ctx.tooltip.innerHTML).toContain("2005");

    paths[0].handlers.mouseleave();
    expect(ctx.tooltip.style.display).toBe("none");
  });

  it("diagnosis triangle mouseenter shows subcategory when present", () => {
    const p = makePerson("a", { birth_year: 1980 });
    const rows = [makeRow(p, 0, 20)];
    const ctx = makeCtx(rows);

    const classifications = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["a"], {
          dsm_category: "neurodevelopmental",
          dsm_subcategory: "adhd",
          status: "diagnosed",
          diagnosis_year: 2003,
          periods: [{ start_year: 2000, end_year: 2010 }],
        }),
      ],
    ]);

    renderClassificationStrips(ctx, classifications);

    const paths = ctx.appended.filter((e) => e.tag === "path");
    expect(paths).toHaveLength(1);

    paths[0].handlers.mouseenter({ clientX: 0, clientY: 0 } as MouseEvent);

    expect(ctx.tooltip.innerHTML).toContain("dsm.neurodevelopmental");
    expect(ctx.tooltip.innerHTML).toContain("dsm.sub.adhd");
    expect(ctx.tooltip.innerHTML).toContain("2003");
  });
});
