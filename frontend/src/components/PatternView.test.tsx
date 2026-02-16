import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
} from "../hooks/useTreeData";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../lib/compactId", () => ({
  uuidToCompact: (id: string) => id,
}));

vi.mock("./PatternView.css", () => ({}));

// ---- Test data ----

const mockPersons = new Map<string, DecryptedPerson>([
  [
    "p1",
    {
      id: "p1",
      name: "Alice",
      birth_year: 1950,
      death_year: null,
      gender: "female",
      is_adopted: false,
      notes: null,
    },
  ],
  [
    "p2",
    {
      id: "p2",
      name: "Bob",
      birth_year: 1980,
      death_year: null,
      gender: "male",
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

function makePattern(overrides: Partial<DecryptedPattern> = {}): DecryptedPattern {
  return {
    id: "pat1",
    name: "Test Pattern",
    description: "A description",
    color: "#818cf8",
    linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
    person_ids: ["p1"],
    ...overrides,
  };
}

function defaultProps() {
  return {
    treeId: "tree-123",
    patterns: new Map<string, DecryptedPattern>(),
    events: mockEvents,
    lifeEvents: mockLifeEvents,
    classifications: mockClassifications,
    persons: mockPersons,
  };
}

// Import component after mocks are registered
const { PatternView } = await import("./PatternView");

// ---- Tests ----

describe("PatternView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows empty message with link to canvas when there are no patterns", () => {
    render(<PatternView {...defaultProps()} />);

    expect(screen.getByText("pattern.empty")).toBeTruthy();
    const link = screen.getByText("pattern.createFirst");
    expect(link).toBeTruthy();
    expect(link.closest("a")?.getAttribute("href")).toBe("/trees/tree-123");
  });

  it("renders pattern cards with name, color dot, and entity count", () => {
    const pattern = makePattern();
    const props = {
      ...defaultProps(),
      patterns: new Map([["pat1", pattern]]),
    };

    render(<PatternView {...props} />);

    const card = screen.getByTestId("pattern-card");
    expect(card).toBeTruthy();
    expect(screen.getByText("Test Pattern")).toBeTruthy();
    // Entity count badge shows the number of linked entities
    expect(screen.getByText("1")).toBeTruthy();
    // Color dot is rendered with the pattern color
    const dot = card.querySelector(".pattern-view__card-dot") as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.style.backgroundColor).toBe("rgb(129, 140, 248)");
  });

  it("shows description on card when pattern has a description", () => {
    const pattern = makePattern({ description: "A description" });
    const props = {
      ...defaultProps(),
      patterns: new Map([["pat1", pattern]]),
    };

    render(<PatternView {...props} />);

    expect(screen.getByText("A description")).toBeTruthy();
  });

  it("shows entity summaries on card, max 4 visible", () => {
    const manyEntities = [
      { entity_type: "trauma_event" as const, entity_id: "e1" },
      { entity_type: "trauma_event" as const, entity_id: "e2" },
      { entity_type: "trauma_event" as const, entity_id: "e3" },
      { entity_type: "trauma_event" as const, entity_id: "e4" },
      { entity_type: "trauma_event" as const, entity_id: "e5" },
      { entity_type: "trauma_event" as const, entity_id: "e6" },
    ];
    const pattern = makePattern({ linked_entities: manyEntities });
    const props = {
      ...defaultProps(),
      patterns: new Map([["pat1", pattern]]),
    };

    render(<PatternView {...props} />);

    const card = screen.getByTestId("pattern-card");
    // Only 4 entity items should be rendered on the card
    const entityItems = card.querySelectorAll(".pattern-view__card-entity");
    expect(entityItems.length).toBe(4);
    // "+2 more" overflow indicator
    expect(screen.getByText("+2 more")).toBeTruthy();
  });

  it("clicking a card expands it to show detail view", () => {
    const pattern = makePattern();
    const props = {
      ...defaultProps(),
      patterns: new Map([["pat1", pattern]]),
    };

    const { container } = render(<PatternView {...props} />);

    // Card is visible before clicking
    expect(screen.getByTestId("pattern-card")).toBeTruthy();

    // Click the card to expand it
    fireEvent.click(screen.getByTestId("pattern-card"));

    // Detail view should now be visible
    const detail = container.querySelector(".pattern-view__detail");
    expect(detail).toBeTruthy();
    // The card itself should be hidden (returns null for expanded pattern)
    expect(screen.queryByTestId("pattern-card")).toBeNull();
    // Detail shows the pattern name
    expect(container.querySelector(".pattern-view__detail-name")?.textContent).toBe("Test Pattern");
  });

  it("detail view shows all entities and 'Edit on canvas' link", () => {
    const pattern = makePattern({
      linked_entities: [
        { entity_type: "trauma_event", entity_id: "e1" },
        { entity_type: "trauma_event", entity_id: "e2" },
        { entity_type: "trauma_event", entity_id: "e3" },
        { entity_type: "trauma_event", entity_id: "e4" },
        { entity_type: "trauma_event", entity_id: "e5" },
      ],
    });
    const props = {
      ...defaultProps(),
      patterns: new Map([["pat1", pattern]]),
    };

    const { container } = render(<PatternView {...props} />);

    // Expand the card
    fireEvent.click(screen.getByTestId("pattern-card"));

    // All 5 entities should be visible in the detail view (no max limit)
    const detailEntities = container.querySelectorAll(".pattern-view__detail-entity");
    expect(detailEntities.length).toBe(5);

    // "Edit on canvas" link is present and points to the tree
    const editLink = screen.getByText("pattern.editOnCanvas");
    expect(editLink).toBeTruthy();
    expect(editLink.closest("a")?.getAttribute("href")).toBe("/trees/tree-123");
  });

  it("shows classification entity on card", () => {
    const classificationsWithData = new Map<string, DecryptedClassification>([
      [
        "cls1",
        {
          id: "cls1",
          dsm_category: "depressive",
          dsm_subcategory: null,
          status: "diagnosed",
          diagnosis_year: 1990,
          periods: [{ start_year: 1990, end_year: null }],
          notes: null,
          person_ids: ["p1"],
        },
      ],
    ]);

    const pattern = makePattern({
      linked_entities: [{ entity_type: "classification", entity_id: "cls1" }],
      person_ids: ["p1"],
    });

    const props = {
      ...defaultProps(),
      patterns: new Map([["pat1", pattern]]),
      classifications: classificationsWithData,
    };

    render(<PatternView {...props} />);

    // The classification label should appear (t() returns the key, so "dsm.depressive")
    expect(screen.getByText(/dsm\.depressive/)).toBeTruthy();
    // The person name should appear alongside
    expect(screen.getByText(/Alice/)).toBeTruthy();
  });

  it("countGenerations shows multiple generations", () => {
    // p1 born 1920, p2 born 1980 => range = 60 => ceil(60/25) = 3 generations
    const personsWideRange = new Map<string, DecryptedPerson>([
      [
        "p1",
        {
          id: "p1",
          name: "Grandparent",
          birth_year: 1920,
          death_year: null,
          gender: "female",
          is_adopted: false,
          notes: null,
        },
      ],
      [
        "p2",
        {
          id: "p2",
          name: "Grandchild",
          birth_year: 1980,
          death_year: null,
          gender: "male",
          is_adopted: false,
          notes: null,
        },
      ],
    ]);

    const pattern = makePattern({
      person_ids: ["p1", "p2"],
    });

    const props = {
      ...defaultProps(),
      patterns: new Map([["pat1", pattern]]),
      persons: personsWideRange,
    };

    render(<PatternView {...props} />);

    // range = 60 years, ceil(60/25) = 3 generations
    // t() returns the key, so it will be "pattern.spansGenerations" with count=3
    // Since t mock just returns the key, we check the key is rendered
    expect(screen.getByText("pattern.spansGenerations")).toBeTruthy();
  });

  it("detail view shows close button that returns to card view", () => {
    const pattern = makePattern();
    const props = {
      ...defaultProps(),
      patterns: new Map([["pat1", pattern]]),
    };

    const { container } = render(<PatternView {...props} />);

    // Card is visible before clicking
    expect(screen.getByTestId("pattern-card")).toBeTruthy();

    // Click the card to expand it
    fireEvent.click(screen.getByTestId("pattern-card"));

    // Detail view should now be visible, card should be hidden
    expect(container.querySelector(".pattern-view__detail")).toBeTruthy();
    expect(screen.queryByTestId("pattern-card")).toBeNull();

    // Click the close button in the detail view
    const closeBtn = container.querySelector(".pattern-view__detail-close") as HTMLElement;
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);

    // Detail view should be gone, card should reappear
    expect(container.querySelector(".pattern-view__detail")).toBeNull();
    expect(screen.getByTestId("pattern-card")).toBeTruthy();
  });
});
