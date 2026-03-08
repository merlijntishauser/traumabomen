import { fireEvent, render } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { LifeEventCategory, TraumaCategory, TurningPointCategory } from "../../types/domain";
import type { PatternRingsMap } from "./TimelinePatternLanes";
import { MARKER_RADIUS } from "./timelineHelpers";
import type { LaneOrientation, MarkerContext } from "./timelineMarkers";
import {
  renderClassificationStrips,
  renderLifeEventMarkers,
  renderTraumaMarkers,
  renderTurningPointMarkers,
} from "./timelineMarkers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeOrientation(): LaneOrientation {
  return {
    pointAt: (year: number) => ({ x: year, y: 50 }),
    primaryPos: (year: number) => year,
    markerTransform: () => undefined,
    dateText: (year: number) => String(year),
    markerLabelAt: (year: number, _key: string) => ({ x: year + 10, y: 45, textAnchor: "start" }),
    stripRect: (startPos: number, endPos: number, stripIdx: number) => ({
      x: startPos,
      y: 60 + stripIdx * 6,
      width: endPos - startPos,
      height: 4,
    }),
    stripLabelAt: (pos: number, _key: string) => ({ x: pos, y: 55, textAnchor: "start" }),
    diagLabelAt: (year: number, _key: string) => ({ x: year + 10, y: 40, textAnchor: "start" }),
    fallbackEndPos: 2025,
  };
}

function makeContext(overrides: Partial<MarkerContext> = {}): MarkerContext {
  return {
    orientation: makeOrientation(),
    persons: new Map([["p1", makePerson("p1")]]),
    traumaColors: {
      [TraumaCategory.Loss]: "#ff0000",
      [TraumaCategory.Abuse]: "#cc0000",
      [TraumaCategory.Addiction]: "#aa0000",
      [TraumaCategory.War]: "#880000",
      [TraumaCategory.Displacement]: "#660000",
      [TraumaCategory.Illness]: "#440000",
      [TraumaCategory.Poverty]: "#220000",
    },
    lifeEventColors: {
      [LifeEventCategory.Career]: "#00ff00",
      [LifeEventCategory.Family]: "#00cc00",
      [LifeEventCategory.Education]: "#00aa00",
      [LifeEventCategory.Relocation]: "#008800",
      [LifeEventCategory.Health]: "#006600",
      [LifeEventCategory.Medication]: "#004400",
      [LifeEventCategory.Other]: "#002200",
    },
    canvasStroke: "#333333",
    classificationDiagnosedColor: "#3b82f6",
    classificationSuspectedColor: "#f59e0b",
    hideTooltip: vi.fn(),
    onTooltip: vi.fn(),
    handleMarkerClick: vi.fn(),
    filterMode: "dim",
    showMarkerLabels: true,
    t: (key: string) => key,
    ...overrides,
  };
}

