import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../hooks/useTreeId", () => ({
  useTreeId: () => "tree-123",
}));

const mockTreeData: {
  treeName: string;
  persons: Map<string, DecryptedPerson>;
  relationships: Map<string, DecryptedRelationship>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  isLoading: boolean;
  error: Error | null;
} = {
  treeName: "Test Tree",
  persons: new Map(),
  relationships: new Map(),
  events: new Map(),
  lifeEvents: new Map(),
  turningPoints: new Map(),
  classifications: new Map(),
  isLoading: false,
  error: null,
};

vi.mock("../hooks/useTreeData", () => ({
  useTreeData: () => mockTreeData,
}));

vi.mock("../components/tree/TreeToolbar", () => ({
  TreeToolbar: ({ activeView }: { activeView: string }) => (
    <div data-testid="tree-toolbar" data-active-view={activeView} />
  ),
}));

vi.mock("../components/tree/ThemeLanguageSettings", () => ({
  ThemeLanguageSettings: () => <div data-testid="theme-settings" />,
}));

vi.mock("../components/tree/TreeCanvas.css", () => ({}));
vi.mock("./InsightsPage.css", () => ({}));

const { default: InsightsPage } = await import("./InsightsPage");

// ---- Helpers ----

function makePerson(id: string, birthYear: number): DecryptedPerson {
  return {
    id,
    name: `Person ${id}`,
    birth_year: birthYear,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "female",
    is_adopted: false,
    notes: null,
  };
}

function makeRelationship(id: string, source: string, target: string): DecryptedRelationship {
  return {
    id,
    source_person_id: source,
    target_person_id: target,
    type: "biological_parent",
    active_period: null,
    periods: [],
    person_ids: [source, target],
  };
}

function makeEvent(
  id: string,
  personIds: string[],
  category = "loss" as DecryptedEvent["category"],
  date = "1960",
): DecryptedEvent {
  return {
    id,
    title: `Event ${id}`,
    description: "",
    category,
    approximate_date: date,
    severity: 5,
    tags: [],
    person_ids: personIds,
  };
}

// ---- Tests ----

describe("InsightsPage", () => {
  afterEach(() => {
    cleanup();
    // Reset to empty state
    mockTreeData.persons = new Map();
    mockTreeData.relationships = new Map();
    mockTreeData.events = new Map();
    mockTreeData.lifeEvents = new Map();
    mockTreeData.turningPoints = new Map();
    mockTreeData.classifications = new Map();
    mockTreeData.isLoading = false;
    mockTreeData.error = null;
  });

  it("renders toolbar with insights active view", () => {
    render(<InsightsPage />);
    const toolbar = screen.getByTestId("tree-toolbar");
    expect(toolbar.getAttribute("data-active-view")).toBe("insights");
  });

  it("renders title and subtitle", () => {
    render(<InsightsPage />);
    expect(screen.getByText("insights.title")).toBeTruthy();
    expect(screen.getByText("insights.subtitle")).toBeTruthy();
  });

  it("shows empty state when there are no insights", () => {
    render(<InsightsPage />);
    expect(screen.getByTestId("insights-empty")).toBeTruthy();
    expect(screen.getByText("insights.empty")).toBeTruthy();
  });

  it("shows loading state", () => {
    mockTreeData.isLoading = true;
    render(<InsightsPage />);
    expect(screen.getByText("common.loading")).toBeTruthy();
  });

  it("shows error state", () => {
    mockTreeData.error = new Error("decrypt failed");
    render(<InsightsPage />);
    expect(screen.getByText("tree.decryptionError")).toBeTruthy();
  });

  it("renders insight cards when data generates insights", () => {
    // Set up a 3-generation family with trauma events across generations
    const grandparent = makePerson("gp", 1930);
    const parent = makePerson("p", 1960);
    const child = makePerson("c", 1990);

    mockTreeData.persons = new Map([
      ["gp", grandparent],
      ["p", parent],
      ["c", child],
    ]);

    mockTreeData.relationships = new Map([
      ["r1", makeRelationship("r1", "gp", "p")],
      ["r2", makeRelationship("r2", "p", "c")],
    ]);

    // Same category trauma across generations
    mockTreeData.events = new Map([
      ["e1", makeEvent("e1", ["gp"], "loss", "1960")],
      ["e2", makeEvent("e2", ["p"], "loss", "1985")],
      ["e3", makeEvent("e3", ["c"], "loss", "2010")],
    ]);

    render(<InsightsPage />);

    // Should not show empty state
    expect(screen.queryByTestId("insights-empty")).toBeNull();

    // Should render insight cards
    const cards = screen.getAllByTestId("insight-card");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("renders sections grouped by category", () => {
    const grandparent = makePerson("gp", 1930);
    const parent = makePerson("p", 1960);
    const child = makePerson("c", 1990);

    mockTreeData.persons = new Map([
      ["gp", grandparent],
      ["p", parent],
      ["c", child],
    ]);

    mockTreeData.relationships = new Map([
      ["r1", makeRelationship("r1", "gp", "p")],
      ["r2", makeRelationship("r2", "p", "c")],
    ]);

    mockTreeData.events = new Map([
      ["e1", makeEvent("e1", ["gp"], "loss", "1960")],
      ["e2", makeEvent("e2", ["p"], "loss", "1985")],
      ["e3", makeEvent("e3", ["c"], "loss", "2010")],
    ]);

    const { container } = render(<InsightsPage />);

    // Should have at least one section
    const sections = container.querySelectorAll(".insights-page__section");
    expect(sections.length).toBeGreaterThan(0);
  });

  it("does not render empty sections", () => {
    // Only summary insights (no generational since single generation)
    mockTreeData.persons = new Map([["p1", makePerson("p1", 1980)]]);
    mockTreeData.events = new Map([
      ["e1", makeEvent("e1", ["p1"], "loss", "2000")],
      ["e2", makeEvent("e2", ["p1"], "loss", "2005")],
      ["e3", makeEvent("e3", ["p1"], "loss", "2010")],
    ]);

    render(<InsightsPage />);

    // Generational section should not render (no multi-gen data)
    expect(screen.queryByTestId("insights-section-generational")).toBeNull();
  });
});
