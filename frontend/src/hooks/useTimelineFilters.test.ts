import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LifeEventCategory, TraumaCategory } from "../types/domain";
import { useTimelineFilters } from "./useTimelineFilters";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
} from "./useTreeData";

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
    gender: "other",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

function makeEvent(
  id: string,
  personIds: string[],
  category: TraumaCategory = TraumaCategory.Loss,
  date = "2000",
): DecryptedEvent {
  return {
    id,
    person_ids: personIds,
    title: `Event ${id}`,
    description: "",
    category,
    approximate_date: date,
    severity: 5,
    tags: [],
  };
}

function makeLifeEvent(
  id: string,
  personIds: string[],
  category: LifeEventCategory = LifeEventCategory.Career,
  date = "2005",
): DecryptedLifeEvent {
  return {
    id,
    person_ids: personIds,
    title: `Life Event ${id}`,
    description: "",
    category,
    approximate_date: date,
    impact: 3,
    tags: [],
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
    dsm_category: "anxiety",
    dsm_subcategory: null,
    status: "diagnosed",
    diagnosis_year: 2010,
    periods: [{ start_year: 2010, end_year: null }],
    notes: null,
    ...overrides,
  };
}

function buildMaps() {
  const persons = new Map<string, DecryptedPerson>([
    ["p1", makePerson("p1")],
    ["p2", makePerson("p2")],
    ["p3", makePerson("p3")],
  ]);
  const events = new Map<string, DecryptedEvent>([
    ["e1", makeEvent("e1", ["p1"], TraumaCategory.Loss, "1995")],
    ["e2", makeEvent("e2", ["p2"], TraumaCategory.Abuse, "2005")],
    ["e3", makeEvent("e3", ["p1", "p2"], TraumaCategory.War, "2010")],
  ]);
  const lifeEvents = new Map<string, DecryptedLifeEvent>([
    ["le1", makeLifeEvent("le1", ["p1"], LifeEventCategory.Career, "2000")],
    ["le2", makeLifeEvent("le2", ["p3"], LifeEventCategory.Education, "1998")],
  ]);
  const classifications = new Map<string, DecryptedClassification>([
    ["c1", makeClassification("c1", ["p1"], { dsm_category: "anxiety", status: "diagnosed" })],
    ["c2", makeClassification("c2", ["p2"], { dsm_category: "depressive", status: "suspected" })],
  ]);
  return { persons, events, lifeEvents, classifications };
}

