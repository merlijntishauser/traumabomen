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
import { JournalPanel } from "./JournalPanel";

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

const mockEntryA: DecryptedJournalEntry = {
  id: "j1",
  text: "Earlier entry about patterns.",
  linked_entities: [],
  created_at: new Date("2026-01-01T10:00:00Z").toISOString(),
  updated_at: new Date("2026-01-01T10:00:00Z").toISOString(),
};

const mockEntryB: DecryptedJournalEntry = {
  id: "j2",
  text: "Later entry about reflections.",
  linked_entities: [{ entity_type: "person", entity_id: "p1" }],
  created_at: new Date("2026-02-15T14:00:00Z").toISOString(),
  updated_at: new Date("2026-02-15T14:00:00Z").toISOString(),
};

function renderPanel(overrides: Partial<Parameters<typeof JournalPanel>[0]> = {}) {
  const defaultProps = {
    journalEntries: new Map<string, DecryptedJournalEntry>(),
    ...emptyMaps,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<JournalPanel {...defaultProps} />);
  return defaultProps;
}

describe("JournalPanel", () => {
  it("renders panel with header title and close button", () => {
    renderPanel();

    expect(screen.getByTestId("journal-panel")).toBeInTheDocument();
    expect(screen.getByText("journal.title")).toBeInTheDocument();
    expect(screen.getByText("common.close")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByText("common.close"));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("renders JournalEntryList inside the panel", () => {
    renderPanel();

    // The entry list is rendered (it shows the new entry button)
    expect(screen.getByTestId("journal-entry-list")).toBeInTheDocument();
    expect(screen.getByText("journal.newEntry")).toBeInTheDocument();
  });

  it("sorts entries newest-first", () => {
    const entries = new Map<string, DecryptedJournalEntry>([
      ["j1", mockEntryA],
      ["j2", mockEntryB],
    ]);

    renderPanel({ journalEntries: entries });

    const cards = screen.getAllByTestId(/^journal-card-/);
    expect(cards).toHaveLength(2);
    // j2 is newer, should be first
    expect(cards[0]).toHaveAttribute("data-testid", "journal-card-j2");
    expect(cards[1]).toHaveAttribute("data-testid", "journal-card-j1");
  });

  it("shows empty state when no entries exist", () => {
    renderPanel();

    expect(screen.getByTestId("journal-empty")).toBeInTheDocument();
  });

  it("passes initialPrompt to the entry list", () => {
    renderPanel({ initialPrompt: "Reflect on this." });

    // Open new entry form
    fireEvent.click(screen.getByText("journal.newEntry"));

    // The textarea should contain the initial prompt
    expect(screen.getByTestId("journal-textarea")).toHaveValue("Reflect on this.");
  });

  it("delegates onSave callback correctly", () => {
    const entries = new Map<string, DecryptedJournalEntry>([["j1", mockEntryA]]);
    const props = renderPanel({ journalEntries: entries });

    // Click on the entry card to edit
    fireEvent.click(screen.getByTestId("journal-card-j1"));

    // Save
    fireEvent.click(screen.getByText("journal.save"));

    expect(props.onSave).toHaveBeenCalledWith("j1", {
      text: mockEntryA.text,
      linked_entities: mockEntryA.linked_entities,
    });
  });

  it("delegates onDelete callback correctly", () => {
    const entries = new Map<string, DecryptedJournalEntry>([["j1", mockEntryA]]);
    const props = renderPanel({ journalEntries: entries });

    // Click on the entry card to edit
    fireEvent.click(screen.getByTestId("journal-card-j1"));

    // Delete with confirmation (confirm button reuses the original label)
    fireEvent.click(screen.getByText("journal.delete"));
    fireEvent.click(screen.getByText("journal.delete"));

    expect(props.onDelete).toHaveBeenCalledWith("j1");
  });
});
