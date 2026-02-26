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
import { JournalEntryForm } from "./JournalEntryForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
  getRandomJournalPrompts: () => ["Prompt A", "Prompt B", "Prompt C"],
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
      title: "Loss of parent",
      description: "",
      category: "loss" as DecryptedEvent["category"],
      approximate_date: "1980",
      severity: 3,
      tags: [],
      person_ids: ["p1"],
    },
  ],
]);

const emptyLifeEvents = new Map<string, DecryptedLifeEvent>();
const emptyTurningPoints = new Map<string, DecryptedTurningPoint>();
const emptyClassifications = new Map<string, DecryptedClassification>();
const emptyPatterns = new Map<string, DecryptedPattern>();

const existingEntry: DecryptedJournalEntry = {
  id: "j1",
  text: "Existing journal text",
  linked_entities: [{ entity_type: "person", entity_id: "p1" }],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function renderForm(overrides: Partial<Parameters<typeof JournalEntryForm>[0]> = {}) {
  const defaultProps = {
    entry: null as DecryptedJournalEntry | null,
    persons: mockPersons,
    events: mockEvents,
    lifeEvents: emptyLifeEvents,
    turningPoints: emptyTurningPoints,
    classifications: emptyClassifications,
    patterns: emptyPatterns,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<JournalEntryForm {...defaultProps} />);
  return defaultProps;
}

describe("JournalEntryForm", () => {
  it("renders the form with write/preview toggle", () => {
    renderForm();

    expect(screen.getByText("journal.write")).toBeInTheDocument();
    expect(screen.getByText("journal.preview")).toBeInTheDocument();
    expect(screen.getByTestId("journal-textarea")).toBeInTheDocument();
  });

  it("starts in write mode with empty textarea for new entry", () => {
    renderForm();

    const textarea = screen.getByTestId("journal-textarea");
    expect(textarea).toHaveValue("");
  });

  it("pre-fills textarea when editing an existing entry", () => {
    renderForm({ entry: existingEntry });

    const textarea = screen.getByTestId("journal-textarea");
    expect(textarea).toHaveValue("Existing journal text");
  });

  it("pre-fills textarea with initialPrompt for new entry", () => {
    renderForm({ initialPrompt: "Starting prompt text" });

    const textarea = screen.getByTestId("journal-textarea");
    expect(textarea).toHaveValue("Starting prompt text");
  });

  it("toggles between write and preview mode", () => {
    renderForm();

    const textarea = screen.getByTestId("journal-textarea");
    fireEvent.change(textarea, { target: { value: "Some **bold** text" } });

    // Switch to preview
    fireEvent.click(screen.getByText("journal.preview"));
    expect(screen.queryByTestId("journal-textarea")).not.toBeInTheDocument();
    expect(screen.getByTestId("journal-preview")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("Some **bold** text");

    // Switch back to write
    fireEvent.click(screen.getByText("journal.write"));
    expect(screen.getByTestId("journal-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("journal-textarea")).toHaveValue("Some **bold** text");
  });

  it("calls onSave with text and linked entities", () => {
    const props = renderForm();

    const textarea = screen.getByTestId("journal-textarea");
    fireEvent.change(textarea, { target: { value: "My reflection" } });

    fireEvent.click(screen.getByText("journal.save"));

    expect(props.onSave).toHaveBeenCalledWith({
      text: "My reflection",
      linked_entities: [],
    });
  });

  it("calls onCancel when cancel is clicked", () => {
    const props = renderForm();

    fireEvent.click(screen.getByText("common.cancel"));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("save button is disabled when text is empty", () => {
    renderForm();

    const saveBtn = screen.getByText("journal.save");
    expect(saveBtn).toBeDisabled();
  });

  it("shows linked entity chips for existing entry", () => {
    renderForm({ entry: existingEntry });

    expect(screen.getByTestId("journal-chips")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("allows removing a linked entity chip", () => {
    const props = renderForm({ entry: existingEntry });

    // Remove the chip
    const removeBtn = screen.getByRole("button", { name: "common.remove" });
    fireEvent.click(removeBtn);

    // Chip should be gone
    expect(screen.queryByTestId("journal-chips")).not.toBeInTheDocument();

    // Save and verify empty linked_entities
    const textarea = screen.getByTestId("journal-textarea");
    fireEvent.change(textarea, { target: { value: "Updated text" } });
    fireEvent.click(screen.getByText("journal.save"));

    expect(props.onSave).toHaveBeenCalledWith({
      text: "Updated text",
      linked_entities: [],
    });
  });

  it("shows entity link picker when link button is clicked", () => {
    renderForm();

    fireEvent.click(screen.getByText("journal.linkEntity"));

    expect(screen.getByTestId("entity-link-picker")).toBeInTheDocument();
  });

  it("adds entity chip when selecting from picker", () => {
    renderForm();

    fireEvent.click(screen.getByText("journal.linkEntity"));
    fireEvent.click(screen.getByText("Alice"));

    expect(screen.getByTestId("journal-chips")).toBeInTheDocument();
    // "Alice" now appears as a chip label
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows inspiration prompts for new entries", () => {
    renderForm();

    // Toggle should be visible
    expect(screen.getByText("journal.inspiration")).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText("journal.inspiration"));
    expect(screen.getByTestId("journal-prompts")).toBeInTheDocument();
    expect(screen.getByText("Prompt A")).toBeInTheDocument();
    expect(screen.getByText("Prompt B")).toBeInTheDocument();
    expect(screen.getByText("Prompt C")).toBeInTheDocument();
  });

  it("clicking a prompt appends it to the textarea", () => {
    renderForm();

    fireEvent.click(screen.getByText("journal.inspiration"));
    fireEvent.click(screen.getByText("Prompt A"));

    const textarea = screen.getByTestId("journal-textarea");
    expect(textarea).toHaveValue("Prompt A");
  });

  it("does not show inspiration prompts when editing existing entry", () => {
    renderForm({ entry: existingEntry });

    expect(screen.queryByText("journal.inspiration")).not.toBeInTheDocument();
  });

  it("delete button is not shown for new entries", () => {
    renderForm();

    expect(screen.queryByText("journal.delete")).not.toBeInTheDocument();
  });

  it("delete button with confirmation when onDelete is provided", () => {
    const onDelete = vi.fn();
    renderForm({ entry: existingEntry, onDelete });

    // First click shows confirmation
    fireEvent.click(screen.getByText("journal.delete"));
    expect(screen.getByText("journal.confirmDelete")).toBeInTheDocument();

    // Second click confirms
    fireEvent.click(screen.getByText("journal.confirmDelete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("passes allowedElements and unwrapDisallowed to Markdown", () => {
    renderForm({ entry: existingEntry });

    // Switch to preview
    fireEvent.click(screen.getByText("journal.preview"));

    const markdown = screen.getByTestId("markdown");
    expect(markdown.dataset.allowedElements).toContain("p");
    expect(markdown.dataset.allowedElements).toContain("strong");
    expect(markdown.dataset.allowedElements).not.toContain("script");
    expect(markdown.dataset.allowedElements).not.toContain("img");
    expect(markdown.dataset.unwrapDisallowed).toBe("true");
  });

  it("does not add duplicate linked entities", () => {
    renderForm();

    // Open picker and select Alice
    fireEvent.click(screen.getByText("journal.linkEntity"));
    fireEvent.click(screen.getByText("Alice"));

    // Try to select Alice again via the picker item button
    fireEvent.click(screen.getByText("journal.linkEntity"));
    const pickerItems = screen.getAllByText("Alice");
    // One is the chip, the other is in the picker; click the picker one
    const pickerItem = pickerItems.find((el) =>
      el.classList.contains("journal-entity-picker__item"),
    );
    expect(pickerItem).toBeTruthy();
    fireEvent.click(pickerItem!);

    // Only one chip remove button should exist (no duplicate)
    const chips = screen.getByTestId("journal-chips");
    const removeButtons = chips.querySelectorAll("button");
    expect(removeButtons).toHaveLength(1);
  });
});
