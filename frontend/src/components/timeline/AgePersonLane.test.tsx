import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import { LifeEventCategory, TraumaCategory } from "../../types/domain";
import { AgePersonLane } from "./AgePersonLane";
import type { PatternRingsMap } from "./TimelinePatternLanes";
import { MARKER_RADIUS } from "./timelineHelpers";

// ---- Mocks ----

vi.mock("./timelineHelpers", async () => {
  const actual = await vi.importActual("./timelineHelpers");
  return actual;
});

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
    cause_of_death: null,
    gender: "unknown",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

function makeBaseProps(personOverrides: Partial<DecryptedPerson> = {}) {
  const person = makePerson("p1", { name: "Alice", birth_year: 1980, ...personOverrides });
  return {
    person,
    x: 40,
    laneWidth: 36,
    currentYear: 2024,
    events: [] as DecryptedEvent[],
    lifeEvents: [] as DecryptedLifeEvent[],
    classifications: [] as DecryptedClassification[],
    persons: new Map<string, DecryptedPerson>([["p1", person]]),
    traumaColors: { loss: "#ff0000", abuse: "#cc0000" } as Record<TraumaCategory, string>,
    lifeEventColors: { career: "#00ff00", relocation: "#0000ff" } as Record<
      LifeEventCategory,
      string
    >,
    yScale: (v: number) => v,
    cssVar: (name: string) => {
      const vars: Record<string, string> = {
        "--color-lifebar-fill": "#3a7a5a",
        "--color-lifebar-stroke": "#2d8a5e",
        "--color-bg-canvas": "#1a1a1a",
        "--color-classification-diagnosed": "#4a90d9",
        "--color-classification-suspected": "#d4a000",
      };
      return vars[name] ?? "";
    },
    t: (key: string) => key,
    onTooltip: vi.fn(),
  };
}

// ---- Tests ----

