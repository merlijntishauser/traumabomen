import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import { LifeEventCategory, TraumaCategory } from "../../types/domain";
import { computeArcSpans, TimelinePatternArcs } from "./TimelinePatternArcs";

// Mock getPatternColor to return the hex directly in tests
vi.mock("../../lib/patternColors", () => ({
  getPatternColor: (hex: string) => hex,
  PATTERN_COLORS: ["#818cf8", "#f472b6"],
}));

function makePattern(id: string, overrides: Partial<DecryptedPattern> = {}): DecryptedPattern {
  return {
    id,
    name: `Pattern ${id}`,
    description: "",
    color: "#818cf8",
    linked_entities: [],
    person_ids: [],
    ...overrides,
  };
}

function makeEvent(id: string, year: string, personIds = ["p1"]): DecryptedEvent {
  return {
    id,
    person_ids: personIds,
    title: `Event ${id}`,
    description: "",
    category: TraumaCategory.Loss,
    approximate_date: year,
    severity: 5,
    tags: [],
  };
}

function makeLifeEvent(id: string, year: string, personIds = ["p1"]): DecryptedLifeEvent {
  return {
    id,
    person_ids: personIds,
    title: `LifeEvent ${id}`,
    description: "",
    category: LifeEventCategory.Career,
    approximate_date: year,
    impact: null,
    tags: [],
  };
}

function makeClassification(
  id: string,
  personIds = ["p1"],
  diagnosisYear: number | null = 2005,
): DecryptedClassification {
  return {
    id,
    person_ids: personIds,
    dsm_category: "depressive",
    dsm_subcategory: null,
    status: "diagnosed",
    diagnosis_year: diagnosisYear,
    periods: [{ start_year: 2000, end_year: 2010 }],
    notes: null,
  };
}

function makePerson(id: string, birthYear = 1980): DecryptedPerson {
  return {
    id,
    name: `Person ${id}`,
    birth_year: birthYear,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    gender: "unknown",
    is_adopted: false,
    notes: null,
  };
}

describe("computeArcSpans", () => {
  const persons = new Map([["p1", makePerson("p1")]]);

  it("returns spans for visible patterns with resolvable dates", () => {
    const events = new Map([
      ["e1", makeEvent("e1", "2000")],
      ["e2", makeEvent("e2", "2010")],
    ]);
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [
            { entity_type: "trauma_event", entity_id: "e1" },
            { entity_type: "trauma_event", entity_id: "e2" },
          ],
        }),
      ],
    ]);

    const spans = computeArcSpans(
      patterns,
      new Set(["pat1"]),
      events,
      new Map(),
      new Map(),
      "horizontal",
      persons,
    );

    expect(spans).toHaveLength(1);
    expect(spans[0].min).toBe(2000);
    expect(spans[0].max).toBe(2010);
    expect(spans[0].patternId).toBe("pat1");
  });

  it("skips patterns not in visiblePatternIds", () => {
    const events = new Map([["e1", makeEvent("e1", "2000")]]);
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
        }),
      ],
    ]);

    const spans = computeArcSpans(
      patterns,
      new Set(),
      events,
      new Map(),
      new Map(),
      "horizontal",
      persons,
    );

    expect(spans).toHaveLength(0);
  });

  it("skips patterns with no linked entities", () => {
    const patterns = new Map([["pat1", makePattern("pat1")]]);

    const spans = computeArcSpans(
      patterns,
      new Set(["pat1"]),
      new Map(),
      new Map(),
      new Map(),
      "horizontal",
      persons,
    );

    expect(spans).toHaveLength(0);
  });

  it("skips patterns with unresolvable dates", () => {
    const events = new Map([["e1", makeEvent("e1", "unknown")]]);
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
        }),
      ],
    ]);

    const spans = computeArcSpans(
      patterns,
      new Set(["pat1"]),
      events,
      new Map(),
      new Map(),
      "horizontal",
      persons,
    );

    expect(spans).toHaveLength(0);
  });

  it("adds padding for single-point patterns", () => {
    const events = new Map([["e1", makeEvent("e1", "2005")]]);
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
        }),
      ],
    ]);

    const spans = computeArcSpans(
      patterns,
      new Set(["pat1"]),
      events,
      new Map(),
      new Map(),
      "horizontal",
      persons,
    );

    expect(spans).toHaveLength(1);
    expect(spans[0].min).toBe(2004);
    expect(spans[0].max).toBe(2006);
  });

  it("resolves life events and classifications", () => {
    const lifeEvents = new Map([["le1", makeLifeEvent("le1", "1995")]]);
    const classifications = new Map([["c1", makeClassification("c1", ["p1"], 2010)]]);
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [
            { entity_type: "life_event", entity_id: "le1" },
            { entity_type: "classification", entity_id: "c1" },
          ],
        }),
      ],
    ]);

    const spans = computeArcSpans(
      patterns,
      new Set(["pat1"]),
      new Map(),
      lifeEvents,
      classifications,
      "horizontal",
      persons,
    );

    expect(spans).toHaveLength(1);
    expect(spans[0].min).toBe(1995);
    expect(spans[0].max).toBe(2010);
  });

  it("uses age coordinates in vertical mode", () => {
    const events = new Map([["e1", makeEvent("e1", "2000")]]);
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
        }),
      ],
    ]);

    const spans = computeArcSpans(
      patterns,
      new Set(["pat1"]),
      events,
      new Map(),
      new Map(),
      "vertical",
      persons,
    );

    expect(spans).toHaveLength(1);
    // Age: 2000 - 1980 = 20, single point gets padded
    expect(spans[0].min).toBe(19);
    expect(spans[0].max).toBe(21);
  });
});

