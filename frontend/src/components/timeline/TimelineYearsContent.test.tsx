import { cleanup, fireEvent, render } from "@testing-library/react";
import type * as d3 from "d3";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import {
  LifeEventCategory,
  PartnerStatus,
  RelationshipType,
  TraumaCategory,
} from "../../types/domain";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../lib/traumaColors", () => ({
  getTraumaColors: () => ({ loss: "#ff0000", abuse: "#cc0000" }),
}));

vi.mock("../../lib/lifeEventColors", () => ({
  getLifeEventColors: () => ({ career: "#00ff00", relocation: "#0000ff" }),
}));

vi.mock("../../lib/turningPointColors", () => ({
  getTurningPointColors: () => ({ recovery: "#a78bfa" }),
}));

const noopZoomActions = { zoomIn: () => {}, zoomOut: () => {}, resetZoom: () => {} };
vi.mock("../../hooks/useTimelineZoom", () => ({
  useTimelineZoom: ({ scale }: { scale: d3.ScaleLinear<number, number> }) => ({
    rescaled: scale,
    zoomK: 1,
    zoomActions: noopZoomActions,
  }),
}));

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

function makeBaseProps() {
  return {
    relationships: new Map<string, DecryptedRelationship>(),
    events: new Map<string, DecryptedEvent>(),
    lifeEvents: new Map<string, DecryptedLifeEvent>(),
    turningPoints: new Map<string, DecryptedTurningPoint>(),
    classifications: new Map<string, DecryptedClassification>(),
    width: 800,
    height: 400,
    mode: "explore" as const,
    selectedPersonId: null,
    onTooltip: vi.fn(),
  };
}

