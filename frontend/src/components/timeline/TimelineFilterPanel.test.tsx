import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimelineFilterActions, TimelineFilterState } from "../../hooks/useTimelineFilters";
import type { DecryptedPattern, DecryptedPerson } from "../../hooks/useTreeData";
import { TimelineFilterPanel } from "./TimelineFilterPanel";

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
    gender: "other",
    is_adopted: false,
    notes: null,
  };
}

vi.mock("../../lib/patternColors", () => ({
  getPatternColor: (hex: string) => hex,
  PATTERN_COLORS: ["#818cf8", "#f472b6"],
}));

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

const defaultFilters: TimelineFilterState = {
  visiblePersonIds: null,
  traumaCategories: null,
  lifeEventCategories: null,
  classificationCategories: null,
  classificationStatus: null,
  timeRange: null,
  visiblePatterns: null,
};

const persons = new Map<string, DecryptedPerson>([
  ["p1", makePerson("p1", "Alice")],
  ["p2", makePerson("p2", "Bob")],
]);

const timeDomain = { minYear: 1950, maxYear: 2025 };

describe("TimelineFilterPanel", () => {
  it("renders header with filters title", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("timeline.filters")).toBeTruthy();
  });

  it("shows reset button when filters are active", () => {
    const actions = makeActions({ activeFilterCount: 2 });
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("timeline.resetFilters")).toBeTruthy();
  });

  it("does not show reset button when no filters active", () => {
    const actions = makeActions({ activeFilterCount: 0 });
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText("timeline.resetFilters")).toBeNull();
  });

  it("calls resetAll when reset button clicked", () => {
    const actions = makeActions({ activeFilterCount: 1 });
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("timeline.resetFilters"));
    expect(actions.resetAll).toHaveBeenCalled();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText("common.close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders person checkboxes in people section (open by default)", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("calls togglePerson when person checkbox changes", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    // First two checkboxes are person checkboxes
    fireEvent.click(checkboxes[0]);
    expect(actions.togglePerson).toHaveBeenCalledWith("p1");
  });

  it("calls toggleAllPersons when select all/deselect all clicked", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    // All visible -> shows "Deselect all"
    fireEvent.click(screen.getByText("timeline.deselectAll"));
    expect(actions.toggleAllPersons).toHaveBeenCalledWith(false);
  });

  it("shows trauma categories after expanding section", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    // Trauma section is collapsed by default
    expect(screen.queryByText("trauma.category.loss")).toBeNull();
    // Click to expand
    fireEvent.click(screen.getByText(/timeline.filterTrauma/));
    expect(screen.getByText("trauma.category.loss")).toBeTruthy();
  });

  it("calls toggleTraumaCategory when trauma checkbox changes", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    // Expand trauma section
    fireEvent.click(screen.getByText(/timeline.filterTrauma/));
    // Find and click a trauma category checkbox
    const checkbox = screen
      .getByText("trauma.category.loss")
      .parentElement!.querySelector("input")!;
    fireEvent.click(checkbox);
    expect(actions.toggleTraumaCategory).toHaveBeenCalledWith("loss");
  });

  it("shows life event categories after expanding section", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterLifeEvents/));
    expect(screen.getByText("lifeEvent.category.career")).toBeTruthy();
  });

  it("calls toggleLifeEventCategory when life event checkbox changes", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterLifeEvents/));
    const checkbox = screen
      .getByText("lifeEvent.category.career")
      .parentElement!.querySelector("input")!;
    fireEvent.click(checkbox);
    expect(actions.toggleLifeEventCategory).toHaveBeenCalledWith("career");
  });

  it("shows classifications after expanding section", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterClassifications/));
    expect(screen.getByText("classification.status.suspected")).toBeTruthy();
    expect(screen.getByText("classification.status.diagnosed")).toBeTruthy();
  });

  it("calls toggleClassificationStatus when status checkbox changes", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterClassifications/));
    const checkbox = screen
      .getByText("classification.status.diagnosed")
      .parentElement!.querySelector("input")!;
    fireEvent.click(checkbox);
    expect(actions.toggleClassificationStatus).toHaveBeenCalledWith("diagnosed");
  });

  it("calls toggleClassificationCategory when DSM category checkbox changes", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterClassifications/));
    const checkbox = screen.getByText("dsm.depressive").parentElement!.querySelector("input")!;
    fireEvent.click(checkbox);
    expect(actions.toggleClassificationCategory).toHaveBeenCalledWith("depressive");
  });

  it("shows time range inputs after expanding section", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterTimeRange/));
    expect(screen.getByText("timeline.minYear")).toBeTruthy();
    expect(screen.getByText("timeline.maxYear")).toBeTruthy();
  });

  it("calls setTimeRange when min year changes", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterTimeRange/));
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "1970" } });
    expect(actions.setTimeRange).toHaveBeenCalledWith({ min: 1970, max: 2025 });
  });

  it("calls setTimeRange when max year changes", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterTimeRange/));
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[1], { target: { value: "2010" } });
    expect(actions.setTimeRange).toHaveBeenCalledWith({ min: 1950, max: 2010 });
  });

  it("resets time range when non-numeric value entered", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterTimeRange/));
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "" } });
    expect(actions.setTimeRange).toHaveBeenCalledWith(null);
  });

  it("shows patterns section when patterns provided", () => {
    const actions = makeActions();
    const patterns = new Map([
      ["pat1", makePattern("pat1", "Grief Cycle")],
      ["pat2", makePattern("pat2", "Displacement")],
    ]);
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        patterns={patterns}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterPatterns/));
    expect(screen.getByText("Grief Cycle")).toBeTruthy();
    expect(screen.getByText("Displacement")).toBeTruthy();
  });

  it("does not show patterns section when no patterns", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/timeline.filterPatterns/)).toBeNull();
  });

  it("calls togglePatternFilter when pattern checkbox changes", () => {
    const actions = makeActions();
    const patterns = new Map([["pat1", makePattern("pat1", "Grief Cycle")]]);
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        patterns={patterns}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterPatterns/));
    const checkbox = screen.getByText("Grief Cycle").parentElement!.querySelector("input")!;
    fireEvent.click(checkbox);
    expect(actions.togglePatternFilter).toHaveBeenCalledWith("pat1");
  });
});
