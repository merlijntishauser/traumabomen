import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimelineFilterActions, TimelineFilterState } from "../../hooks/useTimelineFilters";
import type { DecryptedPattern, DecryptedPerson } from "../../hooks/useTreeData";
import { LifeEventCategory, TraumaCategory } from "../../types/domain";
import { TimelineChipBar } from "./TimelineChipBar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function makePerson(id: string, name: string): DecryptedPerson {
  return {
    id,
    name,
    birth_year: 1980,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "other",
    is_adopted: false,
    notes: null,
  };
}

function makeActions(overrides: Partial<TimelineFilterActions> = {}): TimelineFilterActions {
  return {
    togglePerson: vi.fn(),
    toggleAllPersons: vi.fn(),
    toggleTraumaCategory: vi.fn(),
    toggleLifeEventCategory: vi.fn(),
    toggleClassificationCategory: vi.fn(),
    toggleClassificationStatus: vi.fn(),
    setTimeRange: vi.fn(),
    togglePatternFilter: vi.fn(),
    resetAll: vi.fn(),
    activeFilterCount: 0,
    ...overrides,
  };
}

function makePattern(id: string, name: string): DecryptedPattern {
  return {
    id,
    name,
    description: "",
    color: "#818cf8",
    linked_entities: [],
    person_ids: [],
  };
}

const persons = new Map<string, DecryptedPerson>([
  ["p1", makePerson("p1", "Alice")],
  ["p2", makePerson("p2", "Bob")],
  ["p3", makePerson("p3", "Carol")],
]);

const emptyFilters: TimelineFilterState = {
  visiblePersonIds: null,
  traumaCategories: null,
  lifeEventCategories: null,
  classificationCategories: null,
  classificationSubcategories: null,
  classificationStatus: null,
  timeRange: null,
  visiblePatterns: null,
};

