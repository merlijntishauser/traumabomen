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
vi.mock("../../hooks/useTimelineZoom", () => ({
  useTimelineZoom: ({ xScale }: { xScale: d3.ScaleLinear<number, number> }) => ({
    rescaledX: xScale,
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
});
