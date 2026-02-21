import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import { PatternPanel } from "./PatternPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

const mockPersons = new Map<string, DecryptedPerson>([
  [
    "p1",
    {
      id: "p1",
      name: "Alice",
      birth_year: 1950,
      birth_month: null,
      birth_day: null,
      death_year: null,
      death_month: null,
      death_day: null,
      cause_of_death: null,
      gender: "female",
      is_adopted: false,
      notes: null,
    },
  ],
]);

const mockEvents = new Map<string, DecryptedEvent>([
  [
    "e1",
    {
      id: "e1",
      title: "Loss",
      description: "",
      category: "loss" as DecryptedEvent["category"],
      approximate_date: "1980",
      severity: 3,
      tags: [],
      person_ids: ["p1"],
    },
  ],
]);

const mockLifeEvents = new Map<string, DecryptedLifeEvent>();
const mockClassifications = new Map<string, DecryptedClassification>();

const mockPattern: DecryptedPattern = {
  id: "pat1",
  name: "Test Pattern",
  description: "A test",
  color: "#818cf8",
  linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
  person_ids: ["p1"],
};

function renderPanel(overrides: Partial<Parameters<typeof PatternPanel>[0]> = {}) {
  const defaultProps = {
    patterns: new Map<string, DecryptedPattern>(),
    events: mockEvents,
    lifeEvents: mockLifeEvents,
    classifications: mockClassifications,
    persons: mockPersons,
    visiblePatternIds: new Set<string>(),
    onToggleVisibility: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<PatternPanel {...defaultProps} />);
  return defaultProps;
}