function renderInSvg(element: React.ReactNode) {
  return render(<svg>{element}</svg>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("renderTraumaMarkers", () => {
  it("renders a circle for each trauma event with valid date", () => {
    const ctx = makeContext();
    const events = [makeEvent("e1", ["p1"]), makeEvent("e2", ["p1"])];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    const circles = container.querySelectorAll("circle.tl-marker");
    expect(circles).toHaveLength(2);
  });

  it("positions circle at the year from orientation", () => {
    const ctx = makeContext();
    const events = [makeEvent("e1", ["p1"], { approximate_date: "1990" })];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    const circle = container.querySelector("circle.tl-marker")!;
    expect(circle.getAttribute("cx")).toBe("1990");
    expect(circle.getAttribute("cy")).toBe("50");
  });

  it("uses correct trauma color", () => {
    const ctx = makeContext();
    const events = [makeEvent("e1", ["p1"], { category: TraumaCategory.Loss })];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    const circle = container.querySelector("circle.tl-marker")!;
    expect(circle.getAttribute("fill")).toBe("#ff0000");
  });

  it("sets marker radius", () => {
    const ctx = makeContext();
    const events = [makeEvent("e1", ["p1"])];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    const circle = container.querySelector("circle.tl-marker")!;
    expect(circle.getAttribute("r")).toBe(String(MARKER_RADIUS));
  });

  it("skips events with non-numeric dates", () => {
    const ctx = makeContext();
    const events = [makeEvent("e1", ["p1"], { approximate_date: "circa 2000" })];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    expect(container.querySelectorAll("circle.tl-marker")).toHaveLength(0);
  });

  it("shows tooltip on mouseenter", () => {
    const ctx = makeContext();
    const events = [makeEvent("e1", ["p1"], { title: "War trauma" })];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    const circle = container.querySelector("circle.tl-marker")!;
    fireEvent.mouseEnter(circle, { clientX: 100, clientY: 200 });
    expect(ctx.onTooltip).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        lines: expect.arrayContaining([
          expect.objectContaining({ text: "War trauma", bold: true }),
        ]),
      }),
    );
  });

  it("hides tooltip on mouseleave", () => {
    const ctx = makeContext();
    const events = [makeEvent("e1", ["p1"])];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    const circle = container.querySelector("circle.tl-marker")!;
    fireEvent.mouseLeave(circle);
    expect(ctx.hideTooltip).toHaveBeenCalled();
  });

  it("calls handleMarkerClick on click", () => {
    const ctx = makeContext();
    const events = [makeEvent("e1", ["p1"])];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    const circle = container.querySelector("circle.tl-marker")!;
    fireEvent.click(circle);
    expect(ctx.handleMarkerClick).toHaveBeenCalledWith("trauma_event", "e1", expect.any(Object));
  });

  it("dims marker when event is dimmed", () => {
    const dims = {
      dimmedPersonIds: new Set<string>(),
      dimmedEventIds: new Set(["e1"]),
      dimmedLifeEventIds: new Set<string>(),
      dimmedTurningPointIds: new Set<string>(),
      dimmedClassificationIds: new Set<string>(),
    };
    const ctx = makeContext({ dims, filterMode: "dim" });
    const events = [makeEvent("e1", ["p1"])];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    const g = container.querySelector("g[opacity]");
    expect(g?.getAttribute("opacity")).toBe("0.15");
  });

  it("hides marker when event is dimmed and filterMode is hide", () => {
    const dims = {
      dimmedPersonIds: new Set<string>(),
      dimmedEventIds: new Set(["e1"]),
      dimmedLifeEventIds: new Set<string>(),
      dimmedTurningPointIds: new Set<string>(),
      dimmedClassificationIds: new Set<string>(),
    };
    const ctx = makeContext({ dims, filterMode: "hide" });
    const events = [makeEvent("e1", ["p1"])];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    expect(container.querySelectorAll("circle.tl-marker")).toHaveLength(0);
  });

  it("renders selection ring when entity is selected", () => {
    const ctx = makeContext({ selectedEntityKeys: new Set(["trauma_event:e1"]) });
    const events = [makeEvent("e1", ["p1"])];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    expect(container.querySelectorAll(".tl-selection-ring")).toHaveLength(1);
  });

  it("does not render selection ring when entity is not selected", () => {
    const ctx = makeContext({ selectedEntityKeys: new Set<string>() });
    const events = [makeEvent("e1", ["p1"])];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    expect(container.querySelectorAll(".tl-selection-ring")).toHaveLength(0);
  });

  it("renders marker labels when showMarkerLabels is true", () => {
    const ctx = makeContext({ showMarkerLabels: true });
    const events = [makeEvent("e1", ["p1"], { title: "War trauma" })];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    const labels = container.querySelectorAll(".tl-marker-label");
    expect(labels).toHaveLength(1);
    expect(labels[0].textContent).toBe("War trauma");
  });

  it("does not render marker labels when showMarkerLabels is false", () => {
    const ctx = makeContext({ showMarkerLabels: false });
    const events = [makeEvent("e1", ["p1"])];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    expect(container.querySelectorAll(".tl-marker-label")).toHaveLength(0);
  });

  it("renders pattern rings when present", () => {
    const patternRings: PatternRingsMap = new Map([
      ["trauma_event:e1", [{ patternId: "pat1", color: "#ff0000" }]],
    ]);
    const ctx = makeContext({ patternRings });
    const events = [makeEvent("e1", ["p1"])];
    const { container } = renderInSvg(renderTraumaMarkers(ctx, events));
    expect(container.querySelectorAll(".tl-pattern-ring")).toHaveLength(1);
  });
});