describe("TimelineChipBar", () => {
  it("returns null when no filters active", () => {
    const actions = makeActions();
    const { container } = render(
      <TimelineChipBar filters={emptyFilters} actions={actions} persons={persons} />,
    );
    expect(container.querySelector(".tl-chip-bar")).toBeNull();
  });

  it("shows trauma category chips", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      traumaCategories: new Set([TraumaCategory.Loss, TraumaCategory.War]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    expect(screen.getByText("trauma.category.loss")).toBeTruthy();
    expect(screen.getByText("trauma.category.war")).toBeTruthy();
  });

  it("calls toggleTraumaCategory when trauma chip removed", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      traumaCategories: new Set([TraumaCategory.Loss]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    const removeBtn = screen.getByLabelText("Remove trauma.category.loss");
    fireEvent.click(removeBtn);
    expect(actions.toggleTraumaCategory).toHaveBeenCalledWith(TraumaCategory.Loss);
  });

  it("shows life event category chips", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      lifeEventCategories: new Set([LifeEventCategory.Career]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    expect(screen.getByText("lifeEvent.category.career")).toBeTruthy();
  });

  it("shows time range chip", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      timeRange: { min: 2000, max: 2020 },
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    expect(screen.getByText("2000 - 2020")).toBeTruthy();
  });

  it("calls setTimeRange(null) when time range chip removed", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      timeRange: { min: 2000, max: 2020 },
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    const removeBtn = screen.getByLabelText("Remove 2000 - 2020");
    fireEvent.click(removeBtn);
    expect(actions.setTimeRange).toHaveBeenCalledWith(null);
  });

  it("shows person chip with hidden name when few hidden", () => {
    const actions = makeActions();
    // p1 and p3 visible, p2 hidden
    const filters: TimelineFilterState = {
      ...emptyFilters,
      visiblePersonIds: new Set(["p1", "p3"]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    // Bob is hidden, should show as chip
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("calls togglePerson when individual person chip removed", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      visiblePersonIds: new Set(["p1", "p3"]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    const removeBtn = screen.getByLabelText("Remove Bob");
    fireEvent.click(removeBtn);
    expect(actions.togglePerson).toHaveBeenCalledWith("p2");
  });

  it("shows summary chip when many persons hidden", () => {
    const actions = makeActions();
    // Only p1 visible -> 2 hidden (Bob, Carol) -> but 2 <= 2, so individual chips
    // Let's add more persons to trigger summary
    const manyPersons = new Map<string, DecryptedPerson>([
      ["p1", makePerson("p1", "Alice")],
      ["p2", makePerson("p2", "Bob")],
      ["p3", makePerson("p3", "Carol")],
      ["p4", makePerson("p4", "Dave")],
    ]);
    const filters: TimelineFilterState = {
      ...emptyFilters,
      visiblePersonIds: new Set(["p1"]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={manyPersons} />);
    // 3 hidden -> summary chip
    expect(screen.getByText(/timeline.filterPeople: 1\/4/)).toBeTruthy();
  });

  it("calls toggleAllPersons(true) when summary person chip removed", () => {
    const actions = makeActions();
    const manyPersons = new Map<string, DecryptedPerson>([
      ["p1", makePerson("p1", "Alice")],
      ["p2", makePerson("p2", "Bob")],
      ["p3", makePerson("p3", "Carol")],
      ["p4", makePerson("p4", "Dave")],
    ]);
    const filters: TimelineFilterState = {
      ...emptyFilters,
      visiblePersonIds: new Set(["p1"]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={manyPersons} />);
    const removeBtn = screen.getByLabelText(/Remove timeline.filterPeople/);
    fireEvent.click(removeBtn);
    expect(actions.toggleAllPersons).toHaveBeenCalledWith(true);
  });

  it("calls toggleLifeEventCategory when life event chip removed", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      lifeEventCategories: new Set([LifeEventCategory.Career]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    fireEvent.click(screen.getByLabelText("Remove lifeEvent.category.career"));
    expect(actions.toggleLifeEventCategory).toHaveBeenCalledWith(LifeEventCategory.Career);
  });

  it("calls toggleClassificationStatus when status chip removed", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      classificationStatus: new Set<"suspected" | "diagnosed">(["diagnosed"]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    fireEvent.click(screen.getByLabelText("Remove classification.status.diagnosed"));
    expect(actions.toggleClassificationStatus).toHaveBeenCalledWith("diagnosed");
  });

  it("shows classification status chips", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      classificationStatus: new Set<"suspected" | "diagnosed">(["diagnosed"]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    expect(screen.getByText("classification.status.diagnosed")).toBeTruthy();
  });

  it("shows classification category chips", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      classificationCategories: new Set(["depressive"]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    expect(screen.getByText("dsm.depressive")).toBeTruthy();
  });

  it("calls toggleClassificationCategory when chip removed", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      classificationCategories: new Set(["depressive"]),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    fireEvent.click(screen.getByLabelText("Remove dsm.depressive"));
    expect(actions.toggleClassificationCategory).toHaveBeenCalledWith("depressive");
  });

  it("shows zero-count chip when no persons visible", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      visiblePersonIds: new Set<string>(),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    expect(screen.getByText(/timeline.filterPeople: 0\/3/)).toBeTruthy();
  });

  it("calls toggleAllPersons(true) when zero-count chip removed", () => {
    const actions = makeActions();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      visiblePersonIds: new Set<string>(),
    };
    render(<TimelineChipBar filters={filters} actions={actions} persons={persons} />);
    const removeBtn = screen.getByLabelText(/Remove timeline.filterPeople/);
    fireEvent.click(removeBtn);
    expect(actions.toggleAllPersons).toHaveBeenCalledWith(true);
  });

  it("shows pattern chips when visiblePatterns is set", () => {
    const actions = makeActions();
    const patterns = new Map([
      ["pat1", makePattern("pat1", "Grief Cycle")],
      ["pat2", makePattern("pat2", "Displacement")],
    ]);
    const filters: TimelineFilterState = {
      ...emptyFilters,
      visiblePatterns: new Set(["pat1", "pat2"]),
    };
    render(
      <TimelineChipBar filters={filters} actions={actions} persons={persons} patterns={patterns} />,
    );
    expect(screen.getByText("Grief Cycle")).toBeTruthy();
    expect(screen.getByText("Displacement")).toBeTruthy();
  });

  it("calls togglePatternFilter when pattern chip removed", () => {
    const actions = makeActions();
    const patterns = new Map([["pat1", makePattern("pat1", "Grief Cycle")]]);
    const filters: TimelineFilterState = {
      ...emptyFilters,
      visiblePatterns: new Set(["pat1"]),
    };
    render(
      <TimelineChipBar filters={filters} actions={actions} persons={persons} patterns={patterns} />,
    );
    fireEvent.click(screen.getByLabelText("Remove Grief Cycle"));
    expect(actions.togglePatternFilter).toHaveBeenCalledWith("pat1");
  });

  it("shows pattern id as fallback when pattern not found in map", () => {
    const actions = makeActions();
    const patterns = new Map<string, DecryptedPattern>();
    const filters: TimelineFilterState = {
      ...emptyFilters,
      visiblePatterns: new Set(["unknown-id"]),
    };
    render(
      <TimelineChipBar filters={filters} actions={actions} persons={persons} patterns={patterns} />,
    );
    expect(screen.getByText("unknown-id")).toBeTruthy();
  });
});
