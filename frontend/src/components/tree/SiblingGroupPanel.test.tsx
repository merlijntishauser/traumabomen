import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedSiblingGroup } from "../../hooks/useTreeData";
import { SiblingGroupPanel } from "./SiblingGroupPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key}:${opts.count}`;
      return key;
    },
  }),
}));

function makeGroup(overrides: Partial<DecryptedSiblingGroup> = {}): DecryptedSiblingGroup {
  return {
    id: "sg1",
    person_ids: ["p1"],
    members: [
      { name: "Alice", birth_year: 1990 },
      { name: "Bob", birth_year: 1992 },
    ],
    ...overrides,
  };
}

function defaultProps() {
  return {
    group: makeGroup(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onPromote: vi.fn(),
    onClose: vi.fn(),
  };
}

describe("SiblingGroupPanel", () => {
  it("renders member rows with name and year inputs", () => {
    render(<SiblingGroupPanel {...defaultProps()} />);

    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1990")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bob")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1992")).toBeInTheDocument();
  });

  it("shows total count (members + person_ids)", () => {
    render(<SiblingGroupPanel {...defaultProps()} />);

    // 2 members + 1 person_id = 3 total
    expect(screen.getByText("siblingGroup.totalCount:3")).toBeInTheDocument();
  });

  it("calls onSave with updated members when save is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<SiblingGroupPanel {...props} />);

    // Edit Alice's name
    const aliceInput = screen.getByDisplayValue("Alice");
    await user.clear(aliceInput);
    await user.type(aliceInput, "Alicia");

    // Click save
    await user.click(screen.getByText("common.save"));

    expect(props.onSave).toHaveBeenCalledWith(
      "sg1",
      [
        { name: "Alicia", birth_year: 1990 },
        { name: "Bob", birth_year: 1992 },
      ],
      ["p1"],
    );
  });

  it("adds a new member row when add member button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<SiblingGroupPanel {...props} />);

    const addButton = screen.getByText("siblingGroup.addMember");
    await user.click(addButton);

    // Should now have 3 name inputs (2 original + 1 new empty)
    const nameInputs = screen.getAllByPlaceholderText("siblingGroup.namePlaceholder");
    expect(nameInputs).toHaveLength(3);

    // Total count should update: 3 members + 1 person_id = 4
    expect(screen.getByText("siblingGroup.totalCount:4")).toBeInTheDocument();
  });

  it("calls onPromote with correct group id and index", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<SiblingGroupPanel {...props} />);

    // Click the second promote button (Bob, index 1)
    const promoteButtons = screen.getAllByText("siblingGroup.promote");
    await user.click(promoteButtons[1]);

    expect(props.onPromote).toHaveBeenCalledWith("sg1", 1);
  });

  it("removes a member row when remove button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<SiblingGroupPanel {...props} />);

    // Remove Alice (first remove button)
    const removeButtons = screen.getAllByText("common.remove");
    await user.click(removeButtons[0]);

    // Alice should be gone, Bob should remain
    expect(screen.queryByDisplayValue("Alice")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Bob")).toBeInTheDocument();

    // Total count should update: 1 member + 1 person_id = 2
    expect(screen.getByText("siblingGroup.totalCount:2")).toBeInTheDocument();
  });

  it("calls onDelete with group id when delete button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<SiblingGroupPanel {...props} />);

    await user.click(screen.getByText("siblingGroup.deleteGroup"));

    expect(props.onDelete).toHaveBeenCalledWith("sg1");
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<SiblingGroupPanel {...props} />);

    await user.click(screen.getByText("common.close"));

    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("handles year change to empty (null)", () => {
    const props = defaultProps();
    render(<SiblingGroupPanel {...props} />);

    const yearInput = screen.getByDisplayValue("1990");
    fireEvent.change(yearInput, { target: { value: "" } });

    // After clearing, save should send null birth_year
    fireEvent.click(screen.getByText("common.save"));

    expect(props.onSave).toHaveBeenCalledWith(
      "sg1",
      [
        { name: "Alice", birth_year: null },
        { name: "Bob", birth_year: 1992 },
      ],
      ["p1"],
    );
  });
});
