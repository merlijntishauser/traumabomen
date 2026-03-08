import { fireEvent, render, screen } from "@testing-library/react";
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

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<RelationshipPopover {...defaultProps} onClose={onClose} />);
    fireEvent.click(container.querySelector(".relationship-popover")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose when card is clicked (stopPropagation)", () => {
    const onClose = vi.fn();
    const { container } = render(<RelationshipPopover {...defaultProps} onClose={onClose} />);
    fireEvent.click(container.querySelector(".relationship-popover__card")!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onSwap when swap button is clicked", () => {
    const onSwap = vi.fn();
    render(<RelationshipPopover {...defaultProps} onSwap={onSwap} />);
    fireEvent.click(screen.getByText("relationship.swap"));
    expect(onSwap).toHaveBeenCalled();
  });

  it("calls onSelect with the relationship type when an option is clicked", () => {
    const onSelect = vi.fn();
    render(<RelationshipPopover {...defaultProps} onSelect={onSelect} />);
    const options = screen
      .getAllByRole("button")
      .filter((btn) => btn.classList.contains("relationship-popover__option"));
    fireEvent.click(options[0]);
    expect(onSelect).toHaveBeenCalledWith(Object.values(RelationshipType)[0]);
  });

  it("calls onClose when cancel button is clicked", () => {
    const onClose = vi.fn();
    render(<RelationshipPopover {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("common.cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
