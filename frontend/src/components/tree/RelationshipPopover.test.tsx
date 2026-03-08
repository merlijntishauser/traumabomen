import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { RelationshipType } from "../../types/domain";
import { RelationshipPopover } from "./RelationshipPopover";

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

describe("RelationshipPopover", () => {
  const persons = new Map<string, DecryptedPerson>([
    ["p1", makePerson({ id: "p1", name: "Alice" })],
    ["p2", makePerson({ id: "p2", name: "Bob" })],
  ]);

  const defaultProps = {
    connection: { source: "p1", target: "p2", sourceHandle: null, targetHandle: null },
    persons,
    onSelect: vi.fn(),
    onSwap: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders section title and person names", () => {
    render(<RelationshipPopover {...defaultProps} />);
    expect(screen.getByText("relationship.selectType")).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it("renders a swap button", () => {
    render(<RelationshipPopover {...defaultProps} />);
    expect(screen.getByText("relationship.swap")).toBeInTheDocument();
  });

  it("renders a button for each relationship type", () => {
    render(<RelationshipPopover {...defaultProps} />);
    const typeCount = Object.values(RelationshipType).length;
    const optionButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.classList.contains("relationship-popover__option"));
    expect(optionButtons).toHaveLength(typeCount);
  });

  it("renders cancel button", () => {
    render(<RelationshipPopover {...defaultProps} />);
    expect(screen.getByText("common.cancel")).toBeInTheDocument();
  });
});
