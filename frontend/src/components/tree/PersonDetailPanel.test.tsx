import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonDetailPanel } from "./PersonDetailPanel";
import { TraumaCategory, RelationshipType, PartnerStatus } from "../../types/domain";
import type { DecryptedPerson, DecryptedRelationship, DecryptedEvent } from "../../hooks/useTreeData";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function makePerson(overrides: Partial<DecryptedPerson> = {}): DecryptedPerson {
  return {
    id: "p1",
    name: "Alice",
    birth_year: 1960,
    death_year: null,
    gender: "female",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<DecryptedEvent> = {}): DecryptedEvent {
  return {
    id: "e1",
    title: "Test Event",
    description: "desc",
    category: TraumaCategory.Loss,
    approximate_date: "1985",
    severity: 5,
    tags: [],
    person_ids: ["p1"],
    ...overrides,
  };
}

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

const defaultProps = () => ({
  person: makePerson(),
  relationships: [] as DecryptedRelationship[],
  inferredSiblings: [] as { personAId: string; personBId: string; sharedParentIds: string[]; type: "half_sibling" | "full_sibling" }[],
  events: [] as DecryptedEvent[],
  allPersons: new Map([["p1", makePerson()]]),
  onSavePerson: vi.fn(),
  onDeletePerson: vi.fn(),
  onSaveRelationship: vi.fn(),
  onSaveEvent: vi.fn(),
  onDeleteEvent: vi.fn(),
  onClose: vi.fn(),
});

describe("PersonDetailPanel", () => {
  it("renders person name in header", () => {
    render(<PersonDetailPanel {...defaultProps()} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Alice");
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);
    await user.click(screen.getByText("common.close"));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("has person details section open by default", () => {
    render(<PersonDetailPanel {...defaultProps()} />);
    // The name input should be visible since person details is open
    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
  });

  it("has relationships section collapsed by default", () => {
    const props = defaultProps();
    props.relationships = [makeRelationship()];
    render(<PersonDetailPanel {...props} />);
    // The relationship details should not be visible
    expect(screen.queryByText("relationship.type.partner")).not.toBeInTheDocument();
  });

  it("has events section collapsed by default", () => {
    const props = defaultProps();
    props.events = [makeEvent()];
    render(<PersonDetailPanel {...props} />);
    // Event title should not be visible
    expect(screen.queryByText("Test Event")).not.toBeInTheDocument();
  });

  it("toggles relationships section on click", async () => {
    const user = userEvent.setup();
    const bob = makePerson({ id: "p2", name: "Bob" });
    const props = defaultProps();
    props.allPersons.set("p2", bob);
    props.relationships = [makeRelationship()];
    render(<PersonDetailPanel {...props} />);

    // Click the relationships toggle
    await user.click(screen.getByText(/relationship.relationships/));
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("toggles events section on click", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.events = [makeEvent()];
    render(<PersonDetailPanel {...props} />);

    await user.click(screen.getByText(/trauma.events/));
    expect(screen.getByText("Test Event")).toBeInTheDocument();
  });

  it("calls onSavePerson with updated data on save", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);

    const nameInput = screen.getByDisplayValue("Alice");
    await user.clear(nameInput);
    await user.type(nameInput, "Carol");
    await user.click(screen.getByText("person.save"));

    expect(props.onSavePerson).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Carol" }),
    );
  });

  it("requires two clicks to delete a person", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);

    const deleteBtn = screen.getByText("person.delete");
    await user.click(deleteBtn);
    // First click shows confirmation text
    expect(props.onDeletePerson).not.toHaveBeenCalled();
    expect(screen.getByText("person.confirmDelete")).toBeInTheDocument();

    // Second click triggers delete
    await user.click(screen.getByText("person.confirmDelete"));
    expect(props.onDeletePerson).toHaveBeenCalledWith("p1");
  });

  it("shows new event form when 'New event' button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);

    // Open events section
    await user.click(screen.getByText(/trauma.events/));
    await user.click(screen.getByText("trauma.newEvent"));

    // Event form should now be visible with title input
    expect(screen.getByText("trauma.title")).toBeInTheDocument();
  });

  it("calls onSaveEvent with null id for new events", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);

    // Open events section and new event form
    await user.click(screen.getByText(/trauma.events/));
    await user.click(screen.getByText("trauma.newEvent"));

    // Fill in title
    const titleInput = screen.getByRole("textbox", { name: /trauma.title/i });
    await user.type(titleInput, "New trauma");

    // Save
    await user.click(screen.getByText("common.save"));

    expect(props.onSaveEvent).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ title: "New trauma" }),
      expect.arrayContaining(["p1"]),
    );
  });

  it("passes updated person IDs when editing an event", async () => {
    const user = userEvent.setup();
    const bob = makePerson({ id: "p2", name: "Bob" });
    const props = defaultProps();
    props.allPersons.set("p2", bob);
    props.events = [makeEvent({ person_ids: ["p1"] })];
    render(<PersonDetailPanel {...props} />);

    // Open events, click edit
    await user.click(screen.getByText(/trauma.events/));
    await user.click(screen.getByText("common.edit"));

    // Check Bob's checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    const bobCheckbox = checkboxes.find(
      (cb) => cb.closest("label")?.textContent?.includes("Bob"),
    );
    expect(bobCheckbox).toBeDefined();
    await user.click(bobCheckbox!);

    // Save
    await user.click(screen.getByText("common.save"));

    expect(props.onSaveEvent).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ title: "Test Event" }),
      expect.arrayContaining(["p1", "p2"]),
    );
  });

  it("prevents unchecking the last person in event form", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.events = [makeEvent({ person_ids: ["p1"] })];
    render(<PersonDetailPanel {...props} />);

    // Open events, click edit
    await user.click(screen.getByText(/trauma.events/));
    await user.click(screen.getByText("common.edit"));

    // Try to uncheck Alice (the only checked person)
    const checkboxes = screen.getAllByRole("checkbox");
    const aliceCheckbox = checkboxes.find(
      (cb) => cb.closest("label")?.textContent?.includes("Alice"),
    );
    expect(aliceCheckbox).toBeDefined();
    expect(aliceCheckbox).toBeChecked();
    await user.click(aliceCheckbox!);

    // Should still be checked
    expect(aliceCheckbox).toBeChecked();
  });
});
