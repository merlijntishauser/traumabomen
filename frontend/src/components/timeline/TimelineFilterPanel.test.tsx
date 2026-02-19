import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimelineFilterActions, TimelineFilterState } from "../../hooks/useTimelineFilters";
import type { DecryptedPattern, DecryptedPerson } from "../../hooks/useTreeData";
import type { SmartFilterGroups } from "../../lib/smartFilterGroups";
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
    togglePersonGroup: vi.fn(),
    toggleTraumaCategory: vi.fn(),
    toggleLifeEventCategory: vi.fn(),
    toggleClassificationCategory: vi.fn(),
    toggleClassificationSubcategory: vi.fn(),
    toggleClassificationStatus: vi.fn(),
    setTimeRange: vi.fn(),
    togglePatternFilter: vi.fn(),
    setFilterMode: vi.fn(),
    applyQuickFilter: vi.fn(),
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
  classificationSubcategories: null,
  classificationStatus: null,
  timeRange: null,
  visiblePatterns: null,
  filterMode: "dim",
};

const persons = new Map<string, DecryptedPerson>([
  ["p1", makePerson("p1", "Alice")],
  ["p2", makePerson("p2", "Bob")],
]);

const timeDomain = { minYear: 1950, maxYear: 2025 };

const sampleUsedClassifications = new Map<string, Set<string>>([
  ["depressive", new Set(["major_depression"])],
  ["anxiety", new Set()],
]);

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

  it("hides individual person checkboxes by default", () => {
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
    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.queryByText("Bob")).toBeNull();
    expect(screen.getByText(/timeline\.individualPersons/)).toBeTruthy();
  });

  it("renders person checkboxes after expanding individual persons", () => {
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
    fireEvent.click(screen.getByText(/timeline\.individualPersons/));
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
    fireEvent.click(screen.getByText(/timeline\.individualPersons/));
    const checkboxes = screen.getAllByRole("checkbox");
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
    fireEvent.click(screen.getByText(/timeline\.individualPersons/));
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
        usedClassifications={sampleUsedClassifications}
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
        usedClassifications={sampleUsedClassifications}
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
        usedClassifications={sampleUsedClassifications}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterClassifications/));
    const checkbox = screen.getByText("dsm.depressive").parentElement!.querySelector("input")!;
    fireEvent.click(checkbox);
    expect(actions.toggleClassificationCategory).toHaveBeenCalledWith("depressive");
  });

  it("only shows used DSM categories", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        usedClassifications={sampleUsedClassifications}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterClassifications/));
    expect(screen.getByText("dsm.depressive")).toBeTruthy();
    expect(screen.getByText("dsm.anxiety")).toBeTruthy();
    expect(screen.queryByText("dsm.personality")).toBeNull();
  });

  it("shows subcategory checkboxes for used classifications", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        usedClassifications={sampleUsedClassifications}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/timeline.filterClassifications/));
    const subLabel = screen.getByText("dsm.sub.major_depression");
    expect(subLabel).toBeTruthy();
    const checkbox = subLabel.parentElement!.querySelector("input")!;
    fireEvent.click(checkbox);
    expect(actions.toggleClassificationSubcategory).toHaveBeenCalledWith("major_depression");
  });

  it("hides classification section when no classifications used", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        usedClassifications={new Map()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/timeline.filterClassifications/)).toBeNull();
  });

  it("hides trauma section when no trauma events used", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        usedTraumaCategories={new Set()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/timeline.filterTrauma/)).toBeNull();
  });

  it("hides life events section when no life events used", () => {
    const actions = makeActions();
    render(
      <TimelineFilterPanel
        persons={persons}
        filters={defaultFilters}
        actions={actions}
        timeDomain={timeDomain}
        usedLifeEventCategories={new Set()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/timeline.filterLifeEvents/)).toBeNull();
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

  describe("smart filter groups", () => {
    const sampleGroups: SmartFilterGroups = {
      demographic: [
        { key: "gender:female", labelKey: "timeline.group.women", personIds: new Set(["p1"]) },
        { key: "gender:male", labelKey: "timeline.group.men", personIds: new Set(["p2"]) },
      ],
      roles: [
        {
          key: "role:parents",
          labelKey: "timeline.group.parents",
          personIds: new Set(["p1"]),
        },
      ],
      generations: [{ key: "gen:0", labelKey: "Gen 1", personIds: new Set(["p1", "p2"]) }],
    };

    it("renders group pills when groups are provided", () => {
      const actions = makeActions();
      render(
        <TimelineFilterPanel
          persons={persons}
          filters={defaultFilters}
          actions={actions}
          timeDomain={timeDomain}
          groups={sampleGroups}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("timeline.groupDemographic")).toBeTruthy();
      expect(screen.getByText("timeline.groupRoles")).toBeTruthy();
      expect(screen.getByText("timeline.groupGenerations")).toBeTruthy();
    });

    it("renders group pill labels with counts", () => {
      const actions = makeActions();
      render(
        <TimelineFilterPanel
          persons={persons}
          filters={defaultFilters}
          actions={actions}
          timeDomain={timeDomain}
          groups={sampleGroups}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("timeline.group.women (1)")).toBeTruthy();
      expect(screen.getByText("timeline.group.men (1)")).toBeTruthy();
      expect(screen.getByText("Gen 1 (2)")).toBeTruthy();
    });

    it("marks all group pills as active when no filter is set (null)", () => {
      const actions = makeActions();
      const { container } = render(
        <TimelineFilterPanel
          persons={persons}
          filters={defaultFilters}
          actions={actions}
          timeDomain={timeDomain}
          groups={sampleGroups}
          onClose={vi.fn()}
        />,
      );

      // Only count pills inside the groups section (not quick filter pills)
      const groupsSection = container.querySelector(".tl-filter-panel__groups")!;
      const activePills = groupsSection.querySelectorAll(".tl-filter-panel__pill--active");
      const allPills = groupsSection.querySelectorAll(".tl-filter-panel__pill");
      expect(activePills.length).toBe(allPills.length);
    });

    it("marks group pill as inactive when not all members visible", () => {
      const actions = makeActions();
      const filtersWithPerson: TimelineFilterState = {
        ...defaultFilters,
        visiblePersonIds: new Set(["p1"]),
      };
      render(
        <TimelineFilterPanel
          persons={persons}
          filters={filtersWithPerson}
          actions={actions}
          timeDomain={timeDomain}
          groups={sampleGroups}
          onClose={vi.fn()}
        />,
      );

      // "Men" group has p2 which is not visible
      const menPill = screen.getByText("timeline.group.men (1)");
      expect(menPill.classList.contains("tl-filter-panel__pill--active")).toBe(false);

      // "Women" group has p1 which is visible
      const womenPill = screen.getByText("timeline.group.women (1)");
      expect(womenPill.classList.contains("tl-filter-panel__pill--active")).toBe(true);
    });

    it("calls togglePersonGroup when pill is clicked", () => {
      const actions = makeActions();
      render(
        <TimelineFilterPanel
          persons={persons}
          filters={defaultFilters}
          actions={actions}
          timeDomain={timeDomain}
          groups={sampleGroups}
          onClose={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText("timeline.group.women (1)"));
      expect(actions.togglePersonGroup).toHaveBeenCalledWith(new Set(["p1"]));
    });

    it("does not render groups section when no groups provided", () => {
      const actions = makeActions();
      const { container } = render(
        <TimelineFilterPanel
          persons={persons}
          filters={defaultFilters}
          actions={actions}
          timeDomain={timeDomain}
          onClose={vi.fn()}
        />,
      );

      expect(container.querySelector(".tl-filter-panel__groups")).toBeNull();
    });

    it("omits empty group categories", () => {
      const actions = makeActions();
      const emptyRolesGroups: SmartFilterGroups = {
        demographic: [
          { key: "gender:female", labelKey: "timeline.group.women", personIds: new Set(["p1"]) },
        ],
        roles: [],
        generations: [],
      };
      render(
        <TimelineFilterPanel
          persons={persons}
          filters={defaultFilters}
          actions={actions}
          timeDomain={timeDomain}
          groups={emptyRolesGroups}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("timeline.groupDemographic")).toBeTruthy();
      expect(screen.queryByText("timeline.groupRoles")).toBeNull();
      expect(screen.queryByText("timeline.groupGenerations")).toBeNull();
    });
  });

  describe("quick filters", () => {
    it("renders three quick filter pills", () => {
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
      expect(screen.getByText("timeline.quickTrauma")).toBeTruthy();
      expect(screen.getByText("timeline.quickLifeEvents")).toBeTruthy();
      expect(screen.getByText("timeline.quickClassifications")).toBeTruthy();
    });

    it("calls applyQuickFilter with trauma when trauma pill clicked", () => {
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
      fireEvent.click(screen.getByText("timeline.quickTrauma"));
      expect(actions.applyQuickFilter).toHaveBeenCalledWith("trauma");
    });

    it("calls applyQuickFilter with lifeEvents when life events pill clicked", () => {
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
      fireEvent.click(screen.getByText("timeline.quickLifeEvents"));
      expect(actions.applyQuickFilter).toHaveBeenCalledWith("lifeEvents");
    });

    it("marks trauma pill as active when trauma-only filter is set", () => {
      const actions = makeActions();
      const filtersTraumaOnly: TimelineFilterState = {
        ...defaultFilters,
        traumaCategories: null,
        lifeEventCategories: new Set(),
        classificationCategories: new Set(),
      };
      render(
        <TimelineFilterPanel
          persons={persons}
          filters={filtersTraumaOnly}
          actions={actions}
          timeDomain={timeDomain}
          onClose={vi.fn()}
        />,
      );
      const traumaPill = screen.getByText("timeline.quickTrauma");
      expect(traumaPill.classList.contains("tl-filter-panel__pill--active")).toBe(true);
    });
  });

  describe("section count badges", () => {
    it("shows people badge when person filter is active", () => {
      const actions = makeActions();
      const filtersWithPerson: TimelineFilterState = {
        ...defaultFilters,
        visiblePersonIds: new Set(["p1"]),
      };
      render(
        <TimelineFilterPanel
          persons={persons}
          filters={filtersWithPerson}
          actions={actions}
          timeDomain={timeDomain}
          onClose={vi.fn()}
        />,
      );
      // The badge renders the translation key with params
      const badges = document.querySelectorAll(".tl-filter-panel__badge");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("does not show people badge when no person filter is active", () => {
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
      // People section header should not have a badge
      const peopleToggle = screen.getByText(/timeline.filterPeople/);
      const badge = peopleToggle.parentElement?.querySelector(".tl-filter-panel__badge");
      expect(badge).toBeNull();
    });

    it("shows time range badge when time filter is active", () => {
      const actions = makeActions();
      const filtersWithTime: TimelineFilterState = {
        ...defaultFilters,
        timeRange: { min: 1970, max: 2010 },
      };
      render(
        <TimelineFilterPanel
          persons={persons}
          filters={filtersWithTime}
          actions={actions}
          timeDomain={timeDomain}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText("1970 - 2010")).toBeTruthy();
    });
  });

  describe("dim/hide toggle", () => {
    it("renders dim/hide toggle button", () => {
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
      expect(screen.getByText("timeline.filterHide")).toBeTruthy();
    });

    it("shows dim text when filter mode is hide", () => {
      const actions = makeActions();
      const filtersHide: TimelineFilterState = {
        ...defaultFilters,
        filterMode: "hide",
      };
      render(
        <TimelineFilterPanel
          persons={persons}
          filters={filtersHide}
          actions={actions}
          timeDomain={timeDomain}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText("timeline.filterDim")).toBeTruthy();
    });

    it("calls setFilterMode when toggle clicked", () => {
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
      fireEvent.click(screen.getByText("timeline.filterHide"));
      expect(actions.setFilterMode).toHaveBeenCalledWith("hide");
    });

    it("calls setFilterMode(dim) when toggling from hide back to dim", () => {
      const actions = makeActions();
      const filtersHide: TimelineFilterState = {
        ...defaultFilters,
        filterMode: "hide",
      };
      render(
        <TimelineFilterPanel
          persons={persons}
          filters={filtersHide}
          actions={actions}
          timeDomain={timeDomain}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByText("timeline.filterDim"));
      expect(actions.setFilterMode).toHaveBeenCalledWith("dim");
    });
  });
});