describe("AgePersonLane", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a vertical life bar for a person with birth_year", () => {
    const props = makeBaseProps();
    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const lifebar = container.querySelector(".tl-lifebar-v");
    expect(lifebar).toBeTruthy();
    // Height should be currentAge: 2024 - 1980 = 44
    expect(lifebar?.getAttribute("height")).toBe("44");
    // y should be 0 (age 0)
    expect(lifebar?.getAttribute("y")).toBe("0");
  });

  it("uses death_year for life bar height when person is deceased", () => {
    const props = makeBaseProps({ death_year: 2020 });
    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const lifebar = container.querySelector(".tl-lifebar-v");
    // Height: 2020 - 1980 = 40
    expect(lifebar?.getAttribute("height")).toBe("40");
  });

  it("renders trauma markers at correct age positions", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(1);
    // Age at 2000: 2000 - 1980 = 20
    expect(circles[0].getAttribute("cy")).toBe("20");
  });

  it("renders life event diamonds at correct age positions", () => {
    const props = makeBaseProps();
    props.lifeEvents = [
      {
        id: "le1",
        person_ids: ["p1"],
        title: "Career move",
        description: "",
        category: LifeEventCategory.Career,
        approximate_date: "1995",
        impact: null,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const timeGroup = container.querySelector(".tl-lane");
    const rects = timeGroup?.querySelectorAll("rect");
    // Should have hit area + lifebar + diamond = 3 rects
    expect(rects?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("applies dimmed class when dimmed prop is true", () => {
    const props = makeBaseProps();
    const { container } = render(
      <svg>
        <AgePersonLane {...props} dimmed />
      </svg>,
    );

    const lane = container.querySelector(".tl-lane--dimmed");
    expect(lane).toBeTruthy();
  });

  it("applies selected class when selected prop is true", () => {
    const props = makeBaseProps();
    const { container } = render(
      <svg>
        <AgePersonLane {...props} selected />
      </svg>,
    );

    const lane = container.querySelector(".tl-lane--selected");
    expect(lane).toBeTruthy();
  });

  it("calls onSelectPerson when lane is clicked", () => {
    const onSelectPerson = vi.fn();
    const props = makeBaseProps();
    const { container } = render(
      <svg>
        <AgePersonLane {...props} onSelectPerson={onSelectPerson} />
      </svg>,
    );

    const hitArea = container.querySelector(".tl-lane-hitarea");
    fireEvent.click(hitArea!);
    expect(onSelectPerson).toHaveBeenCalledWith("p1");
  });

  it("does not render life bar when birth_year is null", () => {
    const props = makeBaseProps({ birth_year: null });
    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const lifebar = container.querySelector(".tl-lifebar-v");
    expect(lifebar).toBeNull();
  });

  it("renders classification strips as vertical rects", () => {
    const props = makeBaseProps();
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: null,
        status: "suspected",
        diagnosis_year: null,
        periods: [{ start_year: 2000, end_year: 2010 }],
        notes: null,
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const markers = container.querySelectorAll(".tl-marker");
    expect(markers.length).toBeGreaterThanOrEqual(1);
  });

  it("renders diagnosed classification with triangle marker", () => {
    const props = makeBaseProps();
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: "major_depressive",
        status: "diagnosed",
        diagnosis_year: 2005,
        periods: [{ start_year: 2000, end_year: 2010 }],
        notes: null,
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(1);
  });

  it("does not duplicate label when diagnosis_year equals period start_year", () => {
    const props = makeBaseProps();
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: null,
        status: "diagnosed",
        diagnosis_year: 2000,
        periods: [{ start_year: 2000, end_year: 2010 }],
        notes: null,
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const labels = Array.from(container.querySelectorAll(".tl-marker-label")).filter(
      (l) => l.textContent === "dsm.depressive",
    );
    expect(labels).toHaveLength(1);
  });

  it("shows tooltip on trauma marker hover", () => {
    const onTooltip = vi.fn();
    const props = makeBaseProps();
    props.onTooltip = onTooltip;
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const circle = container.querySelector("circle");
    fireEvent.mouseEnter(circle!);
    expect(onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: true }));
  });

  it("hides tooltip on marker mouse leave", () => {
    const onTooltip = vi.fn();
    const props = makeBaseProps();
    props.onTooltip = onTooltip;
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const circle = container.querySelector("circle");
    fireEvent.mouseLeave(circle!);
    expect(onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it("calls onClickMarker when trauma marker is clicked", () => {
    const onClickMarker = vi.fn();
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} onClickMarker={onClickMarker} mode="edit" />
      </svg>,
    );

    const circle = container.querySelector("circle");
    fireEvent.click(circle!);
    expect(onClickMarker).toHaveBeenCalledWith({
      personId: "p1",
      entityType: "trauma_event",
      entityId: "e1",
    });
  });

  it("calls onClickMarker when life event marker is clicked", () => {
    const onClickMarker = vi.fn();
    const props = makeBaseProps();
    props.lifeEvents = [
      {
        id: "le1",
        person_ids: ["p1"],
        title: "Career move",
        description: "",
        category: LifeEventCategory.Career,
        approximate_date: "1995",
        impact: 3,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} onClickMarker={onClickMarker} mode="edit" />
      </svg>,
    );

    // Diamond is a rotated rect, find the marker-class rect (not hitarea/lifebar)
    const markers = container.querySelectorAll(".tl-marker");
    expect(markers.length).toBe(1);
    fireEvent.click(markers[0]);
    expect(onClickMarker).toHaveBeenCalledWith({
      personId: "p1",
      entityType: "life_event",
      entityId: "le1",
    });
  });

  it("renders label text next to trauma marker by default", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "War trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const labels = container.querySelectorAll(".tl-marker-label");
    expect(labels).toHaveLength(1);
    expect(labels[0].textContent).toBe("War trauma");
  });

  it("renders label text next to life event marker by default", () => {
    const props = makeBaseProps();
    props.lifeEvents = [
      {
        id: "le1",
        person_ids: ["p1"],
        title: "Teaching degree",
        description: "",
        category: LifeEventCategory.Career,
        approximate_date: "1995",
        impact: null,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const labels = container.querySelectorAll(".tl-marker-label");
    expect(labels).toHaveLength(1);
    expect(labels[0].textContent).toBe("Teaching degree");
  });

  it("hides all marker labels when showMarkerLabels is false", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];
    props.lifeEvents = [
      {
        id: "le1",
        person_ids: ["p1"],
        title: "Career move",
        description: "",
        category: LifeEventCategory.Career,
        approximate_date: "1995",
        impact: null,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} showMarkerLabels={false} />
      </svg>,
    );

    const labels = container.querySelectorAll(".tl-marker-label");
    expect(labels).toHaveLength(0);
  });

  it("renders edit cursor in edit mode", () => {
    const props = makeBaseProps();
    const { container } = render(
      <svg>
        <AgePersonLane {...props} mode="edit" />
      </svg>,
    );

    const hitArea = container.querySelector(".tl-lane-hitarea--edit");
    expect(hitArea).toBeTruthy();
  });

  it("skips trauma markers with non-numeric dates", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "unknown",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(0);
  });

  it("shows tooltip on classification strip hover", () => {
    const onTooltip = vi.fn();
    const props = makeBaseProps();
    props.onTooltip = onTooltip;
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: null,
        status: "suspected",
        diagnosis_year: null,
        periods: [{ start_year: 2000, end_year: 2010 }],
        notes: null,
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const markers = container.querySelectorAll(".tl-marker");
    fireEvent.mouseEnter(markers[0]);
    expect(onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: true }));
  });

  it("shows tooltip on life event hover with impact", () => {
    const onTooltip = vi.fn();
    const props = makeBaseProps();
    props.onTooltip = onTooltip;
    props.lifeEvents = [
      {
        id: "le1",
        person_ids: ["p1"],
        title: "Career move",
        description: "",
        category: LifeEventCategory.Career,
        approximate_date: "1995",
        impact: 7,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const markers = container.querySelectorAll(".tl-marker");
    fireEvent.mouseEnter(markers[0]);
    expect(onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: true }));
  });

  it("dims classification markers when dimmed in dims set", () => {
    const props = makeBaseProps();
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: null,
        status: "suspected",
        diagnosis_year: null,
        periods: [{ start_year: 2000, end_year: 2010 }],
        notes: null,
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane
          {...props}
          dims={{
            dimmedPersonIds: new Set(),
            dimmedEventIds: new Set(),
            dimmedLifeEventIds: new Set(),
            dimmedClassificationIds: new Set(["c1"]),
          }}
        />
      </svg>,
    );

    // The g wrapping the classification should have opacity 0.15
    const markers = container.querySelectorAll(".tl-marker");
    const parentG = markers[0]?.parentElement;
    expect(parentG?.getAttribute("opacity")).toBe("0.15");
  });

  it("hides classification strips when showClassifications is false", () => {
    const props = makeBaseProps();
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: null,
        status: "suspected",
        diagnosis_year: null,
        periods: [{ start_year: 1990, end_year: 2005 }],
        notes: null,
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} showClassifications={false} />
      </svg>,
    );

    const strips = container.querySelectorAll("rect.tl-marker");
    expect(strips).toHaveLength(0);
  });

  it("shows classification strips when showClassifications is true (default)", () => {
    const props = makeBaseProps();
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: null,
        status: "suspected",
        diagnosis_year: null,
        periods: [{ start_year: 1990, end_year: 2005 }],
        notes: null,
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const strips = container.querySelectorAll("rect.tl-marker");
    expect(strips).toHaveLength(1);
  });

  it("renders annotate cursor in annotate mode", () => {
    const props = makeBaseProps();
    const { container } = render(
      <svg>
        <AgePersonLane {...props} mode="annotate" />
      </svg>,
    );

    const hitArea = container.querySelector(".tl-lane-hitarea--annotate");
    expect(hitArea).toBeTruthy();
  });

  it("renders selection ring when entity is selected in annotate mode", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane
          {...props}
          mode="annotate"
          selectedEntityKeys={new Set(["trauma_event:e1"])}
        />
      </svg>,
    );

    const rings = container.querySelectorAll(".tl-selection-ring");
    expect(rings.length).toBe(1);
  });

  it("does not render selection ring when entity is not selected", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} mode="annotate" selectedEntityKeys={new Set()} />
      </svg>,
    );

    const rings = container.querySelectorAll(".tl-selection-ring");
    expect(rings.length).toBe(0);
  });

  it("calls onToggleEntitySelect when marker clicked in annotate mode", () => {
    const onToggleEntitySelect = vi.fn();
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} mode="annotate" onToggleEntitySelect={onToggleEntitySelect} />
      </svg>,
    );

    const circle = container.querySelector("circle");
    fireEvent.click(circle!);
    expect(onToggleEntitySelect).toHaveBeenCalledWith("trauma_event:e1");
  });

  it("shows tooltip on diagnosis triangle hover", () => {
    const onTooltip = vi.fn();
    const props = makeBaseProps();
    props.onTooltip = onTooltip;
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: "major_depressive",
        status: "diagnosed",
        diagnosis_year: 2005,
        periods: [{ start_year: 2000, end_year: 2010 }],
        notes: null,
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const triangle = container.querySelector("path");
    expect(triangle).toBeTruthy();
    fireEvent.mouseEnter(triangle!);
    expect(onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: true }));
  });

  it("calls onClickMarker when classification strip is clicked", () => {
    const onClickMarker = vi.fn();
    const props = makeBaseProps();
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: null,
        status: "suspected",
        diagnosis_year: null,
        periods: [{ start_year: 2000, end_year: 2010 }],
        notes: null,
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} onClickMarker={onClickMarker} mode="edit" />
      </svg>,
    );

    const strip = container.querySelector("rect.tl-marker");
    fireEvent.click(strip!);
    expect(onClickMarker).toHaveBeenCalledWith({
      personId: "p1",
      entityType: "classification",
      entityId: "c1",
    });
  });

  it("calls onClickMarker when diagnosis triangle is clicked", () => {
    const onClickMarker = vi.fn();
    const props = makeBaseProps();
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: null,
        status: "diagnosed",
        diagnosis_year: 2005,
        periods: [{ start_year: 2000, end_year: 2010 }],
        notes: null,
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} onClickMarker={onClickMarker} mode="edit" />
      </svg>,
    );

    const triangle = container.querySelector("path");
    expect(triangle).toBeTruthy();
    fireEvent.click(triangle!);
    expect(onClickMarker).toHaveBeenCalledWith({
      personId: "p1",
      entityType: "classification",
      entityId: "c1",
    });
  });

  it("applies counter-scale transform on markers when zoomK > 1", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} zoomK={2} />
      </svg>,
    );

    const circle = container.querySelector("circle");
    const markerG = circle?.parentElement;
    const transform = markerG?.getAttribute("transform");
    expect(transform).toBeTruthy();
    expect(transform).toContain("scale(1,0.5)");
  });

  it("does not apply counter-scale transform when zoomK is 1", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} zoomK={1} />
      </svg>,
    );

    const circle = container.querySelector("circle");
    const markerG = circle?.parentElement;
    expect(markerG?.getAttribute("transform")).toBeNull();
  });

  it("does not call onClickMarker in annotate mode", () => {
    const onClickMarker = vi.fn();
    const onToggleEntitySelect = vi.fn();
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane
          {...props}
          mode="annotate"
          onClickMarker={onClickMarker}
          onToggleEntitySelect={onToggleEntitySelect}
        />
      </svg>,
    );

    const circle = container.querySelector("circle");
    fireEvent.click(circle!);
    expect(onClickMarker).not.toHaveBeenCalled();
    expect(onToggleEntitySelect).toHaveBeenCalledWith("trauma_event:e1");
  });

  it("dims trauma event markers when dimmed in dims set", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane
          {...props}
          dims={{
            dimmedPersonIds: new Set(),
            dimmedEventIds: new Set(["e1"]),
            dimmedLifeEventIds: new Set(),
            dimmedClassificationIds: new Set(),
          }}
        />
      </svg>,
    );

    const circle = container.querySelector("circle");
    expect(circle?.closest("g[opacity]")?.getAttribute("opacity")).toBe("0.15");
  });

  it("renders pattern rings on trauma event markers", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const patternRings: PatternRingsMap = new Map([
      [
        "trauma_event:e1",
        [
          { patternId: "pat1", color: "#ff0000" },
          { patternId: "pat2", color: "#00ff00" },
        ],
      ],
    ]);

    const { container } = render(
      <svg>
        <AgePersonLane {...props} patternRings={patternRings} />
      </svg>,
    );

    const rings = container.querySelectorAll(".tl-pattern-ring");
    expect(rings).toHaveLength(2);
    // First ring
    expect(rings[0].getAttribute("stroke")).toBe("#ff0000");
    expect(rings[0].getAttribute("r")).toBe(String(MARKER_RADIUS + 2));
    // Second ring with increasing radius
    expect(rings[1].getAttribute("stroke")).toBe("#00ff00");
    expect(rings[1].getAttribute("r")).toBe(String(MARKER_RADIUS + 2 + 2));
  });

  it("renders pattern rings on life event markers", () => {
    const props = makeBaseProps();
    props.lifeEvents = [
      {
        id: "le1",
        person_ids: ["p1"],
        title: "Career move",
        description: "",
        category: LifeEventCategory.Career,
        approximate_date: "1995",
        impact: 3,
        tags: [],
      },
    ];

    const patternRings: PatternRingsMap = new Map([
      [
        "life_event:le1",
        [
          { patternId: "pat1", color: "#aa00aa" },
          { patternId: "pat2", color: "#00aaaa" },
        ],
      ],
    ]);

    const { container } = render(
      <svg>
        <AgePersonLane {...props} patternRings={patternRings} />
      </svg>,
    );

    const rings = container.querySelectorAll(".tl-pattern-ring");
    expect(rings).toHaveLength(2);
    expect(rings[0].getAttribute("stroke")).toBe("#aa00aa");
    expect(rings[0].getAttribute("r")).toBe(String(MARKER_RADIUS + 2));
    expect(rings[1].getAttribute("stroke")).toBe("#00aaaa");
    expect(rings[1].getAttribute("r")).toBe(String(MARKER_RADIUS + 2 + 2));
  });

  it("renders pattern rings on classification diagnosis triangle markers", () => {
    const props = makeBaseProps();
    props.classifications = [
      {
        id: "c1",
        person_ids: ["p1"],
        dsm_category: "depressive",
        dsm_subcategory: null,
        status: "diagnosed",
        diagnosis_year: 2005,
        periods: [{ start_year: 2000, end_year: 2010 }],
        notes: null,
      },
    ];

    const patternRings: PatternRingsMap = new Map([
      [
        "classification:c1",
        [
          { patternId: "pat1", color: "#1122cc" },
          { patternId: "pat2", color: "#cc2211" },
          { patternId: "pat3", color: "#33dd33" },
        ],
      ],
    ]);

    const { container } = render(
      <svg>
        <AgePersonLane {...props} patternRings={patternRings} />
      </svg>,
    );

    const rings = container.querySelectorAll(".tl-pattern-ring");
    expect(rings).toHaveLength(3);
    expect(rings[0].getAttribute("stroke")).toBe("#1122cc");
    expect(rings[0].getAttribute("r")).toBe(String(MARKER_RADIUS + 2));
    expect(rings[1].getAttribute("stroke")).toBe("#cc2211");
    expect(rings[1].getAttribute("r")).toBe(String(MARKER_RADIUS + 2 + 2));
    expect(rings[2].getAttribute("stroke")).toBe("#33dd33");
    expect(rings[2].getAttribute("r")).toBe(String(MARKER_RADIUS + 2 + 4));
  });

  it("does not render pattern rings when patternRings is undefined", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );

    const rings = container.querySelectorAll(".tl-pattern-ring");
    expect(rings).toHaveLength(0);
  });

  it("does not render pattern rings when entity has no matching rings", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
    ];

    const patternRings: PatternRingsMap = new Map([
      ["trauma_event:other_id", [{ patternId: "pat1", color: "#ff0000" }]],
    ]);

    const { container } = render(
      <svg>
        <AgePersonLane {...props} patternRings={patternRings} />
      </svg>,
    );

    const rings = container.querySelectorAll(".tl-pattern-ring");
    expect(rings).toHaveLength(0);
  });

  it("hides trauma markers when dimmed and filterMode is hide", () => {
    const props = makeBaseProps();
    props.events = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Trauma",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "2000",
        severity: 5,
        tags: [],
      },
      {
        id: "e2",
        person_ids: ["p1"],
        title: "Trauma 2",
        description: "",
        category: TraumaCategory.Abuse,
        approximate_date: "2005",
        severity: 3,
        tags: [],
      },
    ];
    props.dims = {
      dimmedEventIds: new Set(["e1"]),
      dimmedLifeEventIds: new Set(),
      dimmedClassificationIds: new Set(),
    };
    props.filterMode = "hide";

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );
    const circles = container.querySelectorAll("circle.tl-marker");
    expect(circles).toHaveLength(1);
  });

  it("hides life event markers when dimmed and filterMode is hide", () => {
    const props = makeBaseProps();
    props.lifeEvents = [
      {
        id: "le1",
        person_ids: ["p1"],
        title: "Career",
        description: "",
        category: LifeEventCategory.Career,
        approximate_date: "2005",
        impact: 3,
        tags: [],
      },
    ];
    props.dims = {
      dimmedEventIds: new Set(),
      dimmedLifeEventIds: new Set(["le1"]),
      dimmedClassificationIds: new Set(),
    };
    props.filterMode = "hide";

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );
    const diamonds = container.querySelectorAll("rect[transform]");
    expect(diamonds).toHaveLength(0);
  });

  it("skips life event markers with non-numeric dates", () => {
    const props = makeBaseProps();
    props.lifeEvents = [
      {
        id: "le1",
        person_ids: ["p1"],
        title: "Vague",
        description: "",
        category: LifeEventCategory.Career,
        approximate_date: "circa 2000",
        impact: 3,
        tags: [],
      },
    ];

    const { container } = render(
      <svg>
        <AgePersonLane {...props} />
      </svg>,
    );
    const diamonds = container.querySelectorAll("rect[transform]");
    expect(diamonds).toHaveLength(0);
  });
});
