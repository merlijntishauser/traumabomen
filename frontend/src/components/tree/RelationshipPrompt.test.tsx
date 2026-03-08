import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { RelationshipPrompt } from "./RelationshipPrompt";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function makePerson(overrides: Partial<DecryptedPerson> = {}): DecryptedPerson {
  return {
    id: "p1",
    name: "Alice",
    birth_year: 1960,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "female",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

describe("RelationshipPrompt", () => {
  const person = makePerson({ id: "p1", name: "Alice" });
  const allPersons = new Map<string, DecryptedPerson>([
    ["p1", person],
    ["p2", makePerson({ id: "p2", name: "Bob", birth_year: 1990 })],
  ]);

  const defaultProps = {
    person,
    allPersons,
    onCreateRelationship: vi.fn(),
    onDismiss: vi.fn(),
  };

  it("renders the initial ask step with prompt text", () => {
    render(<RelationshipPrompt {...defaultProps} />);
    expect(screen.getByText("relationship.promptConnect")).toBeInTheDocument();
    expect(screen.getByText("common.yes")).toBeInTheDocument();
    expect(screen.getByText("common.no")).toBeInTheDocument();
  });

  it("transitions to pickPerson step when yes is clicked", () => {
    render(<RelationshipPrompt {...defaultProps} />);
    fireEvent.click(screen.getByText("common.yes"));
    expect(screen.getByText("relationship.promptConnectTo")).toBeInTheDocument();
    // Should show other persons (Bob) but not the current person (Alice)
    expect(screen.getByText("Bob (1990)")).toBeInTheDocument();
  });

  it("transitions to pickType step after selecting a person", () => {
    render(<RelationshipPrompt {...defaultProps} />);
    fireEvent.click(screen.getByText("common.yes"));
    fireEvent.click(screen.getByText("Bob (1990)"));
    // Should now show relationship type buttons and swap
    expect(screen.getByText("relationship.swap")).toBeInTheDocument();
  });
});
