import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { PersonLinkField } from "./PersonLinkField";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function makePerson(id: string, name: string): DecryptedPerson {
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
    gender: "unknown",
    is_adopted: false,
    notes: null,
  };
}

const allPersons = new Map<string, DecryptedPerson>([
  ["a", makePerson("a", "Alice")],
  ["b", makePerson("b", "Bob")],
  ["c", makePerson("c", "Charlie")],
]);

describe("PersonLinkField", () => {
  it("hides person name when only one person selected", () => {
    render(
      <PersonLinkField allPersons={allPersons} selectedIds={new Set(["a"])} onChange={vi.fn()} />,
    );

    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("shows multiple linked person names in collapsed state", () => {
    render(
      <PersonLinkField
        allPersons={allPersons}
        selectedIds={new Set(["a", "b"])}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Alice, Bob")).toBeInTheDocument();
  });

  it("collapses checkboxes when button clicked again", () => {
    render(
      <PersonLinkField allPersons={allPersons} selectedIds={new Set(["a"])} onChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByText("pattern.linkEntity"));
    expect(screen.getByRole("checkbox", { name: "Alice" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("pattern.linkEntity"));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("expands to show checkboxes when expand button clicked", () => {
    render(
      <PersonLinkField allPersons={allPersons} selectedIds={new Set(["a"])} onChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByText("pattern.linkEntity"));

    expect(screen.getByRole("checkbox", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Bob" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Charlie" })).toBeInTheDocument();
  });

  it("calls onChange when a person checkbox is toggled (adds person)", () => {
    const onChange = vi.fn();
    render(
      <PersonLinkField allPersons={allPersons} selectedIds={new Set(["a"])} onChange={onChange} />,
    );

    fireEvent.click(screen.getByText("pattern.linkEntity"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bob" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newIds = onChange.mock.calls[0][0] as Set<string>;
    expect(newIds.has("a")).toBe(true);
    expect(newIds.has("b")).toBe(true);
  });

  it("calls onChange when unchecking a person (removes from set)", () => {
    const onChange = vi.fn();
    render(
      <PersonLinkField
        allPersons={allPersons}
        selectedIds={new Set(["a", "b"])}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("pattern.linkEntity"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bob" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newIds = onChange.mock.calls[0][0] as Set<string>;
    expect(newIds.has("a")).toBe(true);
    expect(newIds.has("b")).toBe(false);
  });

  it("prevents unchecking the last person (onChange not called)", () => {
    const onChange = vi.fn();
    render(
      <PersonLinkField allPersons={allPersons} selectedIds={new Set(["a"])} onChange={onChange} />,
    );

    fireEvent.click(screen.getByText("pattern.linkEntity"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Alice" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not show checkboxes in collapsed state", () => {
    render(
      <PersonLinkField allPersons={allPersons} selectedIds={new Set(["a"])} onChange={vi.fn()} />,
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