// Import after all mocks are registered
const { TimelineYearsContent } = await import("./TimelineYearsContent");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TimelineYearsContent", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("rendering with single person", () => {
    function renderSinglePerson(overrides = {}) {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([["p1", p1]]),
        ...overrides,
      };
      return render(<TimelineYearsContent {...props} />);
    }

    it("renders SVG element", () => {
      const { container } = renderSinglePerson();
      expect(container.querySelector("svg")).toBeTruthy();
    });

    it("renders generation labels", () => {
      const { container } = renderSinglePerson();
      const genLabels = container.querySelectorAll(".tl-gen-label");
      expect(genLabels.length).toBeGreaterThanOrEqual(1);
    });

    it("renders person name labels", () => {
      const { container } = renderSinglePerson();
      const labels = container.querySelectorAll(".tl-person-label");
      expect(labels.length).toBe(1);
      expect(labels[0].textContent).toBe("Alice");
    });

    it("renders clip path", () => {
      const { container } = renderSinglePerson();
      expect(container.querySelector("#timeline-clip")).toBeTruthy();
    });

    it("renders zoom group", () => {
      const { container } = renderSinglePerson();
      expect(container.querySelector(".tl-time")).toBeTruthy();
    });

    it("renders axis group", () => {
      const { container } = renderSinglePerson();
      expect(container.querySelector(".tl-axis")).toBeTruthy();
    });

    it("renders life bar for person", () => {
      const { container } = renderSinglePerson();
      const timeGroup = container.querySelector(".tl-time");
      const rects = timeGroup?.querySelectorAll("rect");
      expect(rects?.length).toBeGreaterThanOrEqual(1);
    });

    it("renders background generation bands", () => {
      const { container } = renderSinglePerson();
      const bgGroup = container.querySelector(".tl-bg");
      const rects = bgGroup?.querySelectorAll("rect");
      expect(rects?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("rendering with no persons", () => {
    it("renders SVG even with empty person map", () => {
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>(),
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      expect(container.querySelector("svg")).toBeTruthy();
    });

    it("renders no person labels with empty person map", () => {
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>(),
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      expect(container.querySelectorAll(".tl-person-label")).toHaveLength(0);
    });
  });

  describe("rendering with multiple persons", () => {
    function makeTwoPersonProps() {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
      return {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([
          ["p1", p1],
          ["p2", p2],
        ]),
      };
    }

    it("renders labels for all persons", () => {
      const props = makeTwoPersonProps();
      const { container } = render(<TimelineYearsContent {...props} />);
      const labels = container.querySelectorAll(".tl-person-label");
      expect(labels.length).toBe(2);
      const names = Array.from(labels).map((l) => l.textContent);
      expect(names).toContain("Alice");
      expect(names).toContain("Bob");
    });

    it("renders SVG without crashing", () => {
      const props = makeTwoPersonProps();
      const { container } = render(<TimelineYearsContent {...props} />);
      expect(container.querySelector("svg")).toBeTruthy();
    });
  });

  describe("person selection and dimming", () => {
    function makeTwoPersonProps() {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
      return {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([
          ["p1", p1],
          ["p2", p2],
        ]),
      };
    }

    it("applies selected class to selected person label", () => {
      const props = makeTwoPersonProps();
      const { container } = render(<TimelineYearsContent {...props} selectedPersonId="p1" />);
      const labels = container.querySelectorAll(".tl-person-label");
      const aliceLabel = Array.from(labels).find((l) => l.textContent === "Alice");
      expect(aliceLabel?.classList.contains("tl-person-label--selected")).toBe(true);
    });

    it("applies dimmed class to non-selected person labels", () => {
      const props = makeTwoPersonProps();
      const { container } = render(<TimelineYearsContent {...props} selectedPersonId="p1" />);
      const labels = container.querySelectorAll(".tl-person-label");
      const bobLabel = Array.from(labels).find((l) => l.textContent === "Bob");
      expect(bobLabel?.classList.contains("tl-person-label--dimmed")).toBe(true);
    });

    it("no selection means no selected or dimmed classes on labels", () => {
      const props = makeTwoPersonProps();
      const { container } = render(<TimelineYearsContent {...props} selectedPersonId={null} />);
      expect(container.querySelectorAll(".tl-person-label--selected")).toHaveLength(0);
      expect(container.querySelectorAll(".tl-person-label--dimmed")).toHaveLength(0);
    });

    it("calls onSelectPerson when person label is clicked", () => {
      const props = makeTwoPersonProps();
      const onSelectPerson = vi.fn();
      const { container } = render(
        <TimelineYearsContent {...props} onSelectPerson={onSelectPerson} />,
      );
      const labels = container.querySelectorAll(".tl-person-label");
      const aliceLabel = Array.from(labels).find((l) => l.textContent === "Alice");
      aliceLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onSelectPerson).toHaveBeenCalledWith("p1");
    });

    it("deselects person when clicking already selected person label", () => {
      const props = makeTwoPersonProps();
      const onSelectPerson = vi.fn();
      const { container } = render(
        <TimelineYearsContent {...props} selectedPersonId="p1" onSelectPerson={onSelectPerson} />,
      );
      const labels = container.querySelectorAll(".tl-person-label");
      const aliceLabel = Array.from(labels).find((l) => l.textContent === "Alice");
      aliceLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onSelectPerson).toHaveBeenCalledWith(null);
    });

    it("calls onSelectPerson(null) when background is clicked", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([["p1", p1]]),
      };
      const onSelectPerson = vi.fn();
      const { container } = render(
        <TimelineYearsContent {...props} onSelectPerson={onSelectPerson} />,
      );
      const bgRects = container.querySelectorAll('rect[fill="transparent"]');
      const bgRect = Array.from(bgRects).find((r) => !r.classList.contains("tl-lane-hitarea"));
      bgRect?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onSelectPerson).toHaveBeenCalledWith(null);
    });
  });

  describe("trauma markers", () => {
    it("renders circles for trauma events", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([["p1", p1]]),
        events: new Map<string, DecryptedEvent>([
          [
            "e1",
            {
              id: "e1",
              person_ids: ["p1"],
              title: "Trauma",
              description: "",
              category: TraumaCategory.Loss,
              approximate_date: "1990",
              severity: 5,
              tags: [],
            },
          ],
        ]),
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      const circles = container.querySelectorAll("circle");
      expect(circles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("life event markers", () => {
    it("renders rotated rects for life events", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([["p1", p1]]),
        lifeEvents: new Map<string, DecryptedLifeEvent>([
          [
            "le1",
            {
              id: "le1",
              person_ids: ["p1"],
              title: "Move",
              description: "",
              category: LifeEventCategory.Career,
              approximate_date: "1990",
              impact: null,
              tags: [],
            },
          ],
        ]),
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      const timeGroup = container.querySelector(".tl-time");
      const rects = timeGroup?.querySelectorAll("rect");
      // Life bar + life event diamond
      expect(rects?.length ?? 0).toBeGreaterThanOrEqual(2);
    });
  });

  describe("partner lines", () => {
    it("renders partner lines between partners", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([
          ["p1", p1],
          ["p2", p2],
        ]),
        relationships: new Map<string, DecryptedRelationship>([
          [
            "r1",
            {
              id: "r1",
              type: RelationshipType.Partner,
              source_person_id: "p1",
              target_person_id: "p2",
              periods: [{ start_year: 1985, end_year: null, status: PartnerStatus.Married }],
              active_period: null,
            },
          ],
        ]),
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      const lines = container.querySelectorAll("line");
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    it("hides partner lines when showPartnerLines is false", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([
          ["p1", p1],
          ["p2", p2],
        ]),
        relationships: new Map<string, DecryptedRelationship>([
          [
            "r1",
            {
              id: "r1",
              type: RelationshipType.Partner,
              source_person_id: "p1",
              target_person_id: "p2",
              periods: [{ start_year: 1985, end_year: null, status: PartnerStatus.Married }],
              active_period: null,
            },
          ],
        ]),
        showPartnerLines: false,
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      // Only axis tick lines should be present, no partner lines in the time group
      const timeGroup = container.querySelector(".tl-time");
      const partnerLines = timeGroup?.querySelectorAll("line");
      expect(partnerLines?.length ?? 0).toBe(0);
    });
  });

  describe("gridlines", () => {
    it("does not render gridlines by default", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([["p1", p1]]),
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      // Gridlines have a specific key pattern "grid-*"
      const allLines = container.querySelectorAll("line");
      // Only axis tick lines, not full gridlines (gridlines go from y=0 to y=totalHeight)
      for (const line of allLines) {
        const y1 = Number(line.getAttribute("y1"));
        const y2 = Number(line.getAttribute("y2"));
        // Axis tick lines have short y2 values (e.g., -6)
        if (y2 > 0) {
          // No full-height gridline expected
          expect(y1).not.toBe(0);
        }
      }
    });

    it("renders gridlines when showGridlines is true", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([["p1", p1]]),
        showGridlines: true,
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      // Gridlines start at y1=0 and extend to totalHeight
      const allLines = container.querySelectorAll("line");
      const gridlines = Array.from(allLines).filter(
        (line) => line.getAttribute("y1") === "0" && Number(line.getAttribute("y2")) > 0,
      );
      expect(gridlines.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("tooltip on person label", () => {
    it("shows tooltip on person label mouseenter", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const onTooltip = vi.fn();
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([["p1", p1]]),
        onTooltip,
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      const label = container.querySelector(".tl-person-label")!;
      fireEvent.mouseEnter(label, { clientX: 100, clientY: 200 });
      expect(onTooltip).toHaveBeenCalledWith(
        expect.objectContaining({
          visible: true,
          lines: expect.arrayContaining([expect.objectContaining({ text: "Alice", bold: true })]),
        }),
      );
    });

    it("hides tooltip on person label mouseleave", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const onTooltip = vi.fn();
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([["p1", p1]]),
        onTooltip,
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      const label = container.querySelector(".tl-person-label")!;
      fireEvent.mouseLeave(label);
      expect(onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
    });
  });

  describe("filterMode hide", () => {
    it("filters out dimmed persons when filterMode is hide", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
      const dims = {
        dimmedPersonIds: new Set(["p2"]),
        dimmedEventIds: new Set<string>(),
        dimmedLifeEventIds: new Set<string>(),
        dimmedTurningPointIds: new Set<string>(),
        dimmedClassificationIds: new Set<string>(),
      };
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([
          ["p1", p1],
          ["p2", p2],
        ]),
        dims,
        filterMode: "hide" as const,
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      const labels = container.querySelectorAll(".tl-person-label");
      expect(labels).toHaveLength(1);
      expect(labels[0].textContent).toBe("Alice");
    });

    it("does not filter dimmed persons when filterMode is dim", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
      const dims = {
        dimmedPersonIds: new Set(["p2"]),
        dimmedEventIds: new Set<string>(),
        dimmedLifeEventIds: new Set<string>(),
        dimmedTurningPointIds: new Set<string>(),
        dimmedClassificationIds: new Set<string>(),
      };
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([
          ["p1", p1],
          ["p2", p2],
        ]),
        dims,
        filterMode: "dim" as const,
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      const labels = container.querySelectorAll(".tl-person-label");
      expect(labels).toHaveLength(2);
    });
  });

  describe("zoom controls", () => {
    it("renders zoom controls", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const props = {
        ...makeBaseProps(),
        persons: new Map<string, DecryptedPerson>([["p1", p1]]),
      };
      const { container } = render(<TimelineYearsContent {...props} />);
      // The TimelineZoomControls component should be rendered alongside the SVG
      // It renders buttons for zoom in/out/reset
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
