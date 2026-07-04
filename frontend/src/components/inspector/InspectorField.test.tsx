import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InspectorField } from "./InspectorField";
import { InspectorGhostRow } from "./InspectorGhostRow";
import { InspectorToggleRow } from "./InspectorToggleRow";

describe("InspectorField", () => {
  it("associates the label with its input", () => {
    render(
      <InspectorField label="Name">
        <input type="text" defaultValue="Alice" />
      </InspectorField>,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Alice");
  });

  it("appends a custom class", () => {
    const { container } = render(
      <InspectorField label="Year" className="inspector-field--year">
        <input type="text" />
      </InspectorField>,
    );
    expect(container.querySelector(".inspector-field.inspector-field--year")).not.toBeNull();
  });
});

describe("InspectorToggleRow", () => {
  it("reflects and reports the checked state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InspectorToggleRow label="Adopted" checked={false} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Adopted" });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("InspectorGhostRow", () => {
  it("renders a button with the label and fires onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<InspectorGhostRow label="Add date of death" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Add date of death" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