describe("renderLifeEventMarkers", () => {
  it("renders a rotated rect (diamond) for each life event", () => {
    const ctx = makeContext();
    const lifeEvents = [makeLifeEvent("le1", ["p1"])];
    const { container } = renderInSvg(renderLifeEventMarkers(ctx, lifeEvents));
    const diamonds = container.querySelectorAll("rect[transform]");
    expect(diamonds).toHaveLength(1);
  });

  it("uses correct life event color", () => {
    const ctx = makeContext();
    const lifeEvents = [makeLifeEvent("le1", ["p1"], { category: LifeEventCategory.Career })];
    const { container } = renderInSvg(renderLifeEventMarkers(ctx, lifeEvents));
    const diamond = container.querySelector("rect[transform]")!;
    expect(diamond.getAttribute("fill")).toBe("#00ff00");
  });

  it("sets diamond size based on MARKER_RADIUS", () => {
    const ctx = makeContext();
    const lifeEvents = [makeLifeEvent("le1", ["p1"])];
    const { container } = renderInSvg(renderLifeEventMarkers(ctx, lifeEvents));
    const diamond = container.querySelector("rect[transform]")!;
    const expectedSize = MARKER_RADIUS * 0.9;
    expect(diamond.getAttribute("width")).toBe(String(expectedSize * 2));
    expect(diamond.getAttribute("height")).toBe(String(expectedSize * 2));
  });

  it("skips events with non-numeric dates", () => {
    const ctx = makeContext();
    const lifeEvents = [makeLifeEvent("le1", ["p1"], { approximate_date: "unknown" })];
    const { container } = renderInSvg(renderLifeEventMarkers(ctx, lifeEvents));
    expect(container.querySelectorAll("rect[transform]")).toHaveLength(0);
  });

  it("shows tooltip with impact when present", () => {
    const ctx = makeContext();
    const lifeEvents = [makeLifeEvent("le1", ["p1"], { title: "Moved", impact: 7 })];
    const { container } = renderInSvg(renderLifeEventMarkers(ctx, lifeEvents));
    const diamond = container.querySelector("rect[transform]")!;
    fireEvent.mouseEnter(diamond, { clientX: 100, clientY: 200 });
    const call = (ctx.onTooltip as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const texts = call.lines.map((l: { text: string }) => l.text);
    expect(texts).toContain("timeline.impact");
  });

  it("excludes impact from tooltip when null", () => {
    const ctx = makeContext();
    const lifeEvents = [makeLifeEvent("le1", ["p1"], { impact: null })];
    const { container } = renderInSvg(renderLifeEventMarkers(ctx, lifeEvents));
    const diamond = container.querySelector("rect[transform]")!;
    fireEvent.mouseEnter(diamond, { clientX: 100, clientY: 200 });
    const call = (ctx.onTooltip as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const texts = call.lines.map((l: { text: string }) => l.text);
    expect(texts).not.toContain("timeline.impact");
  });

  it("hides marker when dimmed and filterMode is hide", () => {
    const dims = {
      dimmedPersonIds: new Set<string>(),
      dimmedEventIds: new Set<string>(),
      dimmedLifeEventIds: new Set(["le1"]),
      dimmedTurningPointIds: new Set<string>(),
      dimmedClassificationIds: new Set<string>(),
    };
    const ctx = makeContext({ dims, filterMode: "hide" });
    const lifeEvents = [makeLifeEvent("le1", ["p1"])];
    const { container } = renderInSvg(renderLifeEventMarkers(ctx, lifeEvents));
    expect(container.querySelectorAll("rect[transform]")).toHaveLength(0);
  });

  it("renders selection ring when entity is selected", () => {
    const ctx = makeContext({ selectedEntityKeys: new Set(["life_event:le1"]) });
    const lifeEvents = [makeLifeEvent("le1", ["p1"])];
    const { container } = renderInSvg(renderLifeEventMarkers(ctx, lifeEvents));
    expect(container.querySelectorAll(".tl-selection-ring")).toHaveLength(1);
  });
});

describe("renderClassificationStrips", () => {
  it("renders strip rect for classification period", () => {
    const ctx = makeContext();
    const classifications = [makeClassification("c1", ["p1"])];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    const strips = container.querySelectorAll("rect.tl-marker");
    expect(strips).toHaveLength(1);
  });

  it("uses diagnosed color for diagnosed classification", () => {
    const ctx = makeContext();
    const classifications = [
      makeClassification("c1", ["p1"], { status: "diagnosed", diagnosis_year: 2005 }),
    ];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    const strip = container.querySelector("rect.tl-marker")!;
    expect(strip.getAttribute("fill")).toBe("#3b82f6");
  });

  it("uses suspected color for suspected classification", () => {
    const ctx = makeContext();
    const classifications = [makeClassification("c1", ["p1"], { status: "suspected" })];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    const strip = container.querySelector("rect.tl-marker")!;
    expect(strip.getAttribute("fill")).toBe("#f59e0b");
  });

  it("renders diagnosis triangle for diagnosed with year", () => {
    const ctx = makeContext();
    const classifications = [
      makeClassification("c1", ["p1"], { status: "diagnosed", diagnosis_year: 2005 }),
    ];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);
  });

  it("does not render diagnosis triangle for suspected", () => {
    const ctx = makeContext();
    const classifications = [makeClassification("c1", ["p1"], { status: "suspected" })];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    expect(container.querySelectorAll("path")).toHaveLength(0);
  });

  it("does not render diagnosis triangle when year is null", () => {
    const ctx = makeContext();
    const classifications = [
      makeClassification("c1", ["p1"], { status: "diagnosed", diagnosis_year: null }),
    ];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    expect(container.querySelectorAll("path")).toHaveLength(0);
  });

  it("renders multiple periods as separate rects", () => {
    const ctx = makeContext();
    const classifications = [
      makeClassification("c1", ["p1"], {
        periods: [
          { start_year: 2000, end_year: 2005 },
          { start_year: 2008, end_year: 2012 },
        ],
      }),
    ];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    const strips = container.querySelectorAll("rect.tl-marker");
    expect(strips).toHaveLength(2);
  });

  it("uses fallbackEndPos when period has no end year", () => {
    const ctx = makeContext();
    const classifications = [
      makeClassification("c1", ["p1"], {
        periods: [{ start_year: 2000, end_year: null }],
      }),
    ];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    const strip = container.querySelector("rect.tl-marker")!;
    // width should be fallbackEndPos - start = 2025 - 2000 = 25
    expect(strip.getAttribute("width")).toBe("25");
  });

  it("hides when dimmed and filterMode is hide", () => {
    const dims = {
      dimmedPersonIds: new Set<string>(),
      dimmedEventIds: new Set<string>(),
      dimmedLifeEventIds: new Set<string>(),
      dimmedTurningPointIds: new Set<string>(),
      dimmedClassificationIds: new Set(["c1"]),
    };
    const ctx = makeContext({ dims, filterMode: "hide" });
    const classifications = [makeClassification("c1", ["p1"])];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    expect(container.querySelectorAll("rect.tl-marker")).toHaveLength(0);
  });

  it("shows strip label with subcategory when available", () => {
    const ctx = makeContext({ showMarkerLabels: true });
    const classifications = [
      makeClassification("c1", ["p1"], {
        dsm_category: "depressive",
        dsm_subcategory: "major_depression",
      }),
    ];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    const labels = container.querySelectorAll(".tl-marker-label");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels[0].textContent).toBe("dsm.sub.major_depression");
  });

  it("shows strip label with category when no subcategory", () => {
    const ctx = makeContext({ showMarkerLabels: true });
    const classifications = [
      makeClassification("c1", ["p1"], { dsm_category: "depressive", dsm_subcategory: null }),
    ];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    const labels = container.querySelectorAll(".tl-marker-label");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels[0].textContent).toBe("dsm.depressive");
  });

  it("renders pattern rings on diagnosis triangle", () => {
    const patternRings: PatternRingsMap = new Map([
      ["classification:c1", [{ patternId: "pat1", color: "#ff00ff" }]],
    ]);
    const ctx = makeContext({ patternRings });
    const classifications = [
      makeClassification("c1", ["p1"], { status: "diagnosed", diagnosis_year: 2005 }),
    ];
    const { container } = renderInSvg(renderClassificationStrips(ctx, classifications));
    expect(container.querySelectorAll(".tl-pattern-ring")).toHaveLength(1);
  });
});