describe("useTimelineFilters", () => {
  it("starts with all filters null and zero active count", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    expect(result.current.filters.visiblePersonIds).toBeNull();
    expect(result.current.filters.traumaCategories).toBeNull();
    expect(result.current.filters.lifeEventCategories).toBeNull();
    expect(result.current.filters.classificationCategories).toBeNull();
    expect(result.current.filters.classificationStatus).toBeNull();
    expect(result.current.filters.timeRange).toBeNull();
    expect(result.current.actions.activeFilterCount).toBe(0);
  });

  it("produces empty dim sets when no filters active", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    expect(result.current.dims.dimmedPersonIds.size).toBe(0);
    expect(result.current.dims.dimmedEventIds.size).toBe(0);
    expect(result.current.dims.dimmedLifeEventIds.size).toBe(0);
    expect(result.current.dims.dimmedClassificationIds.size).toBe(0);
  });

  it("togglePerson hides one person and dims their events", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.togglePerson("p1");
    });

    expect(result.current.filters.visiblePersonIds).not.toBeNull();
    expect(result.current.filters.visiblePersonIds!.has("p1")).toBe(false);
    expect(result.current.filters.visiblePersonIds!.has("p2")).toBe(true);
    expect(result.current.filters.visiblePersonIds!.has("p3")).toBe(true);

    // p1 should be dimmed
    expect(result.current.dims.dimmedPersonIds.has("p1")).toBe(true);
    expect(result.current.dims.dimmedPersonIds.has("p2")).toBe(false);

    // e1 only links to p1 -> dimmed
    expect(result.current.dims.dimmedEventIds.has("e1")).toBe(true);
    // e3 links to p1 AND p2 -> not dimmed (p2 is still visible)
    expect(result.current.dims.dimmedEventIds.has("e3")).toBe(false);
    // le1 links to p1 -> dimmed
    expect(result.current.dims.dimmedLifeEventIds.has("le1")).toBe(true);
    // c1 links to p1 -> dimmed
    expect(result.current.dims.dimmedClassificationIds.has("c1")).toBe(true);

    expect(result.current.actions.activeFilterCount).toBe(1);
  });

  it("togglePerson back to visible resets to null when all visible", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.togglePerson("p1");
    });
    expect(result.current.filters.visiblePersonIds).not.toBeNull();

    act(() => {
      result.current.actions.togglePerson("p1");
    });
    // All persons visible again -> null
    expect(result.current.filters.visiblePersonIds).toBeNull();
    expect(result.current.actions.activeFilterCount).toBe(0);
  });

  it("toggleAllPersons deselects and selects all", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.toggleAllPersons(false);
    });
    expect(result.current.filters.visiblePersonIds).not.toBeNull();
    expect(result.current.filters.visiblePersonIds!.size).toBe(0);
    expect(result.current.dims.dimmedPersonIds.size).toBe(3);

    act(() => {
      result.current.actions.toggleAllPersons(true);
    });
    expect(result.current.filters.visiblePersonIds).toBeNull();
    expect(result.current.dims.dimmedPersonIds.size).toBe(0);
  });

  it("toggleTraumaCategory excludes that category and keeps others visible", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.toggleTraumaCategory(TraumaCategory.Loss);
    });

    // Loss is unchecked; Abuse and War stay visible
    expect(result.current.dims.dimmedEventIds.has("e1")).toBe(true); // Loss dimmed
    expect(result.current.dims.dimmedEventIds.has("e2")).toBe(false); // Abuse visible
    expect(result.current.dims.dimmedEventIds.has("e3")).toBe(false); // War visible
    expect(result.current.actions.activeFilterCount).toBe(1);
  });

  it("toggling same trauma category twice resets to null", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.toggleTraumaCategory(TraumaCategory.Loss);
    });
    act(() => {
      result.current.actions.toggleTraumaCategory(TraumaCategory.Loss);
    });

    expect(result.current.filters.traumaCategories).toBeNull();
    expect(result.current.dims.dimmedEventIds.size).toBe(0);
  });

  it("toggleLifeEventCategory excludes that category and keeps others visible", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.toggleLifeEventCategory(LifeEventCategory.Career);
    });

    // Career unchecked; Education stays visible
    expect(result.current.dims.dimmedLifeEventIds.has("le1")).toBe(true); // Career dimmed
    expect(result.current.dims.dimmedLifeEventIds.has("le2")).toBe(false); // Education visible
    expect(result.current.actions.activeFilterCount).toBe(1);
  });

  it("toggleClassificationCategory excludes that category and keeps others visible", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.toggleClassificationCategory("anxiety");
    });

    // anxiety unchecked; depressive stays visible
    expect(result.current.dims.dimmedClassificationIds.has("c1")).toBe(true); // anxiety dimmed
    expect(result.current.dims.dimmedClassificationIds.has("c2")).toBe(false); // depressive visible
  });

  it("toggleClassificationSubcategory excludes that subcategory", () => {
    const classWithSubs = new Map<string, DecryptedClassification>([
      [
        "c1",
        makeClassification("c1", ["p1"], {
          dsm_category: "anxiety",
          dsm_subcategory: "panic_disorder",
          status: "diagnosed",
        }),
      ],
      [
        "c2",
        makeClassification("c2", ["p2"], {
          dsm_category: "anxiety",
          dsm_subcategory: "social_anxiety",
          status: "diagnosed",
        }),
      ],
    ]);
    const { persons, events, lifeEvents } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classWithSubs),
    );

    act(() => {
      result.current.actions.toggleClassificationSubcategory("panic_disorder");
    });

    expect(result.current.dims.dimmedClassificationIds.has("c1")).toBe(true);
    expect(result.current.dims.dimmedClassificationIds.has("c2")).toBe(false);
  });

  it("toggleClassificationStatus excludes that status and keeps others visible", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.toggleClassificationStatus("diagnosed");
    });

    // diagnosed unchecked; suspected stays visible
    expect(result.current.dims.dimmedClassificationIds.has("c1")).toBe(true); // diagnosed dimmed
    expect(result.current.dims.dimmedClassificationIds.has("c2")).toBe(false); // suspected visible
  });

  it("setTimeRange dims events outside range", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.setTimeRange({ min: 1999, max: 2006 });
    });

    // e1 date=1995 -> outside -> dimmed
    expect(result.current.dims.dimmedEventIds.has("e1")).toBe(true);
    // e2 date=2005 -> inside -> not dimmed
    expect(result.current.dims.dimmedEventIds.has("e2")).toBe(false);
    // e3 date=2010 -> outside -> dimmed
    expect(result.current.dims.dimmedEventIds.has("e3")).toBe(true);
    // le1 date=2000 -> inside -> not dimmed
    expect(result.current.dims.dimmedLifeEventIds.has("le1")).toBe(false);
    // le2 date=1998 -> outside -> dimmed
    expect(result.current.dims.dimmedLifeEventIds.has("le2")).toBe(true);

    expect(result.current.actions.activeFilterCount).toBe(1);
  });

  it("setTimeRange to null clears time filter", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.setTimeRange({ min: 2000, max: 2005 });
    });
    act(() => {
      result.current.actions.setTimeRange(null);
    });

    expect(result.current.filters.timeRange).toBeNull();
    expect(result.current.dims.dimmedEventIds.size).toBe(0);
  });

  it("resetAll clears all filters", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.togglePerson("p1");
      result.current.actions.toggleTraumaCategory(TraumaCategory.Loss);
      result.current.actions.toggleLifeEventCategory(LifeEventCategory.Career);
      result.current.actions.setTimeRange({ min: 2000, max: 2010 });
    });
    expect(result.current.actions.activeFilterCount).toBe(4);

    act(() => {
      result.current.actions.resetAll();
    });

    expect(result.current.actions.activeFilterCount).toBe(0);
    expect(result.current.dims.dimmedPersonIds.size).toBe(0);
    expect(result.current.dims.dimmedEventIds.size).toBe(0);
  });

  it("multiple filter dimensions combine (person + category)", () => {
    const { persons, events, lifeEvents, classifications } = buildMaps();
    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      // Hide p2
      result.current.actions.togglePerson("p2");
      // Uncheck Loss category (Abuse and War remain visible)
      result.current.actions.toggleTraumaCategory(TraumaCategory.Loss);
    });

    // e1: Loss, p1 only -> person visible, but category excluded -> dimmed
    expect(result.current.dims.dimmedEventIds.has("e1")).toBe(true);
    // e2: Abuse, p2 only -> person dimmed -> dimmed
    expect(result.current.dims.dimmedEventIds.has("e2")).toBe(true);
    // e3: War, p1+p2 -> p1 visible, category visible -> NOT dimmed
    expect(result.current.dims.dimmedEventIds.has("e3")).toBe(false);

    expect(result.current.actions.activeFilterCount).toBe(2);
  });

  it("events with non-numeric dates are not time-filtered", () => {
    const persons = new Map<string, DecryptedPerson>([["p1", makePerson("p1")]]);
    const events = new Map<string, DecryptedEvent>([
      ["e1", makeEvent("e1", ["p1"], TraumaCategory.Loss, "early 2000s")],
    ]);
    const lifeEvents = new Map<string, DecryptedLifeEvent>();
    const classifications = new Map<string, DecryptedClassification>();

    const { result } = renderHook(() =>
      useTimelineFilters(persons, events, lifeEvents, classifications),
    );

    act(() => {
      result.current.actions.setTimeRange({ min: 2010, max: 2020 });
    });

    // Non-numeric date -> not time-filtered
    expect(result.current.dims.dimmedEventIds.has("e1")).toBe(false);
  });

  describe("pattern filtering", () => {
    function makePattern(
      id: string,
      linkedEntities: {
        entity_type: "trauma_event" | "life_event" | "classification";
        entity_id: string;
      }[],
    ): DecryptedPattern {
      return {
        id,
        name: `Pattern ${id}`,
        description: "",
        color: "#818cf8",
        linked_entities: linkedEntities,
        person_ids: [],
      };
    }

    it("starts with visiblePatterns null", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const patterns = new Map<string, DecryptedPattern>([
        ["pat1", makePattern("pat1", [{ entity_type: "trauma_event", entity_id: "e1" }])],
      ]);
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications, patterns),
      );

      expect(result.current.filters.visiblePatterns).toBeNull();
    });

    it("togglePatternFilter hides the toggled pattern", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const patterns = new Map<string, DecryptedPattern>([
        [
          "pat1",
          makePattern("pat1", [
            { entity_type: "trauma_event", entity_id: "e1" },
            { entity_type: "life_event", entity_id: "le1" },
          ]),
        ],
        ["pat2", makePattern("pat2", [{ entity_type: "trauma_event", entity_id: "e2" }])],
      ]);
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications, patterns),
      );

      act(() => {
        result.current.actions.togglePatternFilter("pat1");
      });

      // pat1 hidden, pat2 still visible
      expect(result.current.filters.visiblePatterns).not.toBeNull();
      expect(result.current.filters.visiblePatterns!.has("pat1")).toBe(false);
      expect(result.current.filters.visiblePatterns!.has("pat2")).toBe(true);
      expect(result.current.actions.activeFilterCount).toBe(1);

      // e2 is linked to visible pat2 -> not dimmed
      expect(result.current.dims.dimmedEventIds.has("e2")).toBe(false);
      // e1 is only linked to hidden pat1 -> dimmed by pattern filter
      expect(result.current.dims.dimmedEventIds.has("e1")).toBe(true);
    });

    it("togglePatternFilter twice resets to null", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const patterns = new Map<string, DecryptedPattern>([
        ["pat1", makePattern("pat1", [{ entity_type: "trauma_event", entity_id: "e1" }])],
      ]);
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications, patterns),
      );

      act(() => {
        result.current.actions.togglePatternFilter("pat1");
      });
      act(() => {
        result.current.actions.togglePatternFilter("pat1");
      });

      expect(result.current.filters.visiblePatterns).toBeNull();
      expect(result.current.actions.activeFilterCount).toBe(0);
    });

    it("resetAll also clears pattern filter", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const patterns = new Map<string, DecryptedPattern>([
        ["pat1", makePattern("pat1", [{ entity_type: "trauma_event", entity_id: "e1" }])],
      ]);
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications, patterns),
      );

      act(() => {
        result.current.actions.togglePatternFilter("pat1");
      });
      expect(result.current.actions.activeFilterCount).toBe(1);

      act(() => {
        result.current.actions.resetAll();
      });

      expect(result.current.filters.visiblePatterns).toBeNull();
      expect(result.current.actions.activeFilterCount).toBe(0);
    });

    it("pattern filter dims life events and classifications not in visible patterns", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const patterns = new Map<string, DecryptedPattern>([
        [
          "pat1",
          makePattern("pat1", [
            { entity_type: "life_event", entity_id: "le1" },
            { entity_type: "classification", entity_id: "c1" },
          ]),
        ],
        ["pat2", makePattern("pat2", [{ entity_type: "trauma_event", entity_id: "e1" }])],
      ]);
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications, patterns),
      );

      act(() => {
        result.current.actions.togglePatternFilter("pat2");
      });

      // pat2 hidden, pat1 visible -> le1 and c1 are linked to pat1 -> not dimmed
      expect(result.current.dims.dimmedLifeEventIds.has("le1")).toBe(false);
      expect(result.current.dims.dimmedClassificationIds.has("c1")).toBe(false);
      // le2 is not linked to any visible pattern -> dimmed
      expect(result.current.dims.dimmedLifeEventIds.has("le2")).toBe(true);
      // c2 is not linked to any visible pattern -> dimmed
      expect(result.current.dims.dimmedClassificationIds.has("c2")).toBe(true);
    });

    it("pattern filter combines with other filters", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const patterns = new Map<string, DecryptedPattern>([
        [
          "pat1",
          makePattern("pat1", [
            { entity_type: "trauma_event", entity_id: "e1" },
            { entity_type: "trauma_event", entity_id: "e2" },
          ]),
        ],
        ["pat2", makePattern("pat2", [{ entity_type: "trauma_event", entity_id: "e3" }])],
      ]);
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications, patterns),
      );

      act(() => {
        // Hide pat2 -> only pat1 visible (e1 and e2 linked)
        result.current.actions.togglePatternFilter("pat2");
        // Category filter: uncheck Loss (Abuse and War remain visible)
        result.current.actions.toggleTraumaCategory(TraumaCategory.Loss);
      });

      // e1: Loss, linked to visible pat1 -> not dimmed by pattern, but dimmed by category
      expect(result.current.dims.dimmedEventIds.has("e1")).toBe(true);
      // e2: Abuse, linked to visible pat1 -> not dimmed by pattern, category visible -> NOT dimmed
      expect(result.current.dims.dimmedEventIds.has("e2")).toBe(false);
      // e3: War, linked to hidden pat2 -> dimmed by pattern
      expect(result.current.dims.dimmedEventIds.has("e3")).toBe(true);
    });
  });

  describe("togglePersonGroup", () => {
    it("from null (all visible) sets to group members only", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      act(() => {
        result.current.actions.togglePersonGroup("gender:female", new Set(["p1", "p2"]));
      });

      expect(result.current.filters.visiblePersonIds).not.toBeNull();
      expect(result.current.filters.visiblePersonIds!.has("p1")).toBe(true);
      expect(result.current.filters.visiblePersonIds!.has("p2")).toBe(true);
      expect(result.current.filters.visiblePersonIds!.has("p3")).toBe(false);
    });

    it("unions groups within same category", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      act(() => {
        result.current.actions.togglePersonGroup("gender:female", new Set(["p1"]));
      });
      act(() => {
        result.current.actions.togglePersonGroup("gender:male", new Set(["p2"]));
      });

      // Same category (gender) -> union: p1 + p2
      expect(result.current.filters.visiblePersonIds!.has("p1")).toBe(true);
      expect(result.current.filters.visiblePersonIds!.has("p2")).toBe(true);
    });

    it("removes group when toggled again", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      act(() => {
        result.current.actions.togglePersonGroup("gender:female", new Set(["p1", "p2"]));
      });
      // Toggle same group off
      act(() => {
        result.current.actions.togglePersonGroup("gender:female", new Set(["p1", "p2"]));
      });

      // No active groups -> resets to null
      expect(result.current.filters.visiblePersonIds).toBeNull();
    });

    it("intersects groups across different categories", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      // Category "gender": p1, p2
      act(() => {
        result.current.actions.togglePersonGroup("gender:female", new Set(["p1", "p2"]));
      });
      // Category "gen": p1, p3
      act(() => {
        result.current.actions.togglePersonGroup("gen:0", new Set(["p1", "p3"]));
      });

      // Intersection: only p1 (in both gender:female AND gen:0)
      expect(result.current.filters.visiblePersonIds).not.toBeNull();
      expect(result.current.filters.visiblePersonIds!.has("p1")).toBe(true);
      expect(result.current.filters.visiblePersonIds!.has("p2")).toBe(false);
      expect(result.current.filters.visiblePersonIds!.has("p3")).toBe(false);
    });

    it("union within category, intersect across categories", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      // Category "gender": female={p1}, male={p2} -> union = {p1, p2}
      act(() => {
        result.current.actions.togglePersonGroup("gender:female", new Set(["p1"]));
      });
      act(() => {
        result.current.actions.togglePersonGroup("gender:male", new Set(["p2"]));
      });
      // Category "gen": gen0={p2, p3}
      act(() => {
        result.current.actions.togglePersonGroup("gen:0", new Set(["p2", "p3"]));
      });

      // gender union = {p1, p2}, gen union = {p2, p3}, intersection = {p2}
      expect(result.current.filters.visiblePersonIds).not.toBeNull();
      expect(result.current.filters.visiblePersonIds!.has("p1")).toBe(false);
      expect(result.current.filters.visiblePersonIds!.has("p2")).toBe(true);
      expect(result.current.filters.visiblePersonIds!.has("p3")).toBe(false);
    });

    it("removing cross-category group restores broader visibility", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      act(() => {
        result.current.actions.togglePersonGroup("gender:female", new Set(["p1", "p2"]));
      });
      act(() => {
        result.current.actions.togglePersonGroup("gen:0", new Set(["p1"]));
      });

      // Intersection = {p1}
      expect(result.current.filters.visiblePersonIds!.has("p1")).toBe(true);
      expect(result.current.filters.visiblePersonIds!.has("p2")).toBe(false);

      // Remove gen:0 -> only gender:female left -> {p1, p2}
      act(() => {
        result.current.actions.togglePersonGroup("gen:0", new Set(["p1"]));
      });

      expect(result.current.filters.visiblePersonIds!.has("p1")).toBe(true);
      expect(result.current.filters.visiblePersonIds!.has("p2")).toBe(true);
    });

    it("tracks activeGroupKeys", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      expect(result.current.filters.activeGroupKeys.size).toBe(0);

      act(() => {
        result.current.actions.togglePersonGroup("gender:female", new Set(["p1"]));
      });
      expect(result.current.filters.activeGroupKeys.has("gender:female")).toBe(true);

      act(() => {
        result.current.actions.togglePersonGroup("gen:0", new Set(["p1", "p2"]));
      });
      expect(result.current.filters.activeGroupKeys.has("gender:female")).toBe(true);
      expect(result.current.filters.activeGroupKeys.has("gen:0")).toBe(true);

      act(() => {
        result.current.actions.togglePersonGroup("gender:female", new Set(["p1"]));
      });
      expect(result.current.filters.activeGroupKeys.has("gender:female")).toBe(false);
      expect(result.current.filters.activeGroupKeys.has("gen:0")).toBe(true);
    });
  });

  describe("filterMode", () => {
    it("defaults to dim", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      expect(result.current.filters.filterMode).toBe("dim");
    });

    it("setFilterMode changes mode", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      act(() => {
        result.current.actions.setFilterMode("hide");
      });

      expect(result.current.filters.filterMode).toBe("hide");
    });

    it("resetAll resets filterMode to dim", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      act(() => {
        result.current.actions.setFilterMode("hide");
      });
      expect(result.current.filters.filterMode).toBe("hide");

      act(() => {
        result.current.actions.resetAll();
      });
      expect(result.current.filters.filterMode).toBe("dim");
    });
  });

  describe("applyQuickFilter", () => {
    it("trauma preset clears life events and classifications", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      act(() => {
        result.current.actions.applyQuickFilter("trauma");
      });

      expect(result.current.filters.traumaCategories).toBeNull();
      expect(result.current.filters.lifeEventCategories).not.toBeNull();
      expect(result.current.filters.lifeEventCategories!.size).toBe(0);
      expect(result.current.filters.classificationCategories).not.toBeNull();
      expect(result.current.filters.classificationCategories!.size).toBe(0);
    });

    it("lifeEvents preset clears trauma and classifications", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      act(() => {
        result.current.actions.applyQuickFilter("lifeEvents");
      });

      expect(result.current.filters.lifeEventCategories).toBeNull();
      expect(result.current.filters.traumaCategories).not.toBeNull();
      expect(result.current.filters.traumaCategories!.size).toBe(0);
      expect(result.current.filters.classificationCategories).not.toBeNull();
      expect(result.current.filters.classificationCategories!.size).toBe(0);
    });

    it("classifications preset clears trauma and life events", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      act(() => {
        result.current.actions.applyQuickFilter("classifications");
      });

      expect(result.current.filters.classificationCategories).toBeNull();
      expect(result.current.filters.traumaCategories).not.toBeNull();
      expect(result.current.filters.traumaCategories!.size).toBe(0);
      expect(result.current.filters.lifeEventCategories).not.toBeNull();
      expect(result.current.filters.lifeEventCategories!.size).toBe(0);
    });

    it("toggling active preset resets all category filters", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      // Apply trauma preset
      act(() => {
        result.current.actions.applyQuickFilter("trauma");
      });

      // Toggle off (same preset while active)
      act(() => {
        result.current.actions.applyQuickFilter("trauma");
      });

      expect(result.current.filters.traumaCategories).toBeNull();
      expect(result.current.filters.lifeEventCategories).toBeNull();
      expect(result.current.filters.classificationCategories).toBeNull();
    });

    it("switching from one preset to another", () => {
      const { persons, events, lifeEvents, classifications } = buildMaps();
      const { result } = renderHook(() =>
        useTimelineFilters(persons, events, lifeEvents, classifications),
      );

      act(() => {
        result.current.actions.applyQuickFilter("trauma");
      });
      act(() => {
        result.current.actions.applyQuickFilter("lifeEvents");
      });

      expect(result.current.filters.lifeEventCategories).toBeNull();
      expect(result.current.filters.traumaCategories).not.toBeNull();
      expect(result.current.filters.traumaCategories!.size).toBe(0);
    });
  });
});