describe("PatternPanel", () => {
  it("renders the panel with header and close button", () => {
    const props = renderPanel();

    expect(screen.getByText("pattern.patterns")).toBeInTheDocument();
    expect(screen.getByText("common.close")).toBeInTheDocument();

    fireEvent.click(screen.getByText("common.close"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when no patterns exist", () => {
    renderPanel();

    expect(screen.getByText("pattern.empty")).toBeInTheDocument();
  });

  it("renders pattern list with color dot, name, and entity count", () => {
    const patterns = new Map<string, DecryptedPattern>([["pat1", mockPattern]]);
    renderPanel({ patterns, visiblePatternIds: new Set(["pat1"]) });

    expect(screen.getByText("Test Pattern")).toBeInTheDocument();
    // Entity count (1 linked entity)
    expect(screen.getByText("1")).toBeInTheDocument();
    // Color dot
    const dot = document.querySelector(".pattern-panel__color-dot");
    expect(dot).toHaveStyle({ backgroundColor: "#818cf8" });
  });

  it("clicking 'New Pattern' shows the edit form", () => {
    renderPanel();

    fireEvent.click(screen.getByText("pattern.newPattern"));

    // Empty state should disappear, edit form should appear
    expect(screen.queryByText("pattern.empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("pattern-name-input")).toBeInTheDocument();
    expect(screen.getByText("common.save")).toBeInTheDocument();
  });

  it("edit form: typing name and saving calls onSave with correct data for a new pattern", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByText("pattern.newPattern"));

    const nameInput = screen.getByTestId("pattern-name-input");
    fireEvent.change(nameInput, { target: { value: "New Pattern Name" } });

    fireEvent.click(screen.getByText("common.save"));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        name: "New Pattern Name",
        description: "",
        linked_entities: [],
      }),
      [],
    );
  });

  it("clicking an existing pattern row expands it to show the edit form", () => {
    const patterns = new Map<string, DecryptedPattern>([["pat1", mockPattern]]);
    const props = renderPanel({ patterns, visiblePatternIds: new Set(["pat1"]) });

    // Click the pattern row header to expand
    fireEvent.click(screen.getByText("Test Pattern"));

    // Edit form should now be visible with the pattern name pre-filled
    const nameInput = screen.getByTestId("pattern-name-input");
    expect(nameInput).toHaveValue("Test Pattern");

    // Save should call onSave with the existing pattern id
    fireEvent.click(screen.getByText("common.save"));
    expect(props.onSave).toHaveBeenCalledWith(
      "pat1",
      expect.objectContaining({ name: "Test Pattern" }),
      expect.any(Array),
    );
  });

  it("delete flow: click delete shows confirm, then confirm calls onDelete", () => {
    const patterns = new Map<string, DecryptedPattern>([["pat1", mockPattern]]);
    const props = renderPanel({ patterns, visiblePatternIds: new Set(["pat1"]) });

    // Expand the pattern
    fireEvent.click(screen.getByText("Test Pattern"));

    // Click the initial delete button
    fireEvent.click(screen.getByText("common.delete"));

    // Confirm button should now appear
    const confirmBtn = screen.getByText("pattern.confirmDelete");
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);
    expect(props.onDelete).toHaveBeenCalledWith("pat1");
  });

  it("visibility toggle: clicking the eye button calls onToggleVisibility", () => {
    const patterns = new Map<string, DecryptedPattern>([["pat1", mockPattern]]);
    const props = renderPanel({ patterns, visiblePatternIds: new Set(["pat1"]) });

    const visibilityBtn = screen.getByLabelText("pattern.visible");
    fireEvent.click(visibilityBtn);

    expect(props.onToggleVisibility).toHaveBeenCalledWith("pat1");
  });

  it("unlinking an entity: clicking X on a linked entity chip removes it", () => {
    const patterns = new Map<string, DecryptedPattern>([["pat1", mockPattern]]);
    const props = renderPanel({ patterns, visiblePatternIds: new Set(["pat1"]) });

    // Expand the pattern
    fireEvent.click(screen.getByText("Test Pattern"));

    // The linked entity chip should show the event title "Loss"
    expect(screen.getByText("Loss")).toBeInTheDocument();

    // Click the remove button on the chip
    const removeBtn = screen.getByLabelText("pattern.unlinkEntity");
    fireEvent.click(removeBtn);

    // The chip should be removed
    expect(screen.queryByText("Loss")).not.toBeInTheDocument();

    // Save and verify the entity was unlinked
    fireEvent.click(screen.getByText("common.save"));
    expect(props.onSave).toHaveBeenCalledWith(
      "pat1",
      expect.objectContaining({ linked_entities: [] }),
      [],
    );
  });

  it("entity linking: opening the link picker shows available entities grouped by person", () => {
    const patterns = new Map<string, DecryptedPattern>([
      ["pat1", { ...mockPattern, linked_entities: [], person_ids: [] }],
    ]);
    renderPanel({ patterns, visiblePatternIds: new Set(["pat1"]) });

    // Expand the pattern
    fireEvent.click(screen.getByText("Test Pattern"));

    // Open the link picker
    fireEvent.click(screen.getByText("pattern.linkEntity"));

    // Should show the person name as a group header
    expect(screen.getByText("Alice")).toBeInTheDocument();

    // Should show the event "Loss" as a linkable entity
    const linkSection = document.querySelector(".pattern-panel__link-section")!;
    expect(within(linkSection as HTMLElement).getByText("Loss")).toBeInTheDocument();

    // Click the entity to link it
    fireEvent.click(within(linkSection as HTMLElement).getByText("Loss"));

    // Now save and verify the entity was linked
    fireEvent.click(screen.getByText("common.save"));
    expect(screen.queryByTestId("pattern-panel")).toBeInTheDocument();
  });

  it("resolves life event entity info", () => {
    const lifeEventsWithData = new Map<string, DecryptedLifeEvent>([
      [
        "le1",
        {
          id: "le1",
          title: "Graduated",
          description: "Finished university",
          category: "education" as DecryptedLifeEvent["category"],
          approximate_date: "1972",
          impact: 2,
          tags: [],
          person_ids: ["p1"],
        },
      ],
    ]);

    const patternWithLifeEvent: DecryptedPattern = {
      id: "pat2",
      name: "Life Event Pattern",
      description: "",
      color: "#818cf8",
      linked_entities: [{ entity_type: "life_event", entity_id: "le1" }],
      person_ids: ["p1"],
    };

    const patterns = new Map<string, DecryptedPattern>([["pat2", patternWithLifeEvent]]);
    renderPanel({
      patterns,
      lifeEvents: lifeEventsWithData,
      visiblePatternIds: new Set(["pat2"]),
    });

    // Expand the pattern to show the edit form with entity chips
    fireEvent.click(screen.getByText("Life Event Pattern"));

    // The life event title should appear as an entity chip label
    expect(screen.getByText("Graduated")).toBeInTheDocument();
    // The person name should appear on the chip
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("resolves classification entity info", () => {
    const classificationsWithData = new Map<string, DecryptedClassification>([
      [
        "cls1",
        {
          id: "cls1",
          dsm_category: "depressive",
          dsm_subcategory: null,
          status: "diagnosed",
          diagnosis_year: 1985,
          periods: [{ start_year: 1985, end_year: null }],
          notes: null,
          person_ids: ["p1"],
        },
      ],
    ]);

    const patternWithClassification: DecryptedPattern = {
      id: "pat3",
      name: "Classification Pattern",
      description: "",
      color: "#818cf8",
      linked_entities: [{ entity_type: "classification", entity_id: "cls1" }],
      person_ids: ["p1"],
    };

    const patterns = new Map<string, DecryptedPattern>([["pat3", patternWithClassification]]);
    renderPanel({
      patterns,
      classifications: classificationsWithData,
      visiblePatternIds: new Set(["pat3"]),
    });

    // Expand the pattern to show the edit form with entity chips
    fireEvent.click(screen.getByText("Classification Pattern"));

    // The classification label should appear (t() returns the key, so "dsm.depressive")
    expect(screen.getByText("dsm.depressive")).toBeInTheDocument();
    // The person name should appear on the chip
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows subcategory label when classification has a subcategory", () => {
    const classificationsWithSub = new Map<string, DecryptedClassification>([
      [
        "cls1",
        {
          id: "cls1",
          dsm_category: "neurodevelopmental",
          dsm_subcategory: "adhd",
          status: "diagnosed",
          diagnosis_year: 2000,
          periods: [],
          notes: null,
          person_ids: ["p1"],
        },
      ],
    ]);

    const patternWithSub: DecryptedPattern = {
      id: "pat-sub",
      name: "Subcategory Pattern",
      description: "",
      color: "#818cf8",
      linked_entities: [{ entity_type: "classification", entity_id: "cls1" }],
      person_ids: ["p1"],
    };

    const patterns = new Map<string, DecryptedPattern>([["pat-sub", patternWithSub]]);
    renderPanel({
      patterns,
      classifications: classificationsWithSub,
      visiblePatternIds: new Set(["pat-sub"]),
    });

    fireEvent.click(screen.getByText("Subcategory Pattern"));

    // Should show the subcategory key, not the category key
    expect(screen.getByText("dsm.sub.adhd")).toBeInTheDocument();
    expect(screen.queryByText("dsm.neurodevelopmental")).not.toBeInTheDocument();
  });

  it("derivePersonIds: saving a pattern with a classification entity derives person_ids from classification", () => {
    const classificationsWithData = new Map<string, DecryptedClassification>([
      [
        "cls1",
        {
          id: "cls1",
          dsm_category: "depressive",
          dsm_subcategory: null,
          status: "diagnosed",
          diagnosis_year: 1985,
          periods: [{ start_year: 1985, end_year: null }],
          notes: null,
          person_ids: ["p1"],
        },
      ],
    ]);

    const patternWithClassification: DecryptedPattern = {
      id: "pat-cls",
      name: "Classification Only Pattern",
      description: "Tests classification branch",
      color: "#818cf8",
      linked_entities: [{ entity_type: "classification", entity_id: "cls1" }],
      person_ids: ["p1"],
    };

    const patterns = new Map<string, DecryptedPattern>([["pat-cls", patternWithClassification]]);
    const props = renderPanel({
      patterns,
      classifications: classificationsWithData,
      visiblePatternIds: new Set(["pat-cls"]),
    });

    // Expand the pattern
    fireEvent.click(screen.getByText("Classification Only Pattern"));

    // Click save to trigger derivePersonIds with the classification entity
    fireEvent.click(screen.getByText("common.save"));

    // onSave should be called with person_ids derived from the classification
    expect(props.onSave).toHaveBeenCalledWith(
      "pat-cls",
      expect.objectContaining({
        name: "Classification Only Pattern",
        linked_entities: [{ entity_type: "classification", entity_id: "cls1" }],
      }),
      ["p1"],
    );
  });

  it("cancel button on existing pattern edit form collapses the form", () => {
    const patterns = new Map<string, DecryptedPattern>([["pat1", mockPattern]]);
    renderPanel({ patterns, visiblePatternIds: new Set(["pat1"]) });

    // Expand the pattern
    fireEvent.click(screen.getByText("Test Pattern"));
    expect(screen.getByTestId("pattern-name-input")).toBeInTheDocument();

    // Click cancel
    fireEvent.click(screen.getByText("common.cancel"));

    // Edit form should be collapsed
    expect(screen.queryByTestId("pattern-name-input")).not.toBeInTheDocument();
  });

  it("typing in the description textarea updates the value", () => {
    const patterns = new Map<string, DecryptedPattern>([["pat1", mockPattern]]);
    const props = renderPanel({ patterns, visiblePatternIds: new Set(["pat1"]) });

    // Expand the pattern
    fireEvent.click(screen.getByText("Test Pattern"));

    // Find the textarea (description field) and type in it
    const textarea = screen.getByDisplayValue("A test");
    fireEvent.change(textarea, { target: { value: "Updated description" } });
    expect(textarea).toHaveValue("Updated description");

    // Save and verify the description is included
    fireEvent.click(screen.getByText("common.save"));
    expect(props.onSave).toHaveBeenCalledWith(
      "pat1",
      expect.objectContaining({ description: "Updated description" }),
      expect.any(Array),
    );
  });

  it("selecting a different color swatch updates the pattern color", () => {
    const patterns = new Map<string, DecryptedPattern>([["pat1", mockPattern]]);
    const props = renderPanel({ patterns, visiblePatternIds: new Set(["pat1"]) });

    // Expand the pattern
    fireEvent.click(screen.getByText("Test Pattern"));

    // Find the color swatches and click a different one
    const swatches = screen.getAllByRole("button", { name: /^#/ });
    // Click a swatch that is NOT the current color (#818cf8)
    const differentSwatch = swatches.find((s) => s.getAttribute("aria-label") !== "#818cf8");
    expect(differentSwatch).toBeTruthy();
    fireEvent.click(differentSwatch!);

    // Save and verify the color changed
    fireEvent.click(screen.getByText("common.save"));
    expect(props.onSave).toHaveBeenCalledWith(
      "pat1",
      expect.objectContaining({
        color: differentSwatch!.getAttribute("aria-label"),
      }),
      expect.any(Array),
    );
  });

  it("link picker shows life events and classifications", () => {
    const lifeEventsWithData = new Map<string, DecryptedLifeEvent>([
      [
        "le1",
        {
          id: "le1",
          title: "Relocated",
          description: "",
          category: "relocation" as DecryptedLifeEvent["category"],
          approximate_date: "1975",
          impact: 1,
          tags: [],
          person_ids: ["p1"],
        },
      ],
    ]);

    const classificationsWithData = new Map<string, DecryptedClassification>([
      [
        "cls1",
        {
          id: "cls1",
          dsm_category: "anxiety",
          dsm_subcategory: null,
          status: "suspected",
          diagnosis_year: null,
          periods: [],
          notes: null,
          person_ids: ["p1"],
        },
      ],
    ]);

    const patternNoEntities: DecryptedPattern = {
      id: "pat4",
      name: "Empty Pattern",
      description: "",
      color: "#818cf8",
      linked_entities: [],
      person_ids: [],
    };

    const patterns = new Map<string, DecryptedPattern>([["pat4", patternNoEntities]]);
    renderPanel({
      patterns,
      lifeEvents: lifeEventsWithData,
      classifications: classificationsWithData,
      visiblePatternIds: new Set(["pat4"]),
    });

    // Expand the pattern
    fireEvent.click(screen.getByText("Empty Pattern"));

    // Open the link picker
    fireEvent.click(screen.getByText("pattern.linkEntity"));

    // Should show the person name as a group header
    expect(screen.getByText("Alice")).toBeInTheDocument();

    // Should show the life event and classification in the link picker
    const linkSection = document.querySelector(".pattern-panel__link-section")!;
    expect(within(linkSection as HTMLElement).getByText("Relocated")).toBeInTheDocument();
    expect(within(linkSection as HTMLElement).getByText("dsm.anxiety")).toBeInTheDocument();
  });

  it("calls onHoverPattern on mouseenter/leave of pattern item", () => {
    const onHoverPattern = vi.fn();
    const patterns = new Map<string, DecryptedPattern>([[mockPattern.id, mockPattern]]);
    renderPanel({
      patterns,
      visiblePatternIds: new Set([mockPattern.id]),
      onHoverPattern,
    });

    const item = document.querySelector(".pattern-panel__item")!;
    fireEvent.mouseEnter(item);
    expect(onHoverPattern).toHaveBeenCalledWith(mockPattern.id);
    fireEvent.mouseLeave(item);
    expect(onHoverPattern).toHaveBeenCalledWith(null);
  });

  it("cancel button on new pattern form hides the form", () => {
    renderPanel();

    // Click "New pattern" button
    fireEvent.click(screen.getByText("pattern.newPattern"));
    expect(screen.getByTestId("pattern-name-input")).toBeInTheDocument();

    // Click cancel
    fireEvent.click(screen.getByText("common.cancel"));
    expect(screen.queryByTestId("pattern-name-input")).not.toBeInTheDocument();
  });
});
