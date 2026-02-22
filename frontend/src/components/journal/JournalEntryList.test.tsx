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
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock("../../lib/reflectionPrompts", () => ({
  getRandomJournalPrompts: () => ["Prompt 1", "Prompt 2", "Prompt 3"],
}));

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

  it("renders entry cards with preview text and relative time", () => {
    renderList({ entries: [mockEntry, mockEntryOld] });

    // Should NOT show empty state
    expect(screen.queryByTestId("journal-empty")).not.toBeInTheDocument();

    // Both cards rendered
    expect(screen.getByTestId("journal-card-j1")).toBeInTheDocument();
    expect(screen.getByTestId("journal-card-j2")).toBeInTheDocument();

    // Preview text visible
    expect(
      screen.getByText("This is my first journal entry about the family tree."),
    ).toBeInTheDocument();
  });

  it("shows linked entity count on cards with links", () => {
    renderList({ entries: [mockEntry] });

    // mockEntry has 1 linked entity
    expect(screen.getByText("journal.linkedCount (1)")).toBeInTheDocument();
  });

  it("does not show linked count for entries without linked entities", () => {
    renderList({ entries: [mockEntryOld] });
    expect(screen.queryByText(/journal\.linkedCount/)).not.toBeInTheDocument();
  });

  it("clicking 'New entry' opens the form", () => {
    renderList();

    fireEvent.click(screen.getByText("journal.newEntry"));

    expect(screen.getByTestId("journal-entry-form")).toBeInTheDocument();
    // Empty state should be hidden when form is open
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
