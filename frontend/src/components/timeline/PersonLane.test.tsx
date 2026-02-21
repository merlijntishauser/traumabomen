import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { LifeEventCategory, TraumaCategory, TurningPointCategory } from "../../types/domain";
import { collectDateLabelEntries, type LabelEntry, PersonLane, stackLabels } from "./PersonLane";
import type { PatternRingsMap } from "./TimelinePatternLanes";
import { BAR_HEIGHT, MARKER_RADIUS, ROW_HEIGHT } from "./timelineHelpers";

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

const defaultTurningPointColors = {
  [TurningPointCategory.CycleBreaking]: "#34d399",
  [TurningPointCategory.ProtectiveRelationship]: "#60a5fa",
  [TurningPointCategory.Recovery]: "#a78bfa",
  [TurningPointCategory.Achievement]: "#fbbf24",
  [TurningPointCategory.PositiveChange]: "#2dd4bf",
} as Record<TurningPointCategory, string>;

const defaultProps = {
  currentYear: 2025,
  persons: new Map<string, DecryptedPerson>(),
  traumaColors: {
    [TraumaCategory.Loss]: "#ff0000",
    [TraumaCategory.Abuse]: "#cc0000",
  } as Record<TraumaCategory, string>,
  lifeEventColors: {
    [LifeEventCategory.Career]: "#00ff00",
    [LifeEventCategory.Relocation]: "#0000ff",
  } as Record<LifeEventCategory, string>,
  xScale: (v: number) => v,
  cssVar: (name: string) => name,
  t: (key: string) => key,
  onTooltip: vi.fn(),
};

function renderLane(overrides: Record<string, unknown> = {}) {
  const person = makePerson("a", { birth_year: 1980 });
  const props = {
    ...defaultProps,
    person,
    y: 20,
    events: [] as DecryptedEvent[],
    lifeEvents: [] as DecryptedLifeEvent[],
    classifications: [] as DecryptedClassification[],
    persons: new Map([["a", person]]),
    onTooltip: vi.fn(),
    ...overrides,
  };

  return {
    ...render(
      <svg>
        <PersonLane {...props} />
      </svg>,
    ),
    props,
  };
}

describe("stackLabels", () => {
  it("returns empty map for no entries", () => {
    const result = stackLabels([], 4, 12);
    expect(result.size).toBe(0);
  });

  it("places non-overlapping entries all at offset 0", () => {
    const entries: LabelEntry[] = [
      { x: 0, w: 10, key: "a" },
      { x: 20, w: 10, key: "b" },
      { x: 40, w: 10, key: "c" },
    ];
    const result = stackLabels(entries, 4, 12);
    expect(result.get("a")).toBe(0);
    expect(result.get("b")).toBe(0);
    expect(result.get("c")).toBe(0);
  });

  it("stacks overlapping entries to different levels", () => {
    const entries: LabelEntry[] = [
      { x: 0, w: 30, key: "a" },
      { x: 10, w: 30, key: "b" },
      { x: 20, w: 30, key: "c" },
    ];
    const result = stackLabels(entries, 4, 12);
    expect(result.get("a")).toBe(0);
    expect(result.get("b")).toBe(12);
    expect(result.get("c")).toBe(24);
  });

  it("reuses levels once space is available", () => {
    const entries: LabelEntry[] = [
      { x: 0, w: 10, key: "a" },
      { x: 5, w: 10, key: "b" },
      { x: 20, w: 10, key: "c" },
    ];
    const result = stackLabels(entries, 4, 12);
    expect(result.get("a")).toBe(0);
    expect(result.get("b")).toBe(12);
    // "c" at x=20 can reuse level 0 (a ends at x=10, 10+4=14 <= 20)
    expect(result.get("c")).toBe(0);
  });
});

