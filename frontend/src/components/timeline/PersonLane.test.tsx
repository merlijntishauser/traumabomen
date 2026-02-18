import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import { LifeEventCategory, TraumaCategory } from "../../types/domain";
import { PersonLane } from "./PersonLane";
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

describe("PersonLane", () => {
  describe("life bar", () => {
    it("renders a rect for person with birth_year", () => {
      const { container } = renderLane();
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBeGreaterThanOrEqual(1);
      const lifeBar = rects[0];
      expect(lifeBar.getAttribute("rx")).toBe("3");
    });

    it("does not render life bar when birth_year is null", () => {
      const person = makePerson("a", { birth_year: null });
      const { container } = renderLane({ person });
      const rects = container.querySelectorAll("rect");
      expect(rects).toHaveLength(0);
    });

    it("positions life bar correctly", () => {
      const { container } = renderLane({ y: 40 });
      const rect = container.querySelector("rect")!;
      const expectedY = 40 + (ROW_HEIGHT - BAR_HEIGHT) / 2;
      expect(rect.getAttribute("y")).toBe(String(expectedY));
      expect(rect.getAttribute("x")).toBe("1980");
    });

    it("uses death_year for width when present", () => {
      const person = makePerson("a", { birth_year: 1950, death_year: 2000 });
      const { container } = renderLane({ person });
      const rect = container.querySelector("rect")!;
      expect(rect.getAttribute("width")).toBe("50");
    });

    it("uses currentYear for width when death_year is null", () => {
      const { container } = renderLane();
      const rect = container.querySelector("rect")!;
      expect(rect.getAttribute("width")).toBe(String(2025 - 1980));
    });

    it("clamps width to zero minimum", () => {
      const person = makePerson("a", { birth_year: 2000, death_year: 1990 });
      const { container } = renderLane({ person });
      const rect = container.querySelector("rect")!;
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
      // Only life bar rect
      const rects = container.querySelectorAll("rect");
      expect(rects).toHaveLength(1);
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
      // Life bar + 1 classification period strip = 2 rects
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBeGreaterThanOrEqual(2);
    });

    it("does not render strips when birth_year is null", () => {
      const person = makePerson("a", { birth_year: null });
      const classifications = [makeClassification("c1", ["a"])];
      const { container } = renderLane({ person, classifications });
      expect(container.querySelectorAll("rect")).toHaveLength(0);
    });

    it("uses diagnosed color for diagnosed classifications", () => {
      const classifications = [
        makeClassification("c1", ["a"], { status: "diagnosed", diagnosis_year: 2005 }),
      ];
      const { container } = renderLane({ classifications });
      const rects = container.querySelectorAll("rect");
      // Second rect is the classification strip
      expect(rects[1].getAttribute("fill")).toBe("--color-classification-diagnosed");
    });

    it("uses suspected color for suspected classifications", () => {
      const classifications = [makeClassification("c1", ["a"], { status: "suspected" })];
      const { container } = renderLane({ classifications });
      const rects = container.querySelectorAll("rect");
      expect(rects[1].getAttribute("fill")).toBe("--color-classification-suspected");
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
      const rects = container.querySelectorAll("rect");
      const strip = rects[1];

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
      // Life bar + 2 period strips = 3 rects
      const rects = container.querySelectorAll("rect");
      expect(rects).toHaveLength(3);
    });
  });
});
