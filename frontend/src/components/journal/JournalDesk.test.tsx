import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedJournalEntry, DecryptedPerson } from "../../hooks/useTreeData";
import type { JournalEntityMaps } from "./JournalLinkedChips";
import { JournalLinkedChips } from "./JournalLinkedChips";
import { JournalMargin } from "./JournalMargin";
import { JournalReader } from "./JournalReader";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { date?: string }) => (opts?.date ? `${key}:${opts.date}` : key),
    i18n: { language: "en-GB" },
  }),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

function person(id: string, name: string): DecryptedPerson {
  return {
    id,
    name,
    birth_year: null,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "",
    is_adopted: false,
    notes: null,
  };
}

const entities: JournalEntityMaps = {
  persons: new Map([
    ["p1", person("p1", "Margriet")],
    ["p2", person("p2", "Anna")],
    ["p3", person("p3", "Sanne")],
    ["p4", person("p4", "Pieter")],
  ]),
  events: new Map(),
  lifeEvents: new Map(),
  turningPoints: new Map(),
  classifications: new Map(),
  patterns: new Map(),
};

function entry(overrides: Partial<DecryptedJournalEntry> = {}): DecryptedJournalEntry {
  return {
    id: "j1",
    text: "## The silver\n\nGrandma only told me about the **hunger winter** once.",
    linked_entities: [{ entity_type: "person", entity_id: "p1" }],
    created_at: "2026-09-12T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
    ...overrides,
  };
}

describe("JournalLinkedChips", () => {
  it("renders nothing without links", () => {
    const { container } = render(<JournalLinkedChips refs={[]} entities={entities} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names linked people and counts what does not fit", () => {
    render(
      <JournalLinkedChips
        refs={["p1", "p2", "p3", "p4"].map((id) => ({
          entity_type: "person" as const,
          entity_id: id,
        }))}
        entities={entities}
        limit={3}
      />,
    );
    const list = screen.getByRole("list", { name: "journal.linkedEntities" });
    expect(within(list).getByText("Margriet")).toBeInTheDocument();
    expect(within(list).queryByText("Pieter")).not.toBeInTheDocument();
    expect(within(list).getByText("+1")).toBeInTheDocument();
  });
});

describe("JournalMargin", () => {
  it("invites writing when there is nothing yet", () => {
    render(<JournalMargin entries={[]} entities={entities} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("journal.marginEmpty")).toBeInTheDocument();
    expect(screen.queryByText("journal.entryCount")).not.toBeInTheDocument();
  });

  it("shows each entry's date, plain opening and people", () => {
    render(
      <JournalMargin
        entries={[entry()]}
        entities={entities}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const item = screen.getByRole("button", { name: /12 September 2026/ });
    expect(item).toHaveTextContent("The silver Grandma only told me about the hunger winter once.");
    expect(within(item).getByText("Margriet")).toBeInTheDocument();
    expect(screen.getByText("journal.entryCount")).toBeInTheDocument();
  });

  it("marks the open entry and reports choices", () => {
    const onSelect = vi.fn();
    render(
      <JournalMargin
        entries={[entry(), entry({ id: "j2", created_at: "2026-08-30T10:00:00Z" })]}
        entities={entities}
        selectedId="j2"
        onSelect={onSelect}
      />,
    );
    const items = screen.getAllByRole("button");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveAttribute("aria-current", "true");
    fireEvent.click(items[0]);
    expect(onSelect).toHaveBeenCalledWith("j1");
  });
});

describe("JournalReader", () => {
  it("shows the date, the text and who it is about", () => {
    render(
      <JournalReader entry={entry()} entities={entities} onEdit={vi.fn()} onNewEntry={vi.fn()} />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "12 September 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("hunger winter");
    expect(screen.getByText("Margriet")).toBeInTheDocument();
    expect(screen.queryByText(/journal.editedOn/)).not.toBeInTheDocument();
  });

  it("says when an entry was edited on a later day", () => {
    render(
      <JournalReader
        entry={entry({ updated_at: "2026-10-01T10:00:00Z" })}
        entities={entities}
        onEdit={vi.fn()}
        onNewEntry={vi.fn()}
      />,
    );
    expect(screen.getByText("journal.editedOn:1 October 2026")).toBeInTheDocument();
  });

  it("offers editing and a new entry", () => {
    const onEdit = vi.fn();
    const onNewEntry = vi.fn();
    render(
      <JournalReader entry={entry()} entities={entities} onEdit={onEdit} onNewEntry={onNewEntry} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "journal.editEntry" }));
    fireEvent.click(screen.getByRole("button", { name: "journal.writeNew" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onNewEntry).toHaveBeenCalledOnce();
  });
});