describe("collectDateLabelEntries", () => {
  const identity = (v: number) => v;

  it("returns entries for items with numeric dates", () => {
    const items = [
      { id: "a", approximate_date: "2000", title: "Alpha" },
      { id: "b", approximate_date: "2005", title: "Beta" },
    ];
    const result = collectDateLabelEntries(items, undefined, "dim", identity, 6, "t");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 2000, w: 5 * 6, key: "t:a" });
    expect(result[1]).toEqual({ x: 2005, w: 4 * 6, key: "t:b" });
  });

  it("skips items whose id is in dimmedIds when filterMode is 'hide'", () => {
    const items = [
      { id: "a", approximate_date: "2000", title: "Alpha" },
      { id: "b", approximate_date: "2005", title: "Beta" },
      { id: "c", approximate_date: "2010", title: "Gamma" },
    ];
    const dimmedIds = new Set(["a", "c"]);
    const result = collectDateLabelEntries(items, dimmedIds, "hide", identity, 6, "ev");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("ev:b");
  });

  it("keeps dimmed items when filterMode is 'dim' (not hide)", () => {
    const items = [
      { id: "a", approximate_date: "2000", title: "Alpha" },
      { id: "b", approximate_date: "2005", title: "Beta" },
    ];
    const dimmedIds = new Set(["a"]);
    const result = collectDateLabelEntries(items, dimmedIds, "dim", identity, 6, "t");
    expect(result).toHaveLength(2);
  });

  it("skips items with non-numeric approximate_date", () => {
    const items = [
      { id: "a", approximate_date: "circa 2000", title: "Vague" },
      { id: "b", approximate_date: "2005", title: "Exact" },
    ];
    const result = collectDateLabelEntries(items, undefined, "dim", identity, 6, "t");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("t:b");
  });
});

