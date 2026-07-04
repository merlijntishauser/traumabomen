import { fireEvent, render, screen } from "@testing-library/react";
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
    cause_of_death: null,
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
    onSaveRelationship: vi.fn().mockResolvedValue(undefined),
    onDeleteRelationship: vi.fn(),
    onClose: vi.fn(),
  };
}

function getTypeSelect() {
  return screen.getByRole("combobox", { name: "relationship.type" });
}

function getStatusSelect() {
  return screen.getByRole("combobox", { name: "relationship.status" });
}

function getStartYearInput() {
  return screen.getByRole("textbox", { name: "common.startYear" });
}

function getEndYearInput() {
  return screen.getByRole("textbox", { name: "common.endYear" });
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

  it("changing relationship type calls onSaveRelationship immediately", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<RelationshipDetailPanel {...props} />);

    await user.selectOptions(getTypeSelect(), RelationshipType.Friend);

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

    await user.selectOptions(getTypeSelect(), RelationshipType.Friend);

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
    await user.selectOptions(getTypeSelect(), RelationshipType.Partner);

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

  it("always shows the period editor for partner relationships", () => {
    render(<RelationshipDetailPanel {...defaultProps()} />);
    // No accordion toggle: the add-period button is visible right away
    expect(screen.getByText("relationship.addPeriod")).toBeInTheDocument();
  });

  it("starts with no period rows when the relationship has none", () => {
    render(<RelationshipDetailPanel {...defaultProps()} />);
    expect(screen.queryByText("relationship.status")).not.toBeInTheDocument();
    expect(screen.getByText(/relationship.periods/)).toHaveTextContent("(0)");
  });

  it("add period button adds a row and commits the new period", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<RelationshipDetailPanel {...props} />);

    await user.click(screen.getByText("relationship.addPeriod"));

    // A period row appears with a status select
    expect(screen.getByText("relationship.status")).toBeInTheDocument();
    // The add committed immediately
    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [
        { start_year: new Date().getFullYear(), end_year: null, status: PartnerStatus.Together },
      ],
      active_period: null,
    });
  });

  it("remove period button removes the period and commits", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    await user.click(screen.getByText("relationship.removePeriod"));

    expect(screen.queryByText("relationship.status")).not.toBeInTheDocument();
    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [],
      active_period: null,
    });
  });

  it("changing period status commits immediately", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    await user.selectOptions(getStatusSelect(), PartnerStatus.Married);

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Married }],
      active_period: null,
    });
  });

  it("editing period start_year commits on blur", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    const startYearInput = getStartYearInput();
    fireEvent.change(startYearInput, { target: { value: "1995" } });
    expect(props.onSaveRelationship).not.toHaveBeenCalled();
    fireEvent.blur(startYearInput);

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 1995, end_year: null, status: PartnerStatus.Together }],
      active_period: null,
    });
  });

  it("editing period end_year commits on blur", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    const endYearInput = getEndYearInput();
    fireEvent.change(endYearInput, { target: { value: "2010" } });
    fireEvent.blur(endYearInput);

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Together }],
      active_period: null,
    });
  });

  it("clearing end_year sets it to null", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    const endYearInput = screen.getByDisplayValue("2010");
    fireEvent.change(endYearInput, { target: { value: "" } });
    fireEvent.blur(endYearInput);

    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
      active_period: null,
    });
  });

  it("blur without a change saves nothing", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({
      periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
    });
    render(<RelationshipDetailPanel {...props} />);

    const startYearInput = getStartYearInput();
    fireEvent.focus(startYearInput);
    fireEvent.blur(startYearInput);

    expect(props.onSaveRelationship).not.toHaveBeenCalled();
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

    // Second click triggers delete (confirm button reuses the original label)
    await user.click(screen.getByText("common.delete"));
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
    const select = getTypeSelect() as HTMLSelectElement;
    expect(select.value).toBe(RelationshipType.Friend);
  });

  it("renders all relationship type options in the select", () => {
    const props = defaultProps();
    props.relationship = makeRelationship({ type: RelationshipType.Friend });
    render(<RelationshipDetailPanel {...props} />);
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

    // Every period row has a remove button
    const removeButtons = screen.getAllByText("relationship.removePeriod");
    expect(removeButtons).toHaveLength(2);

    // Remove the first period; the removal commits immediately
    await user.click(removeButtons[0]);

    expect(screen.getAllByText("relationship.removePeriod")).toHaveLength(1);
    expect(props.onSaveRelationship).toHaveBeenCalledWith("r1", {
      type: RelationshipType.Partner,
      periods: [{ start_year: 2008, end_year: null, status: PartnerStatus.Together }],
      active_period: null,
    });
  });

  it("calls onSaveRelationship when relationship type is changed", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const props = { ...defaultProps(), onSaveRelationship: onSave };
    render(<RelationshipDetailPanel {...props} />);

    await user.selectOptions(getTypeSelect(), RelationshipType.StepParent);

    expect(onSave).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ type: RelationshipType.StepParent, periods: [] }),
    );
  });

  it("clears periods when changing from partner to a parent type", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const props = {
      ...defaultProps(),
      relationship: makeRelationship({
        type: RelationshipType.Partner,
        periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
      }),
      onSaveRelationship: onSave,
    };
    render(<RelationshipDetailPanel {...props} />);

    await user.selectOptions(getTypeSelect(), RelationshipType.BiologicalParent);

    expect(onSave).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ type: RelationshipType.BiologicalParent, periods: [] }),
    );
  });
});
