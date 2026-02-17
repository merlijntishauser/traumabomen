import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";

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

const mockTraumaColors = { loss: "#ff0000", abuse: "#cc0000" };
const mockLifeEventColors = { career: "#00ff00", relocation: "#0000ff" };

vi.mock("../../lib/traumaColors", () => ({
  getTraumaColors: () => mockTraumaColors,
}));

vi.mock("../../lib/lifeEventColors", () => ({
  getLifeEventColors: () => mockLifeEventColors,
}));

const mockRenderLifeBars = vi.fn();
const mockRenderPartnerLines = vi.fn();
const mockRenderTraumaMarkers = vi.fn();
const mockRenderLifeEventMarkers = vi.fn();
const mockRenderClassificationStrips = vi.fn();

const mockFilterTimelinePersons = vi.fn((persons: Map<string, DecryptedPerson>) => persons);
const mockBuildRowLayout = vi.fn(() => ({
  rows: [{ person: { id: "p1", name: "Alice" }, generation: 0, y: 20 }],
  sortedGens: [0],
  personsByGen: new Map([[0, [{ id: "p1", name: "Alice" }]]]),
  totalHeight: 400,
}));
const mockComputeTimeDomain = vi.fn(() => ({
  minYear: 1950,
  maxYear: 2025,
}));

vi.mock("./timelineHelpers", () => ({
  filterTimelinePersons: (...args: unknown[]) => mockFilterTimelinePersons(...args),
  buildRowLayout: (...args: unknown[]) => mockBuildRowLayout(...args),
  computeTimeDomain: (...args: unknown[]) => mockComputeTimeDomain(...args),
  renderLifeBars: (...args: unknown[]) => mockRenderLifeBars(...args),
  renderPartnerLines: (...args: unknown[]) => mockRenderPartnerLines(...args),
  renderTraumaMarkers: (...args: unknown[]) => mockRenderTraumaMarkers(...args),
  renderLifeEventMarkers: (...args: unknown[]) => mockRenderLifeEventMarkers(...args),
  renderClassificationStrips: (...args: unknown[]) => mockRenderClassificationStrips(...args),
  LABEL_WIDTH: 180,
  ROW_HEIGHT: 36,
  GEN_HEADER_HEIGHT: 20,
}));

// D3 mock -- create a fully chainable selection proxy that returns itself
// for any method call, so the component's D3 chaining never breaks.
function createChainableSelection(): Record<string, ReturnType<typeof vi.fn>> {
  const handler: ProxyHandler<Record<string, ReturnType<typeof vi.fn>>> = {
    get(target, prop: string) {
      if (!(prop in target)) {
        target[prop] = vi.fn().mockImplementation(() => proxy);
      }
      return target[prop];
    },
  };
  const target: Record<string, ReturnType<typeof vi.fn>> = {};
  const proxy = new Proxy(target, handler) as Record<string, ReturnType<typeof vi.fn>>;
  return proxy;
}

const selMock = createChainableSelection();

const scaleMock = {
  domain: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  nice: vi.fn().mockReturnThis(),
};

