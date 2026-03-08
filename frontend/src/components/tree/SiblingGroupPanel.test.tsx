import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson, DecryptedSiblingGroup } from "../../hooks/useTreeData";
import { SiblingGroupPanel } from "./SiblingGroupPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key}:${opts.count}`;
      return key;
    },
  }),
}));

function makePerson(id: string, name: string, birthYear: number | null = null): DecryptedPerson {
  return {
    id,
    name,
    birth_year: birthYear,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    gender: "unknown",
    is_adopted: false,
    notes: "",
  };
}

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
  const allPersons = new Map<string, DecryptedPerson>();
  allPersons.set("p1", makePerson("p1", "Charlie", 1985));
  return {
    group: makeGroup(),
    allPersons,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onPromote: vi.fn(),
    onClose: vi.fn(),
  };
}

describe("SiblingGroupPanel", () => {
  it("renders tree persons as read-only cards", () => {
    render(<SiblingGroupPanel {...defaultProps()} />);

    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("1985")).toBeInTheDocument();
    expect(screen.getByText("siblingGroup.inTree")).toBeInTheDocument();
  });

  it("renders member rows with name and year inputs", () => {
    render(<SiblingGroupPanel {...defaultProps()} />);

    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1990")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bob")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1992")).toBeInTheDocument();
  });

  it("shows sibling count excluding the person themselves", () => {
    render(<SiblingGroupPanel {...defaultProps()} />);

    // 2 members + 0 other person_ids (1 person_id minus self) = 2
    expect(screen.getByText("siblingGroup.totalCount:2")).toBeInTheDocument();
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

    // Total count should update: 3 members + 0 other person_ids = 3
    expect(screen.getByText("siblingGroup.totalCount:3")).toBeInTheDocument();
  });

  it("calls onPromote with correct group id and index", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<SiblingGroupPanel {...props} />);

    // Click the second promote button (Bob, index 1)
    const promoteButtons = screen.getAllByTitle("siblingGroup.promote");
    await user.click(promoteButtons[1]);

    expect(props.onPromote).toHaveBeenCalledWith("sg1", 1);
  });

  it("removes a member row when remove button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<SiblingGroupPanel {...props} />);

    // Remove Alice (first remove button)
    const removeButtons = screen.getAllByTitle("common.remove");
    await user.click(removeButtons[0]);

    // Alice should be gone, Bob should remain
    expect(screen.queryByDisplayValue("Alice")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Bob")).toBeInTheDocument();

    // Total count should update: 1 member + 0 other person_ids = 1
    expect(screen.getByText("siblingGroup.totalCount:1")).toBeInTheDocument();
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

  it("saves gender and death_year when set", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<SiblingGroupPanel {...props} />);

    // Set gender on first member (Alice)
    const genderSelects = screen.getAllByDisplayValue("person.gender");
    await user.selectOptions(genderSelects[0], "female");

    // Set death year on first member
    const deathYearInputs = screen.getAllByPlaceholderText("siblingGroup.deathYearPlaceholder");
    await user.type(deathYearInputs[0], "2020");

    await user.click(screen.getByText("common.save"));

    expect(props.onSave).toHaveBeenCalledWith(
      "sg1",
      [
        { name: "Alice", birth_year: 1990, gender: "female", death_year: 2020 },
        { name: "Bob", birth_year: 1992 },
      ],
      ["p1"],
    );
  });

  it("shows fallback for unknown person ids", () => {
    const props = defaultProps();
    props.group = makeGroup({ person_ids: ["unknown-id"] });
    props.allPersons = new Map();
    render(<SiblingGroupPanel {...props} />);

    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