describe("PersonLane", () => {
  describe("life bar", () => {
    it("renders a rect for person with birth_year", () => {
      const { container } = renderLane();
      const lifeBar = container.querySelector(".tl-lifebar");
      expect(lifeBar).not.toBeNull();
      expect(lifeBar!.getAttribute("rx")).toBe("3");
    });

    it("does not render life bar when birth_year is null", () => {
      const person = makePerson("a", { birth_year: null });
      const { container } = renderLane({ person });
      expect(container.querySelector(".tl-lifebar")).toBeNull();
    });

    it("positions life bar correctly", () => {
      const { container } = renderLane({ y: 40 });
      const rect = container.querySelector(".tl-lifebar")!;
      const expectedY = 40 + (ROW_HEIGHT - BAR_HEIGHT) / 2;
      expect(rect.getAttribute("y")).toBe(String(expectedY));
      expect(rect.getAttribute("x")).toBe("1980");
    });

    it("uses death_year for width when present", () => {
      const person = makePerson("a", { birth_year: 1950, death_year: 2000 });
      const { container } = renderLane({ person });
      const rect = container.querySelector(".tl-lifebar")!;
      expect(rect.getAttribute("width")).toBe("50");
    });

    it("uses currentYear for width when death_year is null", () => {
      const { container } = renderLane();
      const rect = container.querySelector(".tl-lifebar")!;
      expect(rect.getAttribute("width")).toBe(String(2025 - 1980));
    });

    it("clamps width to zero minimum", () => {
      const person = makePerson("a", { birth_year: 2000, death_year: 1990 });
      const { container } = renderLane({ person });
      const rect = container.querySelector(".tl-lifebar")!;
      expect(rect.getAttribute("width")).toBe("0");
    });
  });

  describe("trauma markers", () => {
    it("renders circles for trauma events", () => {
      const events = [makeEvent("e1", ["a"])];
      const { container } = renderLane({ events });
      const circles = container.querySelectorAll("circle");
      expect(circles).toHaveLength(1);
    });

    it("positions circle at event year and row center", () => {
      const events = [makeEvent("e1", ["a"], { approximate_date: "1995" })];
      const { container } = renderLane({ events, y: 20 });
      const circle = container.querySelector("circle")!;
      expect(circle.getAttribute("cx")).toBe("1995");
      expect(circle.getAttribute("cy")).toBe(String(20 + ROW_HEIGHT / 2));
    });

    it("uses correct trauma color", () => {
      const events = [makeEvent("e1", ["a"], { category: TraumaCategory.Loss })];
      const { container } = renderLane({ events });
      const circle = container.querySelector("circle")!;
      expect(circle.getAttribute("fill")).toBe("#ff0000");
    });

    it("sets marker radius and class", () => {
      const events = [makeEvent("e1", ["a"])];
      const { container } = renderLane({ events });
      const circle = container.querySelector("circle")!;
      expect(circle.getAttribute("r")).toBe(String(MARKER_RADIUS));
      expect(circle.classList.contains("tl-marker")).toBe(true);
    });

    it("skips events with non-numeric dates", () => {
      const events = [makeEvent("e1", ["a"], { approximate_date: "circa 2000" })];
      const { container } = renderLane({ events });
      expect(container.querySelectorAll("circle")).toHaveLength(0);
    });

    it("shows tooltip on mouseenter", () => {
      const events = [makeEvent("e1", ["a"], { title: "War trauma" })];
      const { container, props } = renderLane({ events });
      const circle = container.querySelector("circle")!;

      fireEvent.mouseEnter(circle, { clientX: 100, clientY: 200 });

      expect(props.onTooltip).toHaveBeenCalledWith(
        expect.objectContaining({
          visible: true,
          lines: expect.arrayContaining([
            expect.objectContaining({ text: "War trauma", bold: true }),
          ]),
        }),
      );
    });

    it("hides tooltip on mouseleave", () => {
      const events = [makeEvent("e1", ["a"])];
      const { container, props } = renderLane({ events });
      const circle = container.querySelector("circle")!;

      fireEvent.mouseLeave(circle);

      expect(props.onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
    });
  });

  describe("life event markers", () => {
    it("renders rotated rects for life events", () => {
      const lifeEvents = [makeLifeEvent("le1", ["a"])];
      const { container } = renderLane({ lifeEvents });
      // Life bar + diamond = 2 rects
      const rects = container.querySelectorAll("rect");
      const diamond = rects[rects.length - 1];
      expect(diamond.getAttribute("transform")).toContain("rotate(45");
    });

    it("uses correct diamond size", () => {
      const lifeEvents = [makeLifeEvent("le1", ["a"], { approximate_date: "2005" })];
      const diamondSize = MARKER_RADIUS * 0.9;
      const { container } = renderLane({ lifeEvents, y: 40 });
      const rects = container.querySelectorAll("rect");
      const diamond = rects[rects.length - 1];
      expect(diamond.getAttribute("width")).toBe(String(diamondSize * 2));
      expect(diamond.getAttribute("height")).toBe(String(diamondSize * 2));
    });

    it("uses correct life event color", () => {
      const lifeEvents = [makeLifeEvent("le1", ["a"], { category: LifeEventCategory.Career })];
      const { container } = renderLane({ lifeEvents });
      const rects = container.querySelectorAll("rect");
      const diamond = rects[rects.length - 1];
      expect(diamond.getAttribute("fill")).toBe("#00ff00");
    });

    it("skips events with non-numeric dates", () => {
      const lifeEvents = [makeLifeEvent("le1", ["a"], { approximate_date: "unknown" })];
      const { container } = renderLane({ lifeEvents });
      // Only life bar + hit area rects (no diamond)
      const diamonds = container.querySelectorAll("rect[transform]");
      expect(diamonds).toHaveLength(0);
    });

    it("shows tooltip on mouseenter", () => {
      const lifeEvents = [makeLifeEvent("le1", ["a"], { title: "Graduated" })];
      const { container, props } = renderLane({ lifeEvents });
      const rects = container.querySelectorAll("rect");
      const diamond = rects[rects.length - 1];

      fireEvent.mouseEnter(diamond, { clientX: 50, clientY: 100 });

      expect(props.onTooltip).toHaveBeenCalledWith(
        expect.objectContaining({
          visible: true,
          lines: expect.arrayContaining([
            expect.objectContaining({ text: "Graduated", bold: true }),
          ]),
        }),
      );
    });

    it("includes impact in tooltip when present", () => {
      const lifeEvents = [makeLifeEvent("le1", ["a"], { title: "Move", impact: 7 })];
      const { container, props } = renderLane({ lifeEvents });
      const rects = container.querySelectorAll("rect");
      const diamond = rects[rects.length - 1];

      fireEvent.mouseEnter(diamond, { clientX: 0, clientY: 0 });

      const call = props.onTooltip.mock.calls.find(
        (c: Array<{ visible: boolean }>) => c[0].visible,
      );
      const lines = call[0].lines.map((l: { text: string }) => l.text);
      expect(lines).toContain("timeline.impact");
    });

    it("excludes impact from tooltip when null", () => {
      const lifeEvents = [makeLifeEvent("le1", ["a"], { title: "Move", impact: null })];
      const { container, props } = renderLane({ lifeEvents });
      const rects = container.querySelectorAll("rect");
      const diamond = rects[rects.length - 1];

      fireEvent.mouseEnter(diamond, { clientX: 0, clientY: 0 });

      const call = props.onTooltip.mock.calls.find(
        (c: Array<{ visible: boolean }>) => c[0].visible,
      );
      const lines = call[0].lines.map((l: { text: string }) => l.text);
      expect(lines).not.toContain("timeline.impact");
    });
  });

  describe("classification strips", () => {
    it("renders strips for classification periods", () => {
      const classifications = [makeClassification("c1", ["a"])];
      const { container } = renderLane({ classifications });
      // Hit area + Life bar + 1 classification period strip = 3 rects
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBeGreaterThanOrEqual(3);
    });

    it("does not render strips when birth_year is null", () => {
      const person = makePerson("a", { birth_year: null });
      const classifications = [makeClassification("c1", ["a"])];
      const { container } = renderLane({ person, classifications });
      // Only hit area rect remains
      expect(container.querySelector(".tl-lifebar")).toBeNull();
      expect(container.querySelectorAll(".tl-marker")).toHaveLength(0);
    });

    it("uses diagnosed color for diagnosed classifications", () => {
      const classifications = [
        makeClassification("c1", ["a"], { status: "diagnosed", diagnosis_year: 2005 }),
      ];
      const { container } = renderLane({ classifications });
      // Classification strip is the .tl-marker rect (not the hit area or life bar)
      const strips = container.querySelectorAll("rect.tl-marker");
      expect(strips[0].getAttribute("fill")).toBe("--color-classification-diagnosed");
    });

    it("uses suspected color for suspected classifications", () => {
      const classifications = [makeClassification("c1", ["a"], { status: "suspected" })];
      const { container } = renderLane({ classifications });
      const strips = container.querySelectorAll("rect.tl-marker");
      expect(strips[0].getAttribute("fill")).toBe("--color-classification-suspected");
    });

    it("renders diagnosis triangle for diagnosed with year", () => {
      const classifications = [
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: 2005,
        }),
      ];
      const { container } = renderLane({ classifications });
      const paths = container.querySelectorAll("path");
      expect(paths).toHaveLength(1);
      expect(paths[0].classList.contains("tl-marker")).toBe(true);
    });

    it("does not render diagnosis triangle for suspected", () => {
      const classifications = [makeClassification("c1", ["a"], { status: "suspected" })];
      const { container } = renderLane({ classifications });
      expect(container.querySelectorAll("path")).toHaveLength(0);
    });

    it("does not render diagnosis triangle when year is null", () => {
      const classifications = [
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: null,
        }),
      ];
      const { container } = renderLane({ classifications });
      expect(container.querySelectorAll("path")).toHaveLength(0);
    });

    it("shows tooltip on classification strip mouseenter", () => {
      const classifications = [makeClassification("c1", ["a"], { dsm_category: "depressive" })];
      const { container, props } = renderLane({ classifications });
      const strip = container.querySelector("rect.tl-marker")!;

      fireEvent.mouseEnter(strip, { clientX: 100, clientY: 200 });

      expect(props.onTooltip).toHaveBeenCalledWith(
        expect.objectContaining({
          visible: true,
          lines: expect.arrayContaining([
            expect.objectContaining({ text: "dsm.depressive", bold: true }),
          ]),
        }),
      );
    });

    it("shows tooltip on diagnosis triangle mouseenter", () => {
      const classifications = [
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: 2005,
          dsm_category: "anxiety",
        }),
      ];
      const { container, props } = renderLane({ classifications });
      const path = container.querySelector("path")!;

      fireEvent.mouseEnter(path, { clientX: 150, clientY: 250 });

      expect(props.onTooltip).toHaveBeenCalledWith(
        expect.objectContaining({
          visible: true,
          lines: expect.arrayContaining([
            expect.objectContaining({ text: "dsm.anxiety", bold: true }),
          ]),
        }),
      );
    });

    it("renders multiple periods as separate rects", () => {
      const classifications = [
        makeClassification("c1", ["a"], {
          periods: [
            { start_year: 2000, end_year: 2005 },
            { start_year: 2008, end_year: 2012 },
          ],
        }),
      ];
      const { container } = renderLane({ classifications });
      // 2 period strip rects with tl-marker class
      const strips = container.querySelectorAll("rect.tl-marker");
      expect(strips).toHaveLength(2);
    });
  });

  describe("showClassifications", () => {
    it("hides classification strips when showClassifications is false", () => {
      const classifications = [makeClassification("c1", ["a"])];
      const { container } = renderLane({ classifications, showClassifications: false });
      const strips = container.querySelectorAll("rect.tl-marker");
      expect(strips).toHaveLength(0);
    });

    it("shows classification strips when showClassifications is true (default)", () => {
      const classifications = [makeClassification("c1", ["a"])];
      const { container } = renderLane({ classifications });
      const strips = container.querySelectorAll("rect.tl-marker");
      expect(strips).toHaveLength(1);
    });
  });

  describe("marker labels", () => {
    it("renders label text next to trauma marker by default", () => {
      const events = [makeEvent("e1", ["a"], { title: "War trauma" })];
      const { container } = renderLane({ events });
      const labels = container.querySelectorAll(".tl-marker-label");
      expect(labels).toHaveLength(1);
      expect(labels[0].textContent).toBe("War trauma");
    });

    it("renders label text next to life event marker by default", () => {
      const lifeEvents = [makeLifeEvent("le1", ["a"], { title: "Graduated" })];
      const { container } = renderLane({ lifeEvents });
      const labels = container.querySelectorAll(".tl-marker-label");
      expect(labels).toHaveLength(1);
      expect(labels[0].textContent).toBe("Graduated");
    });

    it("renders label next to classification strip using subcategory", () => {
      const classifications = [
        makeClassification("c1", ["a"], {
          dsm_category: "depressive",
          dsm_subcategory: "major_depression",
        }),
      ];
      const { container } = renderLane({ classifications });
      const labels = container.querySelectorAll(".tl-marker-label");
      expect(labels.length).toBeGreaterThanOrEqual(1);
      expect(labels[0].textContent).toBe("dsm.sub.major_depression");
    });

    it("renders label next to classification strip using category when no subcategory", () => {
      const classifications = [
        makeClassification("c1", ["a"], {
          dsm_category: "depressive",
          dsm_subcategory: null,
        }),
      ];
      const { container } = renderLane({ classifications });
      const labels = container.querySelectorAll(".tl-marker-label");
      expect(labels.length).toBeGreaterThanOrEqual(1);
      expect(labels[0].textContent).toBe("dsm.depressive");
    });

    it("renders label next to diagnosis triangle", () => {
      const classifications = [
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: 2005,
          dsm_category: "anxiety",
          dsm_subcategory: null,
        }),
      ];
      const { container } = renderLane({ classifications });
      const labels = container.querySelectorAll(".tl-marker-label");
      // Strip label + triangle label
      const triangleLabel = Array.from(labels).find((l) => l.textContent === "dsm.anxiety");
      expect(triangleLabel).toBeTruthy();
    });

    it("does not duplicate label when diagnosis_year equals period start_year", () => {
      const classifications = [
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: 2000,
          dsm_category: "anxiety",
          dsm_subcategory: null,
          periods: [{ start_year: 2000, end_year: null }],
        }),
      ];
      const { container } = renderLane({ classifications });
      const labels = Array.from(container.querySelectorAll(".tl-marker-label")).filter(
        (l) => l.textContent === "dsm.anxiety",
      );
      expect(labels).toHaveLength(1);
    });

    it("hides all marker labels when showMarkerLabels is false", () => {
      const events = [makeEvent("e1", ["a"])];
      const lifeEvents = [makeLifeEvent("le1", ["a"])];
      const { container } = renderLane({ events, lifeEvents, showMarkerLabels: false });
      const labels = container.querySelectorAll(".tl-marker-label");
      expect(labels).toHaveLength(0);
    });
  });

  describe("annotate mode", () => {
    it("uses crosshair cursor in annotate mode", () => {
      const { container } = renderLane({ mode: "annotate" });
      const hitarea = container.querySelector(".tl-lane-hitarea--annotate");
      expect(hitarea).not.toBeNull();
    });

    it("renders selection ring around selected trauma marker", () => {
      const events = [makeEvent("e1", ["a"])];
      const selectedEntityKeys = new Set(["trauma_event:e1"]);
      const { container } = renderLane({ events, mode: "annotate", selectedEntityKeys });
      const rings = container.querySelectorAll(".tl-selection-ring");
      expect(rings).toHaveLength(1);
    });

    it("does not render selection ring when marker is not selected", () => {
      const events = [makeEvent("e1", ["a"])];
      const selectedEntityKeys = new Set<string>();
      const { container } = renderLane({ events, mode: "annotate", selectedEntityKeys });
      const rings = container.querySelectorAll(".tl-selection-ring");
      expect(rings).toHaveLength(0);
    });

    it("calls onToggleEntitySelect on marker click in annotate mode", () => {
      const onToggleEntitySelect = vi.fn();
      const events = [makeEvent("e1", ["a"])];
      const { container } = renderLane({
        events,
        mode: "annotate",
        onToggleEntitySelect,
      });
      const circle = container.querySelector("circle.tl-marker")!;
      fireEvent.click(circle);
      expect(onToggleEntitySelect).toHaveBeenCalledWith("trauma_event:e1");
    });

    it("calls onToggleEntitySelect on life event diamond click in annotate mode", () => {
      const onToggleEntitySelect = vi.fn();
      const lifeEvents = [makeLifeEvent("le1", ["a"])];
      const { container } = renderLane({
        lifeEvents,
        mode: "annotate",
        onToggleEntitySelect,
      });
      const diamond = container.querySelector("rect[transform]")!;
      fireEvent.click(diamond);
      expect(onToggleEntitySelect).toHaveBeenCalledWith("life_event:le1");
    });

    it("calls onClickMarker on classification strip click in explore mode", () => {
      const onClickMarker = vi.fn();
      const classifications = [
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: 2005,
          periods: [{ start_year: 2000, end_year: 2010 }],
        }),
      ];
      const { container } = renderLane({
        classifications,
        mode: "explore",
        onClickMarker,
      });
      const strip = container.querySelector("rect.tl-marker")!;
      fireEvent.click(strip);
      expect(onClickMarker).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: "classification", entityId: "c1" }),
      );
    });

    it("calls onClickMarker on life event diamond click in explore mode", () => {
      const onClickMarker = vi.fn();
      const lifeEvents = [makeLifeEvent("le1", ["a"])];
      const { container } = renderLane({
        lifeEvents,
        mode: "explore",
        onClickMarker,
      });
      const diamond = container.querySelector("rect[transform]")!;
      fireEvent.click(diamond);
      expect(onClickMarker).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: "life_event", entityId: "le1" }),
      );
    });

    it("does not call onClickMarker in annotate mode", () => {
      const onClickMarker = vi.fn();
      const events = [makeEvent("e1", ["a"])];
      const { container } = renderLane({
        events,
        mode: "annotate",
        onClickMarker,
      });
      const circle = container.querySelector("circle.tl-marker")!;
      fireEvent.click(circle);
      expect(onClickMarker).not.toHaveBeenCalled();
    });
  });

  describe("filterMode hide", () => {
    it("does not render trauma markers for dimmed events when filterMode is hide", () => {
      const events = [
        makeEvent("e1", ["a"], { approximate_date: "1990" }),
        makeEvent("e2", ["a"], { approximate_date: "1995" }),
      ];
      const dims = {
        dimmedPersonIds: new Set<string>(),
        dimmedEventIds: new Set(["e1"]),
        dimmedLifeEventIds: new Set<string>(),
        dimmedTurningPointIds: new Set<string>(),
        dimmedClassificationIds: new Set<string>(),
      };
      const { container } = renderLane({ events, dims, filterMode: "hide" });
      // Only e2 should be rendered (e1 is hidden)
      const circles = container.querySelectorAll("circle.tl-marker");
      expect(circles).toHaveLength(1);
    });

    it("does not render life event markers for dimmed life events when filterMode is hide", () => {
      const lifeEvents = [
        makeLifeEvent("le1", ["a"], { approximate_date: "1990" }),
        makeLifeEvent("le2", ["a"], { approximate_date: "1995" }),
      ];
      const dims = {
        dimmedPersonIds: new Set<string>(),
        dimmedEventIds: new Set<string>(),
        dimmedLifeEventIds: new Set(["le1"]),
        dimmedTurningPointIds: new Set<string>(),
        dimmedClassificationIds: new Set<string>(),
      };
      const { container } = renderLane({ lifeEvents, dims, filterMode: "hide" });
      // Only le2 diamond should be rendered
      const diamonds = container.querySelectorAll("rect[transform]");
      expect(diamonds).toHaveLength(1);
    });

    it("omits labels for hidden items in collectDateLabelEntries", () => {
      const events = [
        makeEvent("e1", ["a"], { approximate_date: "1990" }),
        makeEvent("e2", ["a"], { approximate_date: "1995" }),
      ];
      const dims = {
        dimmedPersonIds: new Set<string>(),
        dimmedEventIds: new Set(["e1"]),
        dimmedLifeEventIds: new Set<string>(),
        dimmedTurningPointIds: new Set<string>(),
        dimmedClassificationIds: new Set<string>(),
      };
      const { container } = renderLane({ events, dims, filterMode: "hide" });
      const labels = container.querySelectorAll(".tl-marker-label");
      // Only e2's label should appear (e1 is hidden)
      expect(labels).toHaveLength(1);
      expect(labels[0].textContent).toBe("Event e2");
    });
  });

  describe("pattern rings", () => {
    it("renders pattern rings on trauma event markers", () => {
      const events = [makeEvent("e1", ["a"], { approximate_date: "1995" })];
      const patternRings: PatternRingsMap = new Map([
        [
          "trauma_event:e1",
          [
            { patternId: "pat1", color: "#ff0000" },
            { patternId: "pat2", color: "#00ff00" },
          ],
        ],
      ]);
      const { container } = renderLane({ events, patternRings });
      const rings = container.querySelectorAll(".tl-pattern-ring");
      expect(rings).toHaveLength(2);
      expect(rings[0].getAttribute("stroke")).toBe("#ff0000");
      expect(rings[1].getAttribute("stroke")).toBe("#00ff00");
      // Verify radius increases per ring
      const r0 = Number(rings[0].getAttribute("r"));
      const r1 = Number(rings[1].getAttribute("r"));
      expect(r0).toBe(MARKER_RADIUS + 2);
      expect(r1).toBe(MARKER_RADIUS + 4);
    });

    it("renders pattern rings on life event markers", () => {
      const lifeEvents = [makeLifeEvent("le1", ["a"], { approximate_date: "2005" })];
      const patternRings: PatternRingsMap = new Map([
        ["life_event:le1", [{ patternId: "pat1", color: "#0000ff" }]],
      ]);
      const { container } = renderLane({ lifeEvents, patternRings });
      const rings = container.querySelectorAll(".tl-pattern-ring");
      expect(rings).toHaveLength(1);
      expect(rings[0].getAttribute("stroke")).toBe("#0000ff");
      expect(rings[0].getAttribute("fill")).toBe("none");
      expect(rings[0].getAttribute("r")).toBe(String(MARKER_RADIUS + 2));
    });

    it("renders pattern rings on classification diagnosis triangles", () => {
      const classifications = [
        makeClassification("c1", ["a"], {
          status: "diagnosed",
          diagnosis_year: 2005,
        }),
      ];
      const patternRings: PatternRingsMap = new Map([
        ["classification:c1", [{ patternId: "pat1", color: "#ff00ff" }]],
      ]);
      const { container } = renderLane({ classifications, patternRings });
      const rings = container.querySelectorAll(".tl-pattern-ring");
      expect(rings).toHaveLength(1);
      expect(rings[0].getAttribute("stroke")).toBe("#ff00ff");
    });

    it("does not render pattern rings when patternRings is undefined", () => {
      const events = [makeEvent("e1", ["a"], { approximate_date: "1995" })];
      const { container } = renderLane({ events, patternRings: undefined });
      const rings = container.querySelectorAll(".tl-pattern-ring");
      expect(rings).toHaveLength(0);
    });

    it("does not render pattern rings for markers with no matching entries", () => {
      const events = [makeEvent("e1", ["a"], { approximate_date: "1995" })];
      const patternRings: PatternRingsMap = new Map([
        ["trauma_event:other-id", [{ patternId: "pat1", color: "#ff0000" }]],
      ]);
      const { container } = renderLane({ events, patternRings });
      const rings = container.querySelectorAll(".tl-pattern-ring");
      expect(rings).toHaveLength(0);
    });
  });

  describe("turning point markers", () => {
    it("renders star path for turning points", () => {
      const turningPoints = [makeTurningPoint("tp1", ["a"])];
      const { container } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
      });
      const stars = container.querySelectorAll("path.tl-marker--star");
      expect(stars).toHaveLength(1);
    });

    it("uses correct turning point color", () => {
      const turningPoints = [
        makeTurningPoint("tp1", ["a"], { category: TurningPointCategory.Recovery }),
      ];
      const { container } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
      });
      const star = container.querySelector("path.tl-marker--star")!;
      expect(star.getAttribute("fill")).toBe("#a78bfa");
    });

    it("skips turning points with non-numeric dates", () => {
      const turningPoints = [makeTurningPoint("tp1", ["a"], { approximate_date: "circa 2000" })];
      const { container } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
      });
      expect(container.querySelectorAll("path.tl-marker--star")).toHaveLength(0);
    });

    it("does not render turning points when turningPointColors is undefined", () => {
      const turningPoints = [makeTurningPoint("tp1", ["a"])];
      const { container } = renderLane({ turningPoints, turningPointColors: undefined });
      expect(container.querySelectorAll("path.tl-marker--star")).toHaveLength(0);
    });

    it("shows tooltip on mouseenter", () => {
      const turningPoints = [makeTurningPoint("tp1", ["a"], { title: "Broke the cycle" })];
      const { container, props } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
      });
      const star = container.querySelector("path.tl-marker--star")!;
      fireEvent.mouseEnter(star, { clientX: 100, clientY: 200 });
      expect(props.onTooltip).toHaveBeenCalledWith(
        expect.objectContaining({
          visible: true,
          lines: expect.arrayContaining([
            expect.objectContaining({ text: "Broke the cycle", bold: true }),
          ]),
        }),
      );
    });

    it("hides tooltip on mouseleave", () => {
      const turningPoints = [makeTurningPoint("tp1", ["a"])];
      const { container, props } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
      });
      const star = container.querySelector("path.tl-marker--star")!;
      fireEvent.mouseLeave(star);
      expect(props.onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
    });

    it("includes significance in tooltip when present", () => {
      const turningPoints = [
        makeTurningPoint("tp1", ["a"], { title: "Recovery", significance: 8 }),
      ];
      const { container, props } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
      });
      const star = container.querySelector("path.tl-marker--star")!;
      fireEvent.mouseEnter(star, { clientX: 0, clientY: 0 });
      const call = props.onTooltip.mock.calls.find(
        (c: Array<{ visible: boolean }>) => c[0].visible,
      );
      const lines = call[0].lines.map((l: { text: string }) => l.text);
      expect(lines).toContain("timeline.significance");
    });

    it("excludes significance from tooltip when null", () => {
      const turningPoints = [
        makeTurningPoint("tp1", ["a"], { title: "Recovery", significance: null }),
      ];
      const { container, props } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
      });
      const star = container.querySelector("path.tl-marker--star")!;
      fireEvent.mouseEnter(star, { clientX: 0, clientY: 0 });
      const call = props.onTooltip.mock.calls.find(
        (c: Array<{ visible: boolean }>) => c[0].visible,
      );
      const lines = call[0].lines.map((l: { text: string }) => l.text);
      expect(lines).not.toContain("timeline.significance");
    });

    it("calls onClickMarker on star click in explore mode", () => {
      const onClickMarker = vi.fn();
      const turningPoints = [makeTurningPoint("tp1", ["a"])];
      const { container } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
        mode: "explore",
        onClickMarker,
      });
      const star = container.querySelector("path.tl-marker--star")!;
      fireEvent.click(star);
      expect(onClickMarker).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: "turning_point", entityId: "tp1" }),
      );
    });

    it("calls onToggleEntitySelect on star click in annotate mode", () => {
      const onToggleEntitySelect = vi.fn();
      const turningPoints = [makeTurningPoint("tp1", ["a"])];
      const { container } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
        mode: "annotate",
        onToggleEntitySelect,
      });
      const star = container.querySelector("path.tl-marker--star")!;
      fireEvent.click(star);
      expect(onToggleEntitySelect).toHaveBeenCalledWith("turning_point:tp1");
    });

    it("renders selection ring when entity is selected", () => {
      const turningPoints = [makeTurningPoint("tp1", ["a"])];
      const selectedEntityKeys = new Set(["turning_point:tp1"]);
      const { container } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
        selectedEntityKeys,
      });
      const rings = container.querySelectorAll(".tl-selection-ring");
      expect(rings).toHaveLength(1);
    });

    it("renders marker label when showMarkerLabels is true", () => {
      const turningPoints = [makeTurningPoint("tp1", ["a"], { title: "Broke the cycle" })];
      const { container } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
        showMarkerLabels: true,
      });
      const labels = container.querySelectorAll(".tl-marker-label");
      expect(labels.length).toBeGreaterThanOrEqual(1);
      const tpLabel = Array.from(labels).find((l) => l.textContent === "Broke the cycle");
      expect(tpLabel).toBeTruthy();
    });

    it("hides marker label when showMarkerLabels is false", () => {
      const turningPoints = [makeTurningPoint("tp1", ["a"], { title: "Broke the cycle" })];
      const { container } = renderLane({
        turningPoints,
        turningPointColors: defaultTurningPointColors,
        showMarkerLabels: false,
      });
      const labels = container.querySelectorAll(".tl-marker-label");
      expect(labels).toHaveLength(0);
    });
  });
});