describe("renderTurningPointMarkers", () => {
  const turningPointColors = {
    [TurningPointCategory.CycleBreaking]: "#34d399",
    [TurningPointCategory.ProtectiveRelationship]: "#60a5fa",
    [TurningPointCategory.Recovery]: "#a78bfa",
    [TurningPointCategory.Achievement]: "#fbbf24",
    [TurningPointCategory.PositiveChange]: "#2dd4bf",
  } as Record<TurningPointCategory, string>;

  it("renders star path for turning points", () => {
    const ctx = makeContext({ turningPointColors });
    const tps = [makeTurningPoint("tp1", ["p1"])];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    const stars = container.querySelectorAll("path.tl-marker--star");
    expect(stars).toHaveLength(1);
  });

  it("returns null when turningPointColors is undefined", () => {
    const ctx = makeContext({ turningPointColors: undefined });
    const tps = [makeTurningPoint("tp1", ["p1"])];
    const result = renderTurningPointMarkers(ctx, tps);
    expect(result).toBeNull();
  });

  it("uses correct turning point color", () => {
    const ctx = makeContext({ turningPointColors });
    const tps = [makeTurningPoint("tp1", ["p1"], { category: TurningPointCategory.Recovery })];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    const star = container.querySelector("path.tl-marker--star")!;
    expect(star.getAttribute("fill")).toBe("#a78bfa");
  });

  it("skips turning points with non-numeric dates", () => {
    const ctx = makeContext({ turningPointColors });
    const tps = [makeTurningPoint("tp1", ["p1"], { approximate_date: "circa 2000" })];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    expect(container.querySelectorAll("path.tl-marker--star")).toHaveLength(0);
  });

  it("shows tooltip on mouseenter with title and category", () => {
    const ctx = makeContext({ turningPointColors });
    const tps = [makeTurningPoint("tp1", ["p1"], { title: "Broke the cycle" })];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    const star = container.querySelector("path.tl-marker--star")!;
    fireEvent.mouseEnter(star, { clientX: 100, clientY: 200 });
    expect(ctx.onTooltip).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        lines: expect.arrayContaining([
          expect.objectContaining({ text: "Broke the cycle", bold: true }),
        ]),
      }),
    );
  });

  it("includes significance in tooltip when present", () => {
    const ctx = makeContext({ turningPointColors });
    const tps = [makeTurningPoint("tp1", ["p1"], { significance: 8 })];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    const star = container.querySelector("path.tl-marker--star")!;
    fireEvent.mouseEnter(star, { clientX: 0, clientY: 0 });
    const call = (ctx.onTooltip as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const texts = call.lines.map((l: { text: string }) => l.text);
    expect(texts).toContain("timeline.significance");
  });

  it("excludes significance from tooltip when null", () => {
    const ctx = makeContext({ turningPointColors });
    const tps = [makeTurningPoint("tp1", ["p1"], { significance: null })];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    const star = container.querySelector("path.tl-marker--star")!;
    fireEvent.mouseEnter(star, { clientX: 0, clientY: 0 });
    const call = (ctx.onTooltip as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const texts = call.lines.map((l: { text: string }) => l.text);
    expect(texts).not.toContain("timeline.significance");
  });

  it("hides tooltip on mouseleave", () => {
    const ctx = makeContext({ turningPointColors });
    const tps = [makeTurningPoint("tp1", ["p1"])];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    const star = container.querySelector("path.tl-marker--star")!;
    fireEvent.mouseLeave(star);
    expect(ctx.hideTooltip).toHaveBeenCalled();
  });

  it("calls handleMarkerClick on click", () => {
    const ctx = makeContext({ turningPointColors });
    const tps = [makeTurningPoint("tp1", ["p1"])];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    const star = container.querySelector("path.tl-marker--star")!;
    fireEvent.click(star);
    expect(ctx.handleMarkerClick).toHaveBeenCalledWith("turning_point", "tp1", expect.any(Object));
  });

  it("renders selection ring when entity is selected", () => {
    const ctx = makeContext({
      turningPointColors,
      selectedEntityKeys: new Set(["turning_point:tp1"]),
    });
    const tps = [makeTurningPoint("tp1", ["p1"])];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    expect(container.querySelectorAll(".tl-selection-ring")).toHaveLength(1);
  });

  it("hides marker when dimmed and filterMode is hide", () => {
    const dims = {
      dimmedPersonIds: new Set<string>(),
      dimmedEventIds: new Set<string>(),
      dimmedLifeEventIds: new Set<string>(),
      dimmedTurningPointIds: new Set(["tp1"]),
      dimmedClassificationIds: new Set<string>(),
    };
    const ctx = makeContext({ turningPointColors, dims, filterMode: "hide" });
    const tps = [makeTurningPoint("tp1", ["p1"])];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    expect(container.querySelectorAll("path.tl-marker--star")).toHaveLength(0);
  });

  it("renders marker label when showMarkerLabels is true", () => {
    const ctx = makeContext({ turningPointColors, showMarkerLabels: true });
    const tps = [makeTurningPoint("tp1", ["p1"], { title: "Recovery" })];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    const labels = container.querySelectorAll(".tl-marker-label");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels[0].textContent).toBe("Recovery");
  });

  it("hides marker label when showMarkerLabels is false", () => {
    const ctx = makeContext({ turningPointColors, showMarkerLabels: false });
    const tps = [makeTurningPoint("tp1", ["p1"])];
    const { container } = renderInSvg(renderTurningPointMarkers(ctx, tps));
    expect(container.querySelectorAll(".tl-marker-label")).toHaveLength(0);
  });
});
