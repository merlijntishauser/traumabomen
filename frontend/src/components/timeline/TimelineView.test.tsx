import { cleanup, render, screen } from "@testing-library/react";
import type * as d3 from "d3";
import { afterEach, describe, expect, it, vi } from "vitest";
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

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../BranchDecoration", () => ({
  BranchDecoration: () => <div data-testid="branch-decoration" />,
}));

vi.mock("./TimelineView.css", () => ({}));

vi.mock("../../lib/traumaColors", () => ({
  getTraumaColors: () => ({ loss: "#ff0000", abuse: "#cc0000" }),
}));

vi.mock("../../lib/lifeEventColors", () => ({
  getLifeEventColors: () => ({ career: "#00ff00", relocation: "#0000ff" }),
}));

// Mock useTimelineZoom to return a pass-through scale
const noopZoomActions = { zoomIn: () => {}, zoomOut: () => {}, resetZoom: () => {} };
vi.mock("../../hooks/useTimelineZoom", () => ({
  useTimelineZoom: ({ scale }: { scale: d3.ScaleLinear<number, number> }) => ({
    rescaled: scale,
    zoomK: 1,
    zoomActions: noopZoomActions,
  }),
}));

// Mock ResizeObserver
class MockResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {
    // Fire callback synchronously with mock dimensions
    this.callback(
      [{ contentRect: { width: 800, height: 400 } }] as unknown as ResizeObserverEntry[],
      this as unknown as ResizeObserver,
    );
  }
  disconnect() {}
  unobserve() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// ---- Helpers ----

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

function makeEmptyProps() {
  return {
    persons: new Map<string, DecryptedPerson>(),
    relationships: new Map<string, DecryptedRelationship>(),
    events: new Map<string, DecryptedEvent>(),
    lifeEvents: new Map<string, DecryptedLifeEvent>(),
    classifications: new Map<string, DecryptedClassification>(),
  };
}

function makePopulatedProps() {
  const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
  return {
    persons: new Map<string, DecryptedPerson>([["p1", p1]]),
    relationships: new Map<string, DecryptedRelationship>(),
    events: new Map<string, DecryptedEvent>(),
    lifeEvents: new Map<string, DecryptedLifeEvent>(),
    classifications: new Map<string, DecryptedClassification>(),
  };
}

// Import TimelineView after all mocks are registered.
const { TimelineView } = await import("./TimelineView");

// ---- Tests ----