describe("TimelinePatternArcs", () => {
  const baseProps = {
    patterns: new Map<string, DecryptedPattern>(),
    visiblePatternIds: new Set<string>(),
    events: new Map<string, DecryptedEvent>(),
    lifeEvents: new Map<string, DecryptedLifeEvent>(),
    classifications: new Map<string, DecryptedClassification>(),
    persons: new Map<string, DecryptedPerson>([["p1", makePerson("p1")]]),
    direction: "horizontal" as const,
    totalHeight: 200,
    hoveredPatternId: null,
    onPatternHover: vi.fn(),
    onPatternClick: vi.fn(),
  };

  it("renders nothing when no patterns", () => {
    const { container } = render(
      <svg>
        <TimelinePatternArcs {...baseProps} />
      </svg>,
    );
    expect(container.querySelector("[data-testid='pattern-arcs']")).toBeNull();
  });

  it("renders arcs for visible patterns", () => {
    const events = new Map([
      ["e1", makeEvent("e1", "2000")],
      ["e2", makeEvent("e2", "2010")],
    ]);
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [
            { entity_type: "trauma_event", entity_id: "e1" },
            { entity_type: "trauma_event", entity_id: "e2" },
          ],
        }),
      ],
    ]);

    const { container } = render(
      <svg>
        <TimelinePatternArcs
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
          events={events}
        />
      </svg>,
    );

    expect(container.querySelector("[data-testid='pattern-arc-pat1']")).toBeTruthy();
  });

  it("does not render arcs for non-visible patterns", () => {
    const events = new Map([["e1", makeEvent("e1", "2000")]]);
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
        }),
      ],
    ]);

    const { container } = render(
      <svg>
        <TimelinePatternArcs
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set()}
          events={events}
        />
      </svg>,
    );

    expect(container.querySelector("[data-testid='pattern-arc-pat1']")).toBeNull();
  });

  it("calls onPatternClick when arc is clicked", () => {
    const onPatternClick = vi.fn();
    const events = new Map([
      ["e1", makeEvent("e1", "2000")],
      ["e2", makeEvent("e2", "2010")],
    ]);
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [
            { entity_type: "trauma_event", entity_id: "e1" },
            { entity_type: "trauma_event", entity_id: "e2" },
          ],
        }),
      ],
    ]);

    const { container } = render(
      <svg>
        <TimelinePatternArcs
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
          events={events}
          onPatternClick={onPatternClick}
        />
      </svg>,
    );

    const arc = container.querySelector("[data-testid='pattern-arc-pat1']");
    arc?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatternClick).toHaveBeenCalledWith("pat1");
  });

  it("increases opacity on hover", () => {
    const events = new Map([
      ["e1", makeEvent("e1", "2000")],
      ["e2", makeEvent("e2", "2010")],
    ]);
    const patterns = new Map([
      [
        "pat1",
        makePattern("pat1", {
          linked_entities: [
            { entity_type: "trauma_event", entity_id: "e1" },
            { entity_type: "trauma_event", entity_id: "e2" },
          ],
        }),
      ],
    ]);

    const { container } = render(
      <svg>
        <TimelinePatternArcs
          {...baseProps}
          patterns={patterns}
          visiblePatternIds={new Set(["pat1"])}
          events={events}
          hoveredPatternId="pat1"
        />
      </svg>,
    );

    const rect = container.querySelector("[data-testid='pattern-arc-pat1'] rect");
    expect(rect?.getAttribute("fill-opacity")).toBe("0.18");
  });
});
