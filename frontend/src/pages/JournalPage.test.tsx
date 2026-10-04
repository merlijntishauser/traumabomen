import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecryptedJournalEntry } from "../hooks/useTreeData";
import JournalPage from "./JournalPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en-GB" } }),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock("../components/tree/TreeToolbar", () => ({
  TreeToolbar: () => <div data-testid="tree-toolbar" />,
}));

vi.mock("../components/tree/ContourDecoration", () => ({
  ContourDecoration: () => <div data-testid="contour-decoration" />,
}));

vi.mock("../lib/reflectionPrompts", () => ({
  getRandomJournalPrompts: () => ["What was never spoken about?"],
}));

vi.mock("../hooks/useTreeId", () => ({ useTreeId: () => "tree-1" }));

const mutations = {
  createJournalEntry: { mutate: vi.fn() },
  updateJournalEntry: { mutate: vi.fn() },
  deleteJournalEntry: { mutate: vi.fn() },
};
vi.mock("../hooks/useTreeMutations", () => ({ useTreeMutations: () => mutations }));

let entries: Map<string, DecryptedJournalEntry>;
let treeState: { isLoading: boolean; error: Error | null };

vi.mock("../hooks/useTreeData", () => ({
  useTreeData: () => ({
    treeName: "A fictional family",
    persons: new Map(),
    events: new Map(),
    lifeEvents: new Map(),
    turningPoints: new Map(),
    classifications: new Map(),
    patterns: new Map(),
    journalEntries: entries,
    ...treeState,
  }),
}));

function entry(id: string, text: string, created_at: string): DecryptedJournalEntry {
  return { id, text, linked_entities: [], created_at, updated_at: created_at };
}

beforeEach(() => {
  vi.clearAllMocks();
  treeState = { isLoading: false, error: null };
  entries = new Map([
    ["old", entry("old", "Older thoughts", "2026-08-01T10:00:00Z")],
    ["new", entry("new", "The silver", "2026-09-12T10:00:00Z")],
  ]);
});

describe("JournalPage", () => {
  it("opens on a fresh page with one open question", () => {
    render(<JournalPage />);
    expect(screen.getByText("What was never spoken about?")).toBeInTheDocument();
    expect(screen.getByTestId("journal-textarea")).toHaveValue("");
    expect(screen.getByTestId("contour-decoration")).toBeInTheDocument();
  });

  it("lists earlier entries newest first in the margin", () => {
    render(<JournalPage />);
    const items = screen.getAllByRole("button", { name: /2026/ });
    expect(items[0]).toHaveTextContent("The silver");
    expect(items[1]).toHaveTextContent("Older thoughts");
  });

  it("saves a new entry and starts a fresh page", () => {
    render(<JournalPage />);
    fireEvent.change(screen.getByTestId("journal-textarea"), { target: { value: "Tonight" } });
    fireEvent.click(screen.getByRole("button", { name: "journal.save" }));
    expect(mutations.createJournalEntry.mutate).toHaveBeenCalledWith({
      text: "Tonight",
      linked_entities: [],
    });
    expect(screen.getByTestId("journal-textarea")).toHaveValue("");
  });

  it("clears the page on cancel", () => {
    render(<JournalPage />);
    fireEvent.change(screen.getByTestId("journal-textarea"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.getByTestId("journal-textarea")).toHaveValue("");
  });

  it("opens an earlier entry to reread, edit and save", () => {
    render(<JournalPage />);
    fireEvent.click(screen.getByRole("button", { name: /The silver/ }));
    expect(
      screen.getByRole("heading", { level: 2, name: "12 September 2026" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "journal.editEntry" }));
    fireEvent.change(screen.getByTestId("journal-textarea"), {
      target: { value: "The silver, again" },
    });
    fireEvent.click(screen.getByRole("button", { name: "journal.save" }));
    expect(mutations.updateJournalEntry.mutate).toHaveBeenCalledWith({
      entryId: "new",
      data: { text: "The silver, again", linked_entities: [] },
    });
    expect(
      screen.getByRole("heading", { level: 2, name: "12 September 2026" }),
    ).toBeInTheDocument();
  });

  it("returns to the entry when editing is cancelled", () => {
    render(<JournalPage />);
    fireEvent.click(screen.getByRole("button", { name: /The silver/ }));
    fireEvent.click(screen.getByRole("button", { name: "journal.editEntry" }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.getByRole("button", { name: "journal.editEntry" })).toBeInTheDocument();
  });

  it("deletes an entry and returns to a fresh page", () => {
    render(<JournalPage />);
    fireEvent.click(screen.getByRole("button", { name: /The silver/ }));
    fireEvent.click(screen.getByRole("button", { name: "journal.editEntry" }));
    fireEvent.click(screen.getByRole("button", { name: "journal.delete" }));
    fireEvent.click(screen.getByRole("button", { name: "journal.delete" }));
    expect(mutations.deleteJournalEntry.mutate).toHaveBeenCalledWith("new");
    expect(screen.getByText("What was never spoken about?")).toBeInTheDocument();
  });

  it("goes back to a new page from an opened entry", () => {
    render(<JournalPage />);
    fireEvent.click(screen.getByRole("button", { name: /The silver/ }));
    fireEvent.click(screen.getByRole("button", { name: "journal.writeNew" }));
    expect(screen.getByTestId("journal-textarea")).toHaveValue("");
  });

  it("falls back to a fresh page when the opened entry disappears", () => {
    const { rerender } = render(<JournalPage />);
    fireEvent.click(screen.getByRole("button", { name: /The silver/ }));
    entries = new Map([["old", entry("old", "Older thoughts", "2026-08-01T10:00:00Z")]]);
    rerender(<JournalPage />);
    expect(screen.getByTestId("journal-textarea")).toBeInTheDocument();
  });

  it("shows plain loading text", () => {
    treeState = { isLoading: true, error: null };
    render(<JournalPage />);
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("reports a decryption error", () => {
    treeState = { isLoading: false, error: new Error("nope") };
    render(<JournalPage />);
    expect(screen.getByText("tree.decryptionError")).toBeInTheDocument();
  });
});