vi.mock("d3", () => ({
  select: vi.fn(() => selMock),
  scaleLinear: vi.fn(() => scaleMock),
  axisTop: vi.fn(() => ({
    tickFormat: vi.fn().mockReturnThis(),
    ticks: vi.fn().mockReturnThis(),
  })),
  zoom: vi.fn(() => ({
    scaleExtent: vi.fn().mockReturnThis(),
    translateExtent: vi.fn().mockReturnThis(),
    extent: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  })),
  zoomIdentity: {},
}));

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

  it("renders tooltip div element when persons are provided", () => {
    const props = makePopulatedProps();
    const { container } = render(<TimelineView {...props} />);

    const tooltip = container.querySelector(".timeline-tooltip");
    expect(tooltip).toBeTruthy();
  });

  it("does not render tooltip div when persons map is empty", () => {
    const props = makeEmptyProps();
    const { container } = render(<TimelineView {...props} />);

    const tooltip = container.querySelector(".timeline-tooltip");
    expect(tooltip).toBeNull();
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

  it("calls timelineHelper render functions when persons are provided", () => {
    const props = makePopulatedProps();
    render(<TimelineView {...props} />);

    // The render callback fires in useEffect. In jsdom the SVG parent has
    // clientWidth/clientHeight of 0 but the render callback still proceeds
    // (persons.size > 0 and refs are set). The mocked helper functions
    // should be called.
    expect(mockFilterTimelinePersons).toHaveBeenCalled();
    expect(mockBuildRowLayout).toHaveBeenCalled();
    expect(mockComputeTimeDomain).toHaveBeenCalled();
    expect(mockRenderLifeBars).toHaveBeenCalled();
    expect(mockRenderPartnerLines).toHaveBeenCalled();
    expect(mockRenderTraumaMarkers).toHaveBeenCalled();
    expect(mockRenderLifeEventMarkers).toHaveBeenCalled();
    expect(mockRenderClassificationStrips).toHaveBeenCalled();
  });

  it("passes correct color maps to render functions", () => {
    const props = makePopulatedProps();
    render(<TimelineView {...props} />);

    // renderTraumaMarkers receives the trauma color map as the 4th argument
    const traumaCall = mockRenderTraumaMarkers.mock.calls[0];
    expect(traumaCall[3]).toBe(mockTraumaColors);

    // renderLifeEventMarkers receives the life event color map as the 4th argument
    const lifeEventCall = mockRenderLifeEventMarkers.mock.calls[0];
    expect(lifeEventCall[3]).toBe(mockLifeEventColors);
  });

  it("passes relationships and persons to renderPartnerLines", () => {
    const props = makePopulatedProps();
    render(<TimelineView {...props} />);

    const partnerCall = mockRenderPartnerLines.mock.calls[0];
    // 2nd argument is relationships, 3rd is persons
    expect(partnerCall[1]).toBe(props.relationships);
    expect(partnerCall[2]).toBe(props.persons);
  });

  it("passes events and persons to renderTraumaMarkers", () => {
    const props = makePopulatedProps();
    render(<TimelineView {...props} />);

    const traumaCall = mockRenderTraumaMarkers.mock.calls[0];
    // 2nd argument is events, 3rd is persons
    expect(traumaCall[1]).toBe(props.events);
    expect(traumaCall[2]).toBe(props.persons);
  });

  it("passes lifeEvents and persons to renderLifeEventMarkers", () => {
    const props = makePopulatedProps();
    render(<TimelineView {...props} />);

    const lifeEventCall = mockRenderLifeEventMarkers.mock.calls[0];
    // 2nd argument is lifeEvents, 3rd is persons
    expect(lifeEventCall[1]).toBe(props.lifeEvents);
    expect(lifeEventCall[2]).toBe(props.persons);
  });

  it("passes classifications to renderClassificationStrips", () => {
    const props = makePopulatedProps();
    render(<TimelineView {...props} />);

    const clsCall = mockRenderClassificationStrips.mock.calls[0];
    // 2nd argument is classifications
    expect(clsCall[1]).toBe(props.classifications);
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

  it("cleans up resize listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const props = makePopulatedProps();
    const { unmount } = render(<TimelineView {...props} />);

    const resizeAddCalls = addSpy.mock.calls.filter(([event]) => event === "resize");
    expect(resizeAddCalls.length).toBeGreaterThanOrEqual(1);

    unmount();

    const resizeRemoveCalls = removeSpy.mock.calls.filter(([event]) => event === "resize");
    expect(resizeRemoveCalls.length).toBeGreaterThanOrEqual(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("does not call render helpers when persons map is empty", () => {
    const props = makeEmptyProps();
    render(<TimelineView {...props} />);

    expect(mockFilterTimelinePersons).not.toHaveBeenCalled();
    expect(mockRenderLifeBars).not.toHaveBeenCalled();
    expect(mockRenderPartnerLines).not.toHaveBeenCalled();
    expect(mockRenderTraumaMarkers).not.toHaveBeenCalled();
    expect(mockRenderLifeEventMarkers).not.toHaveBeenCalled();
    expect(mockRenderClassificationStrips).not.toHaveBeenCalled();
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
    expect(container.querySelector(".timeline-tooltip")).toBeTruthy();
  });
});
