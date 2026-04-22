import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { RelationshipType } from "../../types/domain";
import { DIRECTIONAL_TYPES, RelationshipPopover } from "./RelationshipPopover";

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

  it("calls onClose when Escape is pressed on the backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(<RelationshipPopover {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(container.querySelector(".relationship-popover")!, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when a non-Escape key is pressed on the backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(<RelationshipPopover {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(container.querySelector(".relationship-popover")!, { key: "Enter" });
    fireEvent.keyDown(container.querySelector(".relationship-popover")!, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stops keydown propagation on the card so backdrop Escape handler does not fire", () => {
    const onClose = vi.fn();
    const { container } = render(<RelationshipPopover {...defaultProps} onClose={onClose} />);
    // Firing Escape on the card must not bubble to the backdrop's keydown handler.
    fireEvent.keyDown(container.querySelector(".relationship-popover__card")!, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("falls back to '?' when a person is missing from the map", () => {
    const { container } = render(
      <RelationshipPopover
        {...defaultProps}
        connection={{
          source: "missing-source",
          target: "p2",
          sourceHandle: null,
          targetHandle: null,
        }}
      />,
    );
    const direction = container.querySelector(".relationship-popover__direction span")!;
    expect(direction.textContent).toContain("?");
    expect(direction.textContent).toContain("Bob");
  });

  it("renders directional types using the directionLabel translation key", () => {
    render(<RelationshipPopover {...defaultProps} />);
    // The default t-mock returns the key without interpolating opts, so every
    // directional type resolves to the same literal "relationship.directionLabel".
    // DIRECTIONAL_TYPES currently contains 4 entries, so we expect 4 such buttons.
    const directional = screen
      .getAllByRole("button")
      .filter(
        (btn) =>
          btn.classList.contains("relationship-popover__option") &&
          btn.textContent === "relationship.directionLabel",
      );
    expect(directional).toHaveLength(DIRECTIONAL_TYPES.size);
  });

  it("renders non-directional types using the plain type translation key", () => {
    render(<RelationshipPopover {...defaultProps} />);
    // Partner, Friend, and sibling variants are NOT in DIRECTIONAL_TYPES
    // — they render using `relationship.type.<value>` directly.
    expect(screen.getByText("relationship.type.partner")).toBeInTheDocument();
    expect(screen.getByText("relationship.type.friend")).toBeInTheDocument();
    expect(screen.getByText("relationship.type.biological_sibling")).toBeInTheDocument();
    expect(screen.getByText("relationship.type.step_sibling")).toBeInTheDocument();
    expect(screen.getByText("relationship.type.half_sibling")).toBeInTheDocument();
  });
});
