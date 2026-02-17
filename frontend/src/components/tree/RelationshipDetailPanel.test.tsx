import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson, DecryptedRelationship } from "../../hooks/useTreeData";
import { PartnerStatus, RelationshipType } from "../../types/domain";
import { RelationshipDetailPanel } from "./RelationshipDetailPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function makeRelationship(overrides: Partial<DecryptedRelationship> = {}): DecryptedRelationship {
  return {
    id: "r1",
    type: RelationshipType.Partner,
    source_person_id: "p1",
    target_person_id: "p2",
    periods: [],
    active_period: null,
    ...overrides,
  };
}

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
    gender: "female",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

function makePersonsMap(...persons: DecryptedPerson[]): Map<string, DecryptedPerson> {
  const map = new Map<string, DecryptedPerson>();
  for (const p of persons) {
    map.set(p.id, p);
  }
  return map;
}

function defaultProps() {
  const alice = makePerson({ id: "p1", name: "Alice" });
  const bob = makePerson({ id: "p2", name: "Bob", gender: "male" });
  return {
    relationship: makeRelationship(),
    allPersons: makePersonsMap(alice, bob),
    onSaveRelationship: vi.fn(),
    onDeleteRelationship: vi.fn(),
    onClose: vi.fn(),
  };
}

describe("RelationshipDetailPanel", () => {
  it("renders relationship header label", () => {
    render(<RelationshipDetailPanel {...defaultProps()} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "relationship.editRelationship",
    );
  });

  it("renders ex-partner header when all periods have end_year", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      type: RelationshipType.Partner,
      periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Divorced }],
    });
    render(<RelationshipDetailPanel {...props} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "relationship.type.exPartner",
    );
  });

  it("renders source and target person names", () => {
    render(<RelationshipDetailPanel {...defaultProps()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders '?' for unknown persons", () => {
    const props = defaultProps();
    props.allPersons = makePersonsMap(); // empty map
    render(<RelationshipDetailPanel {...props} />);
    const questionMarks = screen.getAllByText("?");
    expect(questionMarks).toHaveLength(2);
  });

  it("changing relationship type calls onSaveRelationship", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<RelationshipDetailPanel {...props} />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, RelationshipType.Friend);

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Friend,
      periods: [],
      active_period: null,
    });
  });

  it("clears periods when changing from partner to non-partner type", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, RelationshipType.Friend);

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Friend,
      periods: [],
      active_period: null,
    });
  });

  it("preserves periods when changing type to partner", async () => {
    const user = userEvent.setup();
    const existingPeriods = [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }];
    const props = defaultProps();
    props.relationship = makeRelationship({
      type: RelationshipType.Partner,
      periods: existingPeriods,
    });
    render(<RelationshipDetailPanel {...props} />);

    // Change to partner again (no-op in terms of type, but tests the code path)
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, RelationshipType.Partner);

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: existingPeriods,
      active_period: null,
    });
  });

  it("shows partner period section for partner relationships", () => {
    render(<RelationshipDetailPanel {...defaultProps()} />);
    expect(screen.getByText(/relationship.periods/)).toBeInTheDocument();
  });

  it("does not show partner period section for non-partner relationships", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      type: RelationshipType.BiologicalParent,
    });
    render(<RelationshipDetailPanel {...props} />);
    expect(screen.queryByText(/relationship.periods/)).not.toBeInTheDocument();
  });

  it("toggles period editor when clicking the section toggle", async () => {
    const user = userEvent.setup();
    render(<RelationshipDetailPanel {...defaultProps()} />);

    // Initially the period editor is closed (no add button visible)
    expect(screen.queryByText("relationship.addPeriod")).not.toBeInTheDocument();

    // Click the toggle to open
    await user.click(screen.getByText(/relationship.periods/));
    expect(screen.getByText("relationship.addPeriod")).toBeInTheDocument();

    // Click again to close
    await user.click(screen.getByText(/relationship.periods/));
    expect(screen.queryByText("relationship.addPeriod")).not.toBeInTheDocument();
  });

  it("shows empty placeholder when no periods exist", async () => {
    const user = userEvent.setup();
    render(<RelationshipDetailPanel {...defaultProps()} />);

    await user.click(screen.getByText(/relationship.periods/));
    expect(screen.getByText("---")).toBeInTheDocument();
  });

  it("add period button adds a new period row", async () => {
    const user = userEvent.setup();
    render(<RelationshipDetailPanel {...defaultProps()} />);

    // Open the period editor
    await user.click(screen.getByText(/relationship.periods/));
    // No period status selects yet
    expect(screen.queryByText("relationship.status")).not.toBeInTheDocument();

    // Add a period
    await user.click(screen.getByText("relationship.addPeriod"));
    // Now a period row should appear with a status select
    expect(screen.getByText("relationship.status")).toBeInTheDocument();
  });

  it("remove period button removes the period", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    // Open the period editor
    await user.click(screen.getByText(/relationship.periods/));
    expect(screen.getByText("relationship.removePeriod")).toBeInTheDocument();

    // Remove the period
    await user.click(screen.getByText("relationship.removePeriod"));
    // Should show the empty placeholder
    expect(screen.getByText("---")).toBeInTheDocument();
  });

  it("editing period status field updates the period", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    // Open the period editor
    await user.click(screen.getByText(/relationship.periods/));

    // Find the status select within the period editor
    const periodEditor = screen
      .getByText("relationship.status")
      .closest(".detail-panel__period-row");
    expect(periodEditor).not.toBeNull();
    const statusSelect = within(periodEditor!).getByRole("combobox");
    await user.selectOptions(statusSelect, PartnerStatus.Married);

    // Save periods
    await user.click(screen.getByText("common.save"));

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Married }],
      active_period: null,
    });
  });

  it("editing period start_year field updates the period", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    await user.click(screen.getByText(/relationship.periods/));

    const startYearInput = screen.getByDisplayValue("2000");
    fireEvent.change(startYearInput, { target: { value: "1995" } });

    await user.click(screen.getByText("common.save"));

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 1995, end_year: null, status: PartnerStatus.Together }],
      active_period: null,
    });
  });

  it("editing period end_year field updates the period", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    await user.click(screen.getByText(/relationship.periods/));

    const endYearInput = screen.getByPlaceholderText("---");
    fireEvent.change(endYearInput, { target: { value: "2010" } });

    await user.click(screen.getByText("common.save"));

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Together }],
      active_period: null,
    });
  });

  it("clearing end_year sets it to null", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    await user.click(screen.getByText(/relationship.periods/));

    const endYearInput = screen.getByDisplayValue("2010");
    fireEvent.change(endYearInput, { target: { value: "" } });

    await user.click(screen.getByText("common.save"));

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
      active_period: null,
    });
  });

  it("save periods calls onSaveRelationship and closes editor", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    // Open the period editor
    await user.click(screen.getByText(/relationship.periods/));
    expect(screen.getByText("common.save")).toBeInTheDocument();

    // Click save
    await user.click(screen.getByText("common.save"));

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
      active_period: null,
    });

    // Editor should be closed after save (add period button gone)
    expect(screen.queryByText("relationship.addPeriod")).not.toBeInTheDocument();
  });

  it("delete button shows confirmation, second click calls onDeleteRelationship", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<RelationshipDetailPanel {...props} />);

    const deleteBtn = screen.getByText("common.delete");
    await user.click(deleteBtn);

    // First click shows confirmation text
    expect(props.onDeleteRelationship).not.toHaveBeenCalled();
    expect(screen.getByText("relationship.confirmDelete")).toBeInTheDocument();

    // Second click triggers delete
    await user.click(screen.getByText("relationship.confirmDelete"));
    expect(props.onDeleteRelationship).toHaveBeenCalledWith("r1");
  });

  it("close button calls onClose", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<RelationshipDetailPanel {...props} />);

    await user.click(screen.getByText("common.close"));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("renders role labels for parent-type relationships", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      type: RelationshipType.BiologicalParent,
    });
    const { container } = render(<RelationshipDetailPanel {...props} />);

    const roleLabels = container.querySelectorAll(".detail-panel__rel-type");
    expect(roleLabels).toHaveLength(2);
    expect(roleLabels[0].textContent).toBe("relationship.type.biological_parent");
    expect(roleLabels[1].textContent).toBe("relationship.childOf.biological_parent");
  });

  it("renders role labels for step-parent relationships", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      type: RelationshipType.StepParent,
    });
    const { container } = render(<RelationshipDetailPanel {...props} />);

    const roleLabels = container.querySelectorAll(".detail-panel__rel-type");
    expect(roleLabels).toHaveLength(2);
    expect(roleLabels[0].textContent).toBe("relationship.type.step_parent");
    expect(roleLabels[1].textContent).toBe("relationship.childOf.step_parent");
  });

  it("renders role labels for adoptive-parent relationships", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      type: RelationshipType.AdoptiveParent,
    });
    const { container } = render(<RelationshipDetailPanel {...props} />);

    const roleLabels = container.querySelectorAll(".detail-panel__rel-type");
    expect(roleLabels).toHaveLength(2);
    expect(roleLabels[0].textContent).toBe("relationship.type.adoptive_parent");
    expect(roleLabels[1].textContent).toBe("relationship.childOf.adoptive_parent");
  });

  it("does not render role labels for non-parent relationships", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      type: RelationshipType.Friend,
    });
    const { container } = render(<RelationshipDetailPanel {...props} />);

    const roleLabels = container.querySelectorAll(".detail-panel__rel-type");
    expect(roleLabels).toHaveLength(0);
  });

  it("shows read-only periods for non-partner relationships with periods", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      type: RelationshipType.BiologicalSibling,
      periods: [{ start_year: 1990, end_year: 2000, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    // Should show the period text but not the editable period editor
    expect(screen.getByText(/1990/)).toBeInTheDocument();
    expect(screen.getByText(/2000/)).toBeInTheDocument();
    expect(screen.queryByText("relationship.addPeriod")).not.toBeInTheDocument();
  });

  it("resets state when relationship prop changes", () => {
    const props = defaultProps();
    const { rerender } = render(<RelationshipDetailPanel {...props} />);

    // Change the relationship prop
    const newRel = makeRelationship({
      id: "r2",
      type: RelationshipType.Friend,
      source_person_id: "p2",
      target_person_id: "p1",
    });
    rerender(<RelationshipDetailPanel {...props} relationship={newRel} />);

    // The type select should reflect the new relationship type
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe(RelationshipType.Friend);
  });

  it("renders all relationship type options in the select", () => {
    render(<RelationshipDetailPanel {...defaultProps()} />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(Object.values(RelationshipType).length);
  });

  it("handles multiple periods correctly", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [
        { start_year: 2000, end_year: 2005, status: PartnerStatus.Married },
        { start_year: 2008, end_year: null, status: PartnerStatus.Together },
      ],
    });
    render(<RelationshipDetailPanel {...props} />);

    // Open the period editor
    await user.click(screen.getByText(/relationship.periods/));

    // Should show 2 remove buttons
    const removeButtons = screen.getAllByText("relationship.removePeriod");
    expect(removeButtons).toHaveLength(2);

    // Remove the first period
    await user.click(removeButtons[0]);

    // Should have 1 remove button left
    expect(screen.getAllByText("relationship.removePeriod")).toHaveLength(1);

    // Save
    await user.click(screen.getByText("common.save"));

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 2008, end_year: null, status: PartnerStatus.Together }],
      active_period: null,
    });
  });
});