describe("TimelineView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders 'timeline.noData' message when persons map is empty", () => {
    const props = makeEmptyProps();
    render(<TimelineView {...props} />);
    expect(screen.getByText("timeline.noData")).toBeTruthy();
  });

  it("does not render SVG element when persons map is empty", () => {
    const props = makeEmptyProps();
    const { container } = render(<TimelineView {...props} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders SVG element when persons are provided", () => {
    const props = makePopulatedProps();
    const { container } = render(<TimelineView {...props} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders the BranchDecoration component", () => {
    const props = makeEmptyProps();
    render(<TimelineView {...props} />);
    expect(screen.getByTestId("branch-decoration")).toBeTruthy();
  });

  it("renders the timeline-container with bg-gradient class", () => {
    const props = makeEmptyProps();
    const { container } = render(<TimelineView {...props} />);
    const wrapper = container.querySelector(".timeline-container.bg-gradient");
    expect(wrapper).toBeTruthy();
  });

  it("renders timeline-empty div with correct class when no persons", () => {
    const props = makeEmptyProps();
    const { container } = render(<TimelineView {...props} />);
    const emptyDiv = container.querySelector(".timeline-empty");
    expect(emptyDiv).toBeTruthy();
    expect(emptyDiv?.textContent).toBe("timeline.noData");
  });

  it("does not render timeline-empty div when persons are provided", () => {
    const props = makePopulatedProps();
    const { container } = render(<TimelineView {...props} />);
    const emptyDiv = container.querySelector(".timeline-empty");
    expect(emptyDiv).toBeNull();
  });

  it("renders person name labels", () => {
    const props = makePopulatedProps();
    const { container } = render(<TimelineView {...props} />);
    const labels = container.querySelectorAll(".tl-person-label");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels[0].textContent).toBe("Alice");
  });

  it("renders generation labels", () => {
    const props = makePopulatedProps();
    const { container } = render(<TimelineView {...props} />);
    const genLabels = container.querySelectorAll(".tl-gen-label");
    expect(genLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders clip path", () => {
    const props = makePopulatedProps();
    const { container } = render(<TimelineView {...props} />);
    const clipPath = container.querySelector("#timeline-clip");
    expect(clipPath).toBeTruthy();
  });

  it("renders zoom group for time content", () => {
    const props = makePopulatedProps();
    const { container } = render(<TimelineView {...props} />);
    const timeGroup = container.querySelector(".tl-time");
    expect(timeGroup).toBeTruthy();
  });

  it("renders a life bar rect for a person with birth_year", () => {
    const props = makePopulatedProps();
    const { container } = render(<TimelineView {...props} />);
    const timeGroup = container.querySelector(".tl-time");
    const rects = timeGroup?.querySelectorAll("rect");
    expect(rects?.length).toBeGreaterThanOrEqual(1);
  });

  it("renders trauma markers as circles", () => {
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const props = {
      ...makeEmptyProps(),
      persons: new Map([["p1", p1]]),
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
    const { container } = render(<TimelineView {...props} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });

  it("renders life event markers as rotated rects", () => {
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const props = {
      ...makeEmptyProps(),
      persons: new Map([["p1", p1]]),
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
    const { container } = render(<TimelineView {...props} />);
    const timeGroup = container.querySelector(".tl-time");
    const rects = timeGroup?.querySelectorAll("rect");
    // Should have at least life bar + diamond
    expect(rects?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("renders partner lines between partners", () => {
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
    const props = {
      ...makeEmptyProps(),
      persons: new Map([
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
    const { container } = render(<TimelineView {...props} />);
    const lines = container.querySelectorAll("line");
    // Should have visible line + hover target = at least 2
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it("accepts multiple persons without crashing", () => {
    const p1 = makePerson("p1");
    const p2 = makePerson("p2");
    const props = {
      ...makeEmptyProps(),
      persons: new Map<string, DecryptedPerson>([
        ["p1", p1],
        ["p2", p2],
      ]),
    };

    const { container } = render(<TimelineView {...props} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders axis ticks", () => {
    const props = makePopulatedProps();
    const { container } = render(<TimelineView {...props} />);
    const axisGroup = container.querySelector(".tl-axis");
    expect(axisGroup).toBeTruthy();
  });

  it("does not render tooltip initially", () => {
    const props = makePopulatedProps();
    const { container } = render(<TimelineView {...props} />);
    const tooltip = container.querySelector(".timeline-tooltip");
    expect(tooltip).toBeNull();
  });

  describe("selection and dimming", () => {
    function makeTwoPersonProps() {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
      return {
        ...makeEmptyProps(),
        persons: new Map<string, DecryptedPerson>([
          ["p1", p1],
          ["p2", p2],
        ]),
      };
    }

    it("applies selected class to selected person label", () => {
      const props = makeTwoPersonProps();
      const { container } = render(<TimelineView {...props} selectedPersonId="p1" />);
      const labels = container.querySelectorAll(".tl-person-label");
      const aliceLabel = Array.from(labels).find((l) => l.textContent === "Alice");
      expect(aliceLabel?.classList.contains("tl-person-label--selected")).toBe(true);
    });

    it("applies dimmed class to non-selected person labels when selection active", () => {
      const props = makeTwoPersonProps();
      const { container } = render(<TimelineView {...props} selectedPersonId="p1" />);
      const labels = container.querySelectorAll(".tl-person-label");
      const bobLabel = Array.from(labels).find((l) => l.textContent === "Bob");
      expect(bobLabel?.classList.contains("tl-person-label--dimmed")).toBe(true);
    });

    it("applies selected class to selected person lane", () => {
      const props = makeTwoPersonProps();
      const { container } = render(<TimelineView {...props} selectedPersonId="p1" />);
      const lanes = container.querySelectorAll(".tl-lane");
      const selectedLanes = container.querySelectorAll(".tl-lane--selected");
      expect(lanes.length).toBe(2);
      expect(selectedLanes.length).toBe(1);
    });

    it("applies dimmed class to non-selected person lanes", () => {
      const props = makeTwoPersonProps();
      const { container } = render(<TimelineView {...props} selectedPersonId="p1" />);
      const dimmedLanes = container.querySelectorAll(".tl-lane--dimmed");
      expect(dimmedLanes.length).toBe(1);
    });

    it("no selection means no selected or dimmed classes", () => {
      const props = makeTwoPersonProps();
      const { container } = render(<TimelineView {...props} selectedPersonId={null} />);
      expect(container.querySelectorAll(".tl-lane--selected").length).toBe(0);
      expect(container.querySelectorAll(".tl-lane--dimmed").length).toBe(0);
      expect(container.querySelectorAll(".tl-person-label--selected").length).toBe(0);
      expect(container.querySelectorAll(".tl-person-label--dimmed").length).toBe(0);
    });

    it("calls onSelectPerson when person label is clicked", () => {
      const props = makeTwoPersonProps();
      const onSelectPerson = vi.fn();
      const { container } = render(<TimelineView {...props} onSelectPerson={onSelectPerson} />);
      const labels = container.querySelectorAll(".tl-person-label");
      const aliceLabel = Array.from(labels).find((l) => l.textContent === "Alice");
      aliceLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onSelectPerson).toHaveBeenCalledWith("p1");
    });

    it("deselects person when clicking already selected person label", () => {
      const props = makeTwoPersonProps();
      const onSelectPerson = vi.fn();
      const { container } = render(
        <TimelineView {...props} selectedPersonId="p1" onSelectPerson={onSelectPerson} />,
      );
      const labels = container.querySelectorAll(".tl-person-label");
      const aliceLabel = Array.from(labels).find((l) => l.textContent === "Alice");
      aliceLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onSelectPerson).toHaveBeenCalledWith(null);
    });
  });

  describe("age mode", () => {
    it("renders SVG with age clip path in age mode", () => {
      const props = makePopulatedProps();
      const { container } = render(<TimelineView {...props} layoutMode="age" />);
      expect(container.querySelector("svg")).toBeTruthy();
      expect(container.querySelector("#timeline-clip-age")).toBeTruthy();
    });

    it("renders column headers in age mode", () => {
      const props = makePopulatedProps();
      const { container } = render(<TimelineView {...props} layoutMode="age" />);
      const colHeaders = container.querySelectorAll(".tl-col-header");
      expect(colHeaders.length).toBeGreaterThanOrEqual(1);
    });

    it("renders age axis labels in age mode", () => {
      const props = makePopulatedProps();
      const { container } = render(<TimelineView {...props} layoutMode="age" />);
      const ageLabels = container.querySelectorAll(".tl-age-axis-text");
      expect(ageLabels.length).toBeGreaterThanOrEqual(1);
    });

    it("renders person name labels in column headers", () => {
      const props = makePopulatedProps();
      const { container } = render(<TimelineView {...props} layoutMode="age" />);
      const personNames = container.querySelectorAll(".tl-col-person-name");
      expect(personNames.length).toBeGreaterThanOrEqual(1);
    });

    it("renders vertical life bar in age mode", () => {
      const props = makePopulatedProps();
      const { container } = render(<TimelineView {...props} layoutMode="age" />);
      const lifebar = container.querySelector(".tl-lifebar-v");
      expect(lifebar).toBeTruthy();
    });

    it("does not render years-mode clip path in age mode", () => {
      const props = makePopulatedProps();
      const { container } = render(<TimelineView {...props} layoutMode="age" />);
      expect(container.querySelector("#timeline-clip")).toBeNull();
    });

    it("renders zoom group in age mode", () => {
      const props = makePopulatedProps();
      const { container } = render(<TimelineView {...props} layoutMode="age" />);
      const timeGroup = container.querySelector(".tl-time");
      expect(timeGroup).toBeTruthy();
    });

    it("truncates long person names in age mode column headers", () => {
      const longNamePerson = makePerson("p1", { name: "Alexander", birth_year: 1960 });
      const shortNamePerson = makePerson("p2", { name: "Alice", birth_year: 1965 });
      const props = {
        ...makeEmptyProps(),
        persons: new Map<string, DecryptedPerson>([
          ["p1", longNamePerson],
          ["p2", shortNamePerson],
        ]),
      };
      const { container } = render(<TimelineView {...props} layoutMode="age" />);
      const personNames = container.querySelectorAll(".tl-col-person-name");
      const texts = Array.from(personNames).map((el) => el.textContent);
      expect(texts).toContain("Alex..");
      expect(texts).toContain("Alice");
    });

    it("calls onSelectPerson with null when background is clicked in age mode", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const props = {
        ...makeEmptyProps(),
        persons: new Map<string, DecryptedPerson>([["p1", p1]]),
      };
      const onSelectPerson = vi.fn();
      const { container } = render(
        <TimelineView {...props} layoutMode="age" onSelectPerson={onSelectPerson} />,
      );
      // The transparent background rect is the one with fill="transparent" outside the zoom group
      const bgRects = container.querySelectorAll('rect[fill="transparent"]');
      const bgRect = Array.from(bgRects).find((r) => !r.classList.contains("tl-lane-hitarea"));
      bgRect?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onSelectPerson).toHaveBeenCalledWith(null);
    });

    it("renders horizontal gridlines when showGridlines is true in age mode", () => {
      const props = makePopulatedProps();
      const { container } = render(<TimelineView {...props} layoutMode="age" showGridlines />);
      const ageLabels = container.querySelectorAll(".tl-age-axis-text");
      // There should be at least one gridline (one per tick)
      const lines = container.querySelectorAll("line");
      expect(lines.length).toBeGreaterThanOrEqual(ageLabels.length);
    });

    it("does not render gridlines by default in age mode", () => {
      const props = makePopulatedProps();
      const { container } = render(<TimelineView {...props} layoutMode="age" />);
      // Without gridlines, lines are only from axis ticks (none in age mode axis)
      // The age mode axis uses text only, no tick lines
      const bgGroup = container.querySelector(".tl-bg");
      const gridLines = bgGroup?.querySelectorAll("line");
      expect(gridLines?.length ?? 0).toBe(0);
    });

    it("applies dimmed class to non-selected person in age mode", () => {
      const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
      const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
      const props = {
        ...makeEmptyProps(),
        persons: new Map<string, DecryptedPerson>([
          ["p1", p1],
          ["p2", p2],
        ]),
      };
      const { container } = render(
        <TimelineView {...props} layoutMode="age" selectedPersonId="p1" />,
      );
      const selectedLanes = container.querySelectorAll(".tl-lane--selected");
      const dimmedLanes = container.querySelectorAll(".tl-lane--dimmed");
      expect(selectedLanes.length).toBe(1);
      expect(dimmedLanes.length).toBe(1);
    });
  });
});
