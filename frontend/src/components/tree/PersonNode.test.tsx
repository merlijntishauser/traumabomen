import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import { LIFE_EVENT_COLORS } from "../../lib/lifeEventColors";
import { TRAUMA_COLORS } from "../../lib/traumaColors";
import { LifeEventCategory, TraumaCategory } from "../../types/domain";
import { PersonNode } from "./PersonNode";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

function makePerson(overrides: Partial<DecryptedPerson> = {}): DecryptedPerson {
  return {
    id: "p1",
    name: "Alice",
    birth_year: 1960,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    gender: "female",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<DecryptedEvent> = {}): DecryptedEvent {
  return {
    id: "e1",
    title: "Event 1",
    description: "desc",
    category: TraumaCategory.Loss,
    approximate_date: "1985",
    severity: 5,
    tags: [],
    person_ids: ["p1"],
    ...overrides,
  };
}

function makeLifeEvent(overrides: Partial<DecryptedLifeEvent> = {}): DecryptedLifeEvent {
  return {
    id: "le1",
    title: "Life Event 1",
    description: "desc",
    category: LifeEventCategory.Family,
    approximate_date: "2000",
    impact: 7,
    tags: [],
    person_ids: ["p1"],
    ...overrides,
  };
}

function makeClassification(
  overrides: Partial<DecryptedClassification> = {},
): DecryptedClassification {
  return {
    id: "c1",
    dsm_category: "anxiety",
    dsm_subcategory: null,
    status: "diagnosed",
    diagnosis_year: 2020,
    periods: [],
    notes: null,
    person_ids: ["p1"],
    ...overrides,
  };
}

interface RenderOptions {
  events?: DecryptedEvent[];
  lifeEvents?: DecryptedLifeEvent[];
  classifications?: DecryptedClassification[];
  selected?: boolean;
  isFriendOnly?: boolean;
}

function renderNode(person: DecryptedPerson, opts: RenderOptions = {}) {
  const {
    events = [],
    lifeEvents = [],
    classifications = [],
    selected = false,
    isFriendOnly = false,
  } = opts;
  const props = {
    id: person.id,
    data: { person, events, lifeEvents, classifications, isFriendOnly },
    selected,
    type: "person",
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    draggable: true,
    dragging: false,
    selectable: true,
    deletable: false,
  } as Parameters<typeof PersonNode>[0];

  return render(<PersonNode {...props} />);
}

describe("PersonNode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders person name", () => {
    renderNode(makePerson({ name: "Alice" }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders birth year with dash and current age when alive", () => {
    renderNode(makePerson({ birth_year: 1960, death_year: null }));
    expect(screen.getByText("1960 - (66)")).toBeInTheDocument();
  });

  it("renders birth and death year with dagger-prefixed age when deceased", () => {
    renderNode(makePerson({ birth_year: 1920, death_year: 1995 }));
    expect(
      screen.getByText((_content, element) =>
        element?.classList.contains("person-node__years")
          ? element.textContent?.includes("1920 - 1995") === true &&
            element.textContent?.includes("\u2020") === true &&
            element.textContent?.includes("75") === true
          : false,
      ),
    ).toBeInTheDocument();
  });

  it("renders unknown birth year as question mark without age", () => {
    renderNode(makePerson({ birth_year: null, death_year: null }));
    expect(screen.getByText("? -")).toBeInTheDocument();
  });

  it("renders unknown birth year with known death year without age", () => {
    renderNode(makePerson({ birth_year: null, death_year: 1995 }));
    expect(screen.getByText("? - 1995")).toBeInTheDocument();
  });

  it("shows adopted label when is_adopted is true", () => {
    renderNode(makePerson({ is_adopted: true }));
    expect(screen.getByText(/person.isAdopted/i)).toBeInTheDocument();
  });

  it("does not show adopted label when is_adopted is false", () => {
    renderNode(makePerson({ is_adopted: false }));
    expect(screen.queryByText(/person.isAdopted/i)).not.toBeInTheDocument();
  });

  it("renders trauma event badges with correct colors", () => {
    const events = [
      makeEvent({ id: "e1", category: TraumaCategory.Loss }),
      makeEvent({ id: "e2", category: TraumaCategory.Abuse }),
    ];
    const { container } = renderNode(makePerson(), { events });

    const badges = container.querySelectorAll(".person-node__badge");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveStyle({
      backgroundColor: TRAUMA_COLORS[TraumaCategory.Loss],
    });
    expect(badges[1]).toHaveStyle({
      backgroundColor: TRAUMA_COLORS[TraumaCategory.Abuse],
    });
  });

  it("renders no badges when events array is empty", () => {
    const { container } = renderNode(makePerson());
    expect(container.querySelectorAll(".person-node__badge")).toHaveLength(0);
  });

  it("shows precise age when birthday has not yet passed this year", () => {
    // System time: Jan 1, 2026. Born July 8, 1960.
    // Birthday not yet passed => age = 66 - 1 = 65
    renderNode(makePerson({ birth_year: 1960, birth_month: 7, birth_day: 8 }));
    expect(screen.getByText("1960 - (65)")).toBeInTheDocument();
  });

  it("shows precise age when birthday falls on current date", () => {
    // System time: Jan 1, 2026. Born Jan 1, 1960.
    // Exact birthday => no subtraction => age = 66
    renderNode(makePerson({ birth_year: 1960, birth_month: 1, birth_day: 1 }));
    expect(screen.getByText("1960 - (66)")).toBeInTheDocument();
  });

  it("applies selected class when selected", () => {
    const { container } = renderNode(makePerson(), { selected: true });
    expect(container.querySelector(".person-node--selected")).toBeInTheDocument();
  });

  it("applies friend-only class when isFriendOnly", () => {
    const { container } = renderNode(makePerson(), { isFriendOnly: true });
    expect(container.querySelector(".person-node--friend-only")).toBeInTheDocument();
  });

  it("renders life event badges with square shape class", () => {
    const lifeEvents = [
      makeLifeEvent({ id: "le1", category: LifeEventCategory.Family }),
      makeLifeEvent({ id: "le2", category: LifeEventCategory.Career }),
    ];
    const { container } = renderNode(makePerson(), { lifeEvents });

    const badges = container.querySelectorAll(".person-node__badge--life");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveStyle({
      backgroundColor: LIFE_EVENT_COLORS[LifeEventCategory.Family],
    });
    expect(badges[1]).toHaveStyle({
      backgroundColor: LIFE_EVENT_COLORS[LifeEventCategory.Career],
    });
  });

  it("renders classification badges with triangle shape class", () => {
    const classifications = [
      makeClassification({ id: "c1", status: "diagnosed" }),
      makeClassification({ id: "c2", status: "suspected" }),
    ];
    const { container } = renderNode(makePerson(), { classifications });

    const badges = container.querySelectorAll(".person-node__badge--classification");
    expect(badges).toHaveLength(2);
  });

  it("renders classification with subcategory in tooltip", () => {
    const classifications = [
      makeClassification({
        dsm_category: "neurodevelopmental",
        dsm_subcategory: "adhd",
      }),
    ];
    renderNode(makePerson(), { classifications });
    expect(screen.getByText(/dsm\.neurodevelopmental/)).toBeInTheDocument();
    expect(screen.getByText(/dsm\.sub\.adhd/)).toBeInTheDocument();
  });

  it("renders classification without subcategory", () => {
    const classifications = [
      makeClassification({
        dsm_category: "anxiety",
        dsm_subcategory: null,
      }),
    ];
    renderNode(makePerson(), { classifications });
    expect(screen.getByText("dsm.anxiety")).toBeInTheDocument();
    expect(screen.queryByText(/dsm\.sub\./)).not.toBeInTheDocument();
  });

  it("renders classification diagnosis year when present", () => {
    const classifications = [makeClassification({ diagnosis_year: 2020 })];
    renderNode(makePerson(), { classifications });
    expect(screen.getByText("2020")).toBeInTheDocument();
  });

  it("omits classification diagnosis year when null", () => {
    const classifications = [makeClassification({ diagnosis_year: null })];
    renderNode(makePerson(), { classifications });
    expect(screen.getByText("classification.status.diagnosed")).toBeInTheDocument();
  });

  it("renders life event tooltip with impact", () => {
    const lifeEvents = [makeLifeEvent({ title: "Moved", approximate_date: "2000", impact: 7 })];
    renderNode(makePerson(), { lifeEvents });
    expect(screen.getByText("Moved")).toBeInTheDocument();
    expect(screen.getByText("2000")).toBeInTheDocument();
    expect(screen.getByText(/lifeEvent\.impact.*7\/10/)).toBeInTheDocument();
  });

  it("renders trauma event tooltip with severity", () => {
    const events = [makeEvent({ title: "Loss event", approximate_date: "1985", severity: 5 })];
    renderNode(makePerson(), { events });
    expect(screen.getByText("Loss event")).toBeInTheDocument();
    expect(screen.getByText("1985")).toBeInTheDocument();
    expect(screen.getByText(/trauma\.severity.*5\/10/)).toBeInTheDocument();
  });

  it("hides trauma tooltip meta when no date and no severity", () => {
    const events = [
      makeEvent({
        title: "No meta",
        approximate_date: "",
        severity: 0,
      }),
    ];
    const { container } = renderNode(makePerson(), { events });
    expect(screen.getByText("No meta")).toBeInTheDocument();
    expect(container.querySelector(".person-node__tooltip-meta")).not.toBeInTheDocument();
  });

  it("hides life event tooltip meta when no date and no impact", () => {
    const lifeEvents = [
      makeLifeEvent({
        title: "No meta life",
        approximate_date: "",
        impact: 0,
      }),
    ];
    const { container } = renderNode(makePerson(), { lifeEvents });
    expect(screen.getByText("No meta life")).toBeInTheDocument();
    expect(container.querySelector(".person-node__tooltip-meta")).not.toBeInTheDocument();
  });

  it("shows overflow indicator when total badges exceed limit", () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent({ id: `e${i}`, category: TraumaCategory.Loss }),
    );
    const lifeEvents = Array.from({ length: 3 }, (_, i) =>
      makeLifeEvent({ id: `le${i}`, category: LifeEventCategory.Family }),
    );
    const { container } = renderNode(makePerson(), { events, lifeEvents });

    const overflow = container.querySelector(".person-node__badge-overflow");
    expect(overflow).toBeInTheDocument();
    expect(overflow?.textContent).toBe("+1");
  });

  it("does not show overflow when badges fit within limit", () => {
    const events = Array.from({ length: 4 }, (_, i) =>
      makeEvent({ id: `e${i}`, category: TraumaCategory.Loss }),
    );
    const { container } = renderNode(makePerson(), { events });

    expect(container.querySelector(".person-node__badge-overflow")).not.toBeInTheDocument();
  });

  it("limits life event badges based on remaining slots after trauma events", () => {
    const events = Array.from({ length: 7 }, (_, i) =>
      makeEvent({ id: `e${i}`, category: TraumaCategory.Loss }),
    );
    const lifeEvents = Array.from({ length: 3 }, (_, i) =>
      makeLifeEvent({ id: `le${i}`, category: LifeEventCategory.Family }),
    );
    const { container } = renderNode(makePerson(), { events, lifeEvents });

    // 7 trauma badges + 1 life event badge (8 - 7 = 1 slot) + overflow
    const traumaBadges = container.querySelectorAll(
      ".person-node__badge:not(.person-node__badge--life):not(.person-node__badge--classification)",
    );
    const lifeBadges = container.querySelectorAll(".person-node__badge--life");
    expect(traumaBadges).toHaveLength(7);
    expect(lifeBadges).toHaveLength(1);
  });
});
