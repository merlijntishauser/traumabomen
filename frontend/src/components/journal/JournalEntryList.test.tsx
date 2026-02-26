import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedJournalEntry,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { JournalEntryList } from "./JournalEntryList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key} (${opts.count})`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("react-markdown", () => ({
  default: ({
    children,
    allowedElements,
    unwrapDisallowed,
  }: { children: string; allowedElements?: string[]; unwrapDisallowed?: boolean }) => (
    <div
      data-testid="markdown"
      data-allowed-elements={allowedElements?.join(",") ?? ""}
      data-unwrap-disallowed={String(!!unwrapDisallowed)}
    >
      {children}
    </div>
  ),
}));

vi.mock("../../lib/reflectionPrompts", () => ({
  getRandomJournalPrompts: () => ["Prompt 1", "Prompt 2", "Prompt 3"],
}));

const personsMap = new Map<string, DecryptedPerson>([
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

const emptyMaps = {
  persons: new Map<string, DecryptedPerson>(),
  events: new Map<string, DecryptedEvent>(),
  lifeEvents: new Map<string, DecryptedLifeEvent>(),
  turningPoints: new Map<string, DecryptedTurningPoint>(),
  classifications: new Map<string, DecryptedClassification>(),
  patterns: new Map<string, DecryptedPattern>(),
};

const mockEntry: DecryptedJournalEntry = {
  id: "j1",
  text: "This is my first journal entry about the family tree.",
  linked_entities: [{ entity_type: "person", entity_id: "p1" }],
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
};

const mockEntryOld: DecryptedJournalEntry = {
  id: "j2",
  text: "An older entry reflecting on past events and patterns that repeat over multiple generations in the family.",
  linked_entities: [],
  created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
};

function renderList(overrides: Partial<Parameters<typeof JournalEntryList>[0]> = {}) {
  const defaultProps = {
    entries: [],
    ...emptyMaps,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<JournalEntryList {...defaultProps} />);
  return defaultProps;
}

describe("JournalEntryList", () => {
  it("renders the new entry button", () => {
    renderList();
    expect(screen.getByText("journal.newEntry")).toBeInTheDocument();
  });

  it("shows empty state when no entries exist", () => {
    renderList();
    expect(screen.getByTestId("journal-empty")).toBeInTheDocument();
    expect(screen.getByText("journal.empty")).toBeInTheDocument();
  });

  it("renders entry cards with markdown preview and relative time", () => {
    renderList({ entries: [mockEntry, mockEntryOld] });

    // Should NOT show empty state
    expect(screen.queryByTestId("journal-empty")).not.toBeInTheDocument();

    // Both cards rendered
    expect(screen.getByTestId("journal-card-j1")).toBeInTheDocument();
    expect(screen.getByTestId("journal-card-j2")).toBeInTheDocument();

    // Markdown rendered (via mock that renders text in a div)
    const markdowns = screen.getAllByTestId("markdown");
    expect(markdowns.length).toBe(2);
    expect(markdowns[0]).toHaveTextContent(mockEntry.text);
  });

  it("shows linked entity chips with resolved names and label", () => {
    renderList({ entries: [mockEntry], persons: personsMap });

    // Should show the "linked persons" prefix label
    expect(screen.getByText("journal.linkedPersons")).toBeInTheDocument();
    // Should show the person name as a chip
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows entity id as fallback when entity not found", () => {
    renderList({ entries: [mockEntry] });

    // No person in the map, should show the entity id
    expect(screen.getByText("p1")).toBeInTheDocument();
  });

  it("does not show chips for entries without linked entities", () => {
    renderList({ entries: [mockEntryOld] });
    const card = screen.getByTestId("journal-card-j2");
    expect(card.querySelector(".journal-list__card-footer")).not.toBeInTheDocument();
  });

  it("clicking 'New entry' opens the form", () => {
    renderList();

    fireEvent.click(screen.getByText("journal.newEntry"));

    expect(screen.getByTestId("journal-entry-form")).toBeInTheDocument();
  });

  it("clicking a card opens the form for that entry", () => {
    renderList({ entries: [mockEntry] });

    fireEvent.click(screen.getByTestId("journal-card-j1"));

    expect(screen.getByTestId("journal-entry-form")).toBeInTheDocument();
    // The textarea should contain the entry text
    expect(screen.getByTestId("journal-textarea")).toHaveValue(mockEntry.text);
  });

  it("saving a new entry calls onSave with null id", () => {
    const props = renderList();

    fireEvent.click(screen.getByText("journal.newEntry"));

    const textarea = screen.getByTestId("journal-textarea");
    fireEvent.change(textarea, { target: { value: "New reflection" } });

    fireEvent.click(screen.getByText("journal.save"));

    expect(props.onSave).toHaveBeenCalledWith(null, {
      text: "New reflection",
      linked_entities: [],
    });
  });

  it("saving an existing entry calls onSave with the entry id", () => {
    const props = renderList({ entries: [mockEntry] });

    fireEvent.click(screen.getByTestId("journal-card-j1"));
    fireEvent.click(screen.getByText("journal.save"));

    expect(props.onSave).toHaveBeenCalledWith("j1", {
      text: mockEntry.text,
      linked_entities: mockEntry.linked_entities,
    });
  });

  it("cancelling the form closes it", () => {
    renderList();

    fireEvent.click(screen.getByText("journal.newEntry"));
    expect(screen.getByTestId("journal-entry-form")).toBeInTheDocument();

    fireEvent.click(screen.getByText("common.cancel"));
    expect(screen.queryByTestId("journal-entry-form")).not.toBeInTheDocument();
  });

  it("formats time as 'just now' for entries less than 1 hour old", () => {
    const recentEntry: DecryptedJournalEntry = {
      id: "j-recent",
      text: "Very recent entry",
      linked_entities: [],
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      updated_at: new Date().toISOString(),
    };
    renderList({ entries: [recentEntry] });

    expect(screen.getByText("journal.justNow")).toBeInTheDocument();
  });

  it("opens form when pressing Enter on a card", () => {
    renderList({ entries: [mockEntry] });

    fireEvent.keyDown(screen.getByTestId("journal-card-j1"), { key: "Enter" });

    expect(screen.getByTestId("journal-entry-form")).toBeInTheDocument();
    expect(screen.getByTestId("journal-textarea")).toHaveValue(mockEntry.text);
  });

  it("opens form when pressing Space on a card", () => {
    renderList({ entries: [mockEntry] });

    fireEvent.keyDown(screen.getByTestId("journal-card-j1"), { key: " " });

    expect(screen.getByTestId("journal-entry-form")).toBeInTheDocument();
  });

  it("ignores other keys on a card", () => {
    renderList({ entries: [mockEntry] });

    fireEvent.keyDown(screen.getByTestId("journal-card-j1"), { key: "Tab" });

    expect(screen.queryByTestId("journal-entry-form")).not.toBeInTheDocument();
  });

  it("passes allowedElements and unwrapDisallowed to Markdown in entry cards", () => {
    renderList({ entries: [mockEntry] });

    const markdown = screen.getByTestId("markdown");
    expect(markdown.dataset.allowedElements).toContain("p");
    expect(markdown.dataset.allowedElements).toContain("strong");
    expect(markdown.dataset.allowedElements).not.toContain("script");
    expect(markdown.dataset.allowedElements).not.toContain("img");
    expect(markdown.dataset.unwrapDisallowed).toBe("true");
  });

  it("delete flow on existing entry calls onDelete", () => {
    const props = renderList({ entries: [mockEntry] });

    fireEvent.click(screen.getByTestId("journal-card-j1"));

    // First click: ask for confirmation
    fireEvent.click(screen.getByText("journal.delete"));
    // Second click: confirm
    fireEvent.click(screen.getByText("journal.confirmDelete"));

    expect(props.onDelete).toHaveBeenCalledWith("j1");
  });
});
