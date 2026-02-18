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
    expect(circle?.getAttribute("opacity")).toBe("0.15");
  });
});
