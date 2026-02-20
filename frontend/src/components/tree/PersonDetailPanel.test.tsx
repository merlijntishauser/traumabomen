import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import {
  LifeEventCategory,
  PartnerStatus,
  RelationshipType,
  TraumaCategory,
} from "../../types/domain";
import { PersonDetailPanel } from "./PersonDetailPanel";

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

function makeLifeEvent(overrides: Partial<DecryptedLifeEvent> = {}): DecryptedLifeEvent {
  return {
    id: "le1",
    title: "Graduation",
    description: "Finished school",
    category: LifeEventCategory.Education,
    approximate_date: "2000",
    impact: 7,
    tags: ["school"],
    person_ids: ["p1"],
    ...overrides,
  };
}

function makeClassification(
  overrides: Partial<DecryptedClassification> = {},
): DecryptedClassification {
  return {
    id: "cls1",
    dsm_category: "anxiety",
    dsm_subcategory: null,
    status: "suspected",
    diagnosis_year: null,
    periods: [],
    notes: null,
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
  inferredSiblings: [] as {
    personAId: string;
    personBId: string;
    sharedParentIds: string[];
    type: "half_sibling" | "full_sibling";
  }[],
  events: [] as DecryptedEvent[],
  lifeEvents: [] as DecryptedLifeEvent[],
  classifications: [] as DecryptedClassification[],
  allPersons: new Map([["p1", makePerson()]]),
  onSavePerson: vi.fn(),
  onDeletePerson: vi.fn(),
  onSaveRelationship: vi.fn(),
  onSaveEvent: vi.fn(),
  onDeleteEvent: vi.fn(),
  onSaveLifeEvent: vi.fn(),
  onDeleteLifeEvent: vi.fn(),
  onSaveClassification: vi.fn(),
  onDeleteClassification: vi.fn(),
  onClose: vi.fn(),
});

describe("PersonDetailPanel", () => {
  it("renders person name in header", () => {
    render(<PersonDetailPanel {...defaultProps()} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Alice");
  });

  it("renders birth and death years in header", () => {
    const props = defaultProps();
    props.person = makePerson({ birth_year: 1950, death_year: 2020 });
    render(<PersonDetailPanel {...props} />);
    expect(screen.getByText("1950 - 2020")).toBeInTheDocument();
  });

  it("renders birth year with dash when still alive", () => {
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);
    expect(screen.getByText("1960 -")).toBeInTheDocument();
  });

  it("does not render years when birth year is null", () => {
    const props = defaultProps();
    props.person = makePerson({ birth_year: null });
    render(<PersonDetailPanel {...props} />);
    expect(screen.queryByText(/-/)).not.toBeInTheDocument();
  });

  it("renders tab bar with 5 tabs", () => {
    render(<PersonDetailPanel {...defaultProps()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
  });

  it("shows person tab as active by default", () => {
    render(<PersonDetailPanel {...defaultProps()} />);
    const personTab = screen.getByRole("tab", { name: /person.tab/ });
    expect(personTab).toHaveAttribute("aria-selected", "true");
  });

  it("shows count badges on tabs with items", () => {
    const props = defaultProps();
    props.events = [makeEvent()];
    props.lifeEvents = [makeLifeEvent()];
    props.classifications = [makeClassification()];
    const bob = makePerson({ id: "p2", name: "Bob" });
    props.allPersons.set("p2", bob);
    props.relationships = [makeRelationship()];
    render(<PersonDetailPanel {...props} />);

    // Relationships tab should show count 1
    const relsTab = screen.getByRole("tab", { name: /relationship.tab/ });
    expect(relsTab.querySelector(".detail-panel__tab-badge")).toHaveTextContent("1");

    // Trauma tab should show count 1
    const traumaTab = screen.getByRole("tab", { name: /trauma.tab/ });
    expect(traumaTab.querySelector(".detail-panel__tab-badge")).toHaveTextContent("1");
  });

  it("maps initialSection to correct tab", () => {
    const props = defaultProps();
    props.events = [makeEvent()];
    render(<PersonDetailPanel {...props} initialSection="trauma_event" />);

    const traumaTab = screen.getByRole("tab", { name: /trauma.tab/ });
    expect(traumaTab).toHaveAttribute("aria-selected", "true");
    // Trauma content should be visible
    expect(screen.getByText("Test Event")).toBeInTheDocument();
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
    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
  });

  it("does not show relationship content when person tab is active", () => {
    const props = defaultProps();
    props.relationships = [makeRelationship()];
    render(<PersonDetailPanel {...props} />);
    expect(screen.queryByText("relationship.type.partner")).not.toBeInTheDocument();
  });

  it("does not show trauma content when person tab is active", () => {
    const props = defaultProps();
    props.events = [makeEvent()];
    render(<PersonDetailPanel {...props} />);
    expect(screen.queryByText("Test Event")).not.toBeInTheDocument();
  });

  it("switches to relationships tab on click", async () => {
    const user = userEvent.setup();
    const bob = makePerson({ id: "p2", name: "Bob" });
    const props = defaultProps();
    props.allPersons.set("p2", bob);
    props.relationships = [makeRelationship()];
    render(<PersonDetailPanel {...props} />);

    await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("switches to trauma tab on click", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.events = [makeEvent()];
    render(<PersonDetailPanel {...props} />);

    await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
    expect(screen.getByText("Test Event")).toBeInTheDocument();
  });

  it("calls onSavePerson with updated data on save", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);

    const nameInput = screen.getByDisplayValue("Alice");
    fireEvent.change(nameInput, { target: { value: "Carol" } });
    await user.click(screen.getByText("person.save"));

    expect(props.onSavePerson).toHaveBeenCalledWith(expect.objectContaining({ name: "Carol" }));
  });

  it("requires two clicks to delete a person", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);

    const deleteBtn = screen.getByText("person.delete");
    await user.click(deleteBtn);
    expect(props.onDeletePerson).not.toHaveBeenCalled();
    expect(screen.getByText("person.confirmDelete")).toBeInTheDocument();

    await user.click(screen.getByText("person.confirmDelete"));
    expect(props.onDeletePerson).toHaveBeenCalledWith("p1");
  });

  it("shows new event form when 'New event' button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);

    await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
    await user.click(screen.getByText("trauma.newEvent"));

    expect(screen.getByText("trauma.title")).toBeInTheDocument();
  });

  it("calls onSaveEvent with null id for new events", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);

    await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
    await user.click(screen.getByText("trauma.newEvent"));

    const titleInput = screen.getByRole("textbox", { name: /trauma.title/i });
    fireEvent.change(titleInput, { target: { value: "New trauma" } });

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

    await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
    await user.click(screen.getByText("Test Event"));

    // Expand PersonLinkField and add Bob
    await user.click(screen.getByText(/link/i));
    const bobCheckbox = screen.getByRole("checkbox", { name: "Bob" });
    await user.click(bobCheckbox);

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

    await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
    await user.click(screen.getByText("Test Event"));

    // Expand PersonLinkField
    await user.click(screen.getByText(/link/i));
    const aliceCheckbox = screen.getByRole("checkbox", { name: "Alice" });
    expect(aliceCheckbox).toBeChecked();
    await user.click(aliceCheckbox);

    expect(aliceCheckbox).toBeChecked();
  });

  it("unchecking a person in multi-person event removes them", async () => {
    const user = userEvent.setup();
    const bob = makePerson({ id: "p2", name: "Bob" });
    const props = defaultProps();
    props.allPersons.set("p2", bob);
    props.events = [makeEvent({ person_ids: ["p1", "p2"] })];
    render(<PersonDetailPanel {...props} />);

    await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
    await user.click(screen.getByText("Test Event"));

    // Expand PersonLinkField
    await user.click(screen.getByText(/link/i));
    const bobCheckbox = screen.getByRole("checkbox", { name: "Bob" });
    expect(bobCheckbox).toBeChecked();

    // Uncheck Bob
    await user.click(bobCheckbox);
    expect(bobCheckbox).not.toBeChecked();

    await user.click(screen.getByText("common.save"));

    expect(props.onSaveEvent).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ title: "Test Event" }),
      ["p1"],
    );
  });

  describe("person form fields", () => {
    it("saves death year when provided", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      const deathYearInput = screen.getByPlaceholderText("---");
      fireEvent.change(deathYearInput, { target: { value: "2020" } });
      await user.click(screen.getByText("person.save"));

      expect(props.onSavePerson).toHaveBeenCalledWith(
        expect.objectContaining({ death_year: 2020 }),
      );
    });

    it("saves gender change", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.selectOptions(screen.getByDisplayValue("person.female"), "male");
      await user.click(screen.getByText("person.save"));

      expect(props.onSavePerson).toHaveBeenCalledWith(expect.objectContaining({ gender: "male" }));
    });

    it("saves adopted checkbox toggle", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      const adoptedCheckbox = screen.getByRole("checkbox");
      await user.click(adoptedCheckbox);
      await user.click(screen.getByText("person.save"));

      expect(props.onSavePerson).toHaveBeenCalledWith(
        expect.objectContaining({ is_adopted: true }),
      );
    });

    it("saves notes when provided", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      const notesTextarea = screen.getByRole("textbox", { name: /person.notes/i });
      fireEvent.change(notesTextarea, { target: { value: "Some notes" } });
      await user.click(screen.getByText("person.save"));

      expect(props.onSavePerson).toHaveBeenCalledWith(
        expect.objectContaining({ notes: "Some notes" }),
      );
    });

    it("saves null notes when empty", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.person = makePerson({ notes: "existing" });
      render(<PersonDetailPanel {...props} />);

      const notesTextarea = screen.getByRole("textbox", { name: /person.notes/i });
      fireEvent.change(notesTextarea, { target: { value: "" } });
      await user.click(screen.getByText("person.save"));

      expect(props.onSavePerson).toHaveBeenCalledWith(expect.objectContaining({ notes: null }));
    });

    it("shows death year from person data", () => {
      const props = defaultProps();
      props.person = makePerson({ death_year: 2010 });
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByDisplayValue("2010")).toBeInTheDocument();
    });

    it("hides person form when switching to another tab", async () => {
      const user = userEvent.setup();
      render(<PersonDetailPanel {...defaultProps()} />);

      expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      expect(screen.queryByDisplayValue("Alice")).not.toBeInTheDocument();
    });
  });

  describe("death month and day clearing", () => {
    it("clearing death month clears death day", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.person = makePerson({ death_year: 2020, death_month: 6, death_day: 15 });
      render(<PersonDetailPanel {...props} />);

      // Verify death day is visible
      expect(screen.getByText("person.deathDay")).toBeInTheDocument();

      // Clear death month
      const deathMonthSelect = screen
        .getByText("person.deathMonth")
        .closest("label")!
        .querySelector("select")!;
      fireEvent.change(deathMonthSelect, { target: { value: "" } });

      // Death day dropdown should disappear
      expect(screen.queryByText("person.deathDay")).not.toBeInTheDocument();

      // Save and verify death day is null
      await user.click(screen.getByText("person.save"));
      expect(props.onSavePerson).toHaveBeenCalledWith(
        expect.objectContaining({
          death_year: 2020,
          death_month: null,
          death_day: null,
        }),
      );
    });

    it("clearing death year clears death month and day", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.person = makePerson({ death_year: 2020, death_month: 6, death_day: 15 });
      render(<PersonDetailPanel {...props} />);

      // Verify death month is visible
      expect(screen.getByText("person.deathMonth")).toBeInTheDocument();

      // Clear death year
      const deathYearInput = screen.getByDisplayValue("2020");
      fireEvent.change(deathYearInput, { target: { value: "" } });

      // Death month dropdown should disappear
      expect(screen.queryByText("person.deathMonth")).not.toBeInTheDocument();

      // Save and verify all death fields are null
      await user.click(screen.getByText("person.save"));
      expect(props.onSavePerson).toHaveBeenCalledWith(
        expect.objectContaining({
          death_year: null,
          death_month: null,
          death_day: null,
        }),
      );
    });
  });

  describe("birth/death month and day fields", () => {
    it("shows birth month dropdown when birth year is set", () => {
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      expect(screen.getByText("person.birthMonth")).toBeInTheDocument();
    });

    it("does not show birth month dropdown when birth year is empty", () => {
      const props = defaultProps();
      props.person = makePerson({ birth_year: null });
      render(<PersonDetailPanel {...props} />);

      expect(screen.queryByText("person.birthMonth")).not.toBeInTheDocument();
    });

    it("shows birth day dropdown when birth month is set", () => {
      const props = defaultProps();
      props.person = makePerson({ birth_month: 3 });
      render(<PersonDetailPanel {...props} />);

      expect(screen.getByText("person.birthDay")).toBeInTheDocument();
    });

    it("does not show birth day dropdown when birth month is empty", () => {
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      expect(screen.queryByText("person.birthDay")).not.toBeInTheDocument();
    });

    it("shows death month dropdown when death year is set", () => {
      const props = defaultProps();
      props.person = makePerson({ death_year: 2020 });
      render(<PersonDetailPanel {...props} />);

      expect(screen.getByText("person.deathMonth")).toBeInTheDocument();
    });

    it("does not show death month dropdown when death year is empty", () => {
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      expect(screen.queryByText("person.deathMonth")).not.toBeInTheDocument();
    });

    it("day dropdown has 28 options for February", () => {
      const props = defaultProps();
      props.person = makePerson({ birth_month: 2 });
      render(<PersonDetailPanel {...props} />);

      const daySelect = screen
        .getByText("person.birthDay")
        .closest("label")!
        .querySelector("select")!;
      // 28 day options + 1 empty "---" option = 29
      const options = daySelect.querySelectorAll("option");
      expect(options).toHaveLength(29);
    });

    it("day dropdown has 31 options for January", () => {
      const props = defaultProps();
      props.person = makePerson({ birth_month: 1 });
      render(<PersonDetailPanel {...props} />);

      const daySelect = screen
        .getByText("person.birthDay")
        .closest("label")!
        .querySelector("select")!;
      // 31 day options + 1 empty "---" option = 32
      const options = daySelect.querySelectorAll("option");
      expect(options).toHaveLength(32);
    });

    it("save payload includes month and day fields", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.person = makePerson({ birth_month: 7, birth_day: 15 });
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText("person.save"));

      expect(props.onSavePerson).toHaveBeenCalledWith(
        expect.objectContaining({
          birth_month: 7,
          birth_day: 15,
          death_month: null,
          death_day: null,
        }),
      );
    });

    it("clearing birth year clears month and day", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.person = makePerson({ birth_month: 6, birth_day: 10 });
      render(<PersonDetailPanel {...props} />);

      // Verify month is visible
      expect(screen.getByText("person.birthMonth")).toBeInTheDocument();

      // Clear birth year
      const birthYearInput = screen.getByDisplayValue("1960");
      fireEvent.change(birthYearInput, { target: { value: "" } });

      // Month dropdown should disappear
      expect(screen.queryByText("person.birthMonth")).not.toBeInTheDocument();

      // Save and verify month/day are null
      await user.click(screen.getByText("person.save"));
      expect(props.onSavePerson).toHaveBeenCalledWith(
        expect.objectContaining({
          birth_year: null,
          birth_month: null,
          birth_day: null,
        }),
      );
    });

    it("clearing birth month clears day", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.person = makePerson({ birth_month: 3, birth_day: 20 });
      render(<PersonDetailPanel {...props} />);

      // Verify day is visible
      expect(screen.getByText("person.birthDay")).toBeInTheDocument();

      // Clear birth month
      const monthSelect = screen
        .getByText("person.birthMonth")
        .closest("label")!
        .querySelector("select")!;
      fireEvent.change(monthSelect, { target: { value: "" } });

      // Day dropdown should disappear
      expect(screen.queryByText("person.birthDay")).not.toBeInTheDocument();

      // Save and verify day is null
      await user.click(screen.getByText("person.save"));
      expect(props.onSavePerson).toHaveBeenCalledWith(
        expect.objectContaining({
          birth_month: null,
          birth_day: null,
        }),
      );
    });
  });

  describe("relationship display", () => {
    it("shows empty message when no relationships or inferred siblings", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      const { container } = render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      const emptyMsg = container.querySelector(".detail-panel__empty");
      expect(emptyMsg).toBeTruthy();
      expect(emptyMsg?.textContent).toBe("---");
    });

    it("shows ex-partner label when all periods have end_year", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [
        makeRelationship({
          periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Divorced }],
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      expect(screen.getByText("relationship.type.exPartner")).toBeInTheDocument();
    });

    it("shows childOf label for parent-type relationships when source", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [
        makeRelationship({
          type: RelationshipType.BiologicalParent,
          source_person_id: "p1",
          target_person_id: "p2",
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      expect(screen.getByText("relationship.childOf.biological_parent")).toBeInTheDocument();
    });

    it("shows parent type label for parent-type relationships when target", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [
        makeRelationship({
          type: RelationshipType.StepParent,
          source_person_id: "p2",
          target_person_id: "p1",
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      expect(screen.getByText("relationship.type.step_parent")).toBeInTheDocument();
    });

    it("shows partner periods when present", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [
        makeRelationship({
          periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Married }],
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      expect(screen.getByText(/relationship.status.married.*2000/)).toBeInTheDocument();
    });

    it("shows inferred siblings with shared parent names", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const carol = makePerson({ id: "p3", name: "Carol" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.allPersons.set("p3", carol);
      props.inferredSiblings = [
        { personAId: "p1", personBId: "p2", sharedParentIds: ["p3"], type: "half_sibling" },
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      expect(screen.getByText("relationship.type.half_sibling")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText(/relationship.viaParent/)).toBeInTheDocument();
    });

    it("shows full sibling inferred relationship", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const carol = makePerson({ id: "p3", name: "Carol" });
      const dave = makePerson({ id: "p4", name: "Dave" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.allPersons.set("p3", carol);
      props.allPersons.set("p4", dave);
      props.inferredSiblings = [
        {
          personAId: "p1",
          personBId: "p2",
          sharedParentIds: ["p3", "p4"],
          type: "full_sibling",
        },
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      expect(screen.getByText("relationship.type.full_sibling")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("shows inferred sibling when current person is personB", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const carol = makePerson({ id: "p3", name: "Carol" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.allPersons.set("p3", carol);
      props.inferredSiblings = [
        { personAId: "p2", personBId: "p1", sharedParentIds: ["p3"], type: "half_sibling" },
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("relationship.type.half_sibling")).toBeInTheDocument();
    });

    it("shows ? for unknown other person in relationship", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      // p2 is not in allPersons
      props.relationships = [makeRelationship()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      expect(screen.getByText("?")).toBeInTheDocument();
    });
  });

  describe("partner period editor", () => {
    it("opens partner editor on edit click", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [makeRelationship()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      await user.click(screen.getByText("common.edit"));

      // Period editor should be visible with status select
      expect(screen.getByText("relationship.status")).toBeInTheDocument();
    });

    it("saves partner periods", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [makeRelationship()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      await user.click(screen.getByText("common.edit"));
      await user.click(screen.getByText("common.save"));

      expect(props.onSaveRelationship).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          type: RelationshipType.Partner,
          periods: expect.arrayContaining([
            expect.objectContaining({ status: PartnerStatus.Together }),
          ]),
        }),
      );
    });

    it("cancels partner editor", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [makeRelationship()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      await user.click(screen.getByText("common.edit"));
      await user.click(screen.getByText("common.cancel"));

      // Editor should close, edit button should reappear
      expect(screen.queryByText("relationship.status")).not.toBeInTheDocument();
      expect(screen.getByText("common.edit")).toBeInTheDocument();
    });

    it("adds a period in partner editor", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [makeRelationship()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      await user.click(screen.getByText("common.edit"));

      // Should have 1 period (default), add another
      await user.click(screen.getByText("relationship.addPeriod"));

      // Now save - should have 2 periods
      await user.click(screen.getByText("common.save"));

      expect(props.onSaveRelationship).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          periods: expect.arrayContaining([
            expect.objectContaining({ status: PartnerStatus.Together }),
            expect.objectContaining({ status: PartnerStatus.Together }),
          ]),
        }),
      );
    });

    it("removes a period in partner editor when multiple exist", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [
        makeRelationship({
          periods: [
            { start_year: 2000, end_year: 2005, status: PartnerStatus.Married },
            { start_year: 2010, end_year: null, status: PartnerStatus.Together },
          ],
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      await user.click(screen.getByText("common.edit"));

      // Should see 2 remove buttons
      const removeBtns = screen.getAllByText("relationship.removePeriod");
      expect(removeBtns).toHaveLength(2);

      // Remove the first period
      await user.click(removeBtns[0]);

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveRelationship).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          periods: [expect.objectContaining({ start_year: 2010, status: PartnerStatus.Together })],
        }),
      );
    });

    it("changes period status in partner editor", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [makeRelationship()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      await user.click(screen.getByText("common.edit"));

      const statusSelect = screen.getByDisplayValue("relationship.status.together");
      await user.selectOptions(statusSelect, PartnerStatus.Married);

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveRelationship).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          periods: [expect.objectContaining({ status: PartnerStatus.Married })],
        }),
      );
    });

    it("hides remove button when only one period", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [makeRelationship()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      await user.click(screen.getByText("common.edit"));

      expect(screen.queryByText("relationship.removePeriod")).not.toBeInTheDocument();
    });

    it("changes start_year in partner period editor", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [
        makeRelationship({
          periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      await user.click(screen.getByText("common.edit"));

      const startYearInput = screen.getByDisplayValue("2000");
      fireEvent.change(startYearInput, { target: { value: "2005" } });

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveRelationship).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          periods: [expect.objectContaining({ start_year: 2005 })],
        }),
      );
    });

    it("changes end_year in partner period editor", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [
        makeRelationship({
          periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      await user.click(screen.getByText("common.edit"));

      // Find the end year input within the period editor (next to the "common.endYear" label)
      const endYearLabel = screen.getByText("common.endYear");
      const endYearInput = endYearLabel.closest("label")!.querySelector("input")!;
      fireEvent.change(endYearInput, { target: { value: "2010" } });

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveRelationship).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          periods: [expect.objectContaining({ end_year: 2010 })],
        }),
      );
    });

    it("clears end_year to null in partner period editor", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      props.relationships = [
        makeRelationship({
          periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Married }],
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /relationship.tab/ }));
      await user.click(screen.getByText("common.edit"));

      const endYearInput = screen.getByDisplayValue("2010");
      fireEvent.change(endYearInput, { target: { value: "" } });

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveRelationship).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          periods: [expect.objectContaining({ end_year: null })],
        }),
      );
    });
  });

  describe("event form edge cases", () => {
    it("opens sub-panel when event card is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      await user.click(screen.getByText("Test Event"));

      // Sub-panel should be visible with form fields
      expect(screen.getByText("trauma.title")).toBeInTheDocument();
      // Back button should be present
      expect(screen.getByLabelText("common.close")).toBeInTheDocument();
    });

    it("returns to card list when back button is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      await user.click(screen.getByText("Test Event"));

      // Click back button
      await user.click(screen.getByLabelText("common.close"));

      // Should return to card list
      expect(screen.queryByText("trauma.title")).not.toBeInTheDocument();
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    it("cancels event editing via cancel button", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      await user.click(screen.getByText("Test Event"));

      // Form should be visible
      expect(screen.getByText("trauma.title")).toBeInTheDocument();

      await user.click(screen.getByText("common.cancel"));

      // Form should close, event display should return
      expect(screen.queryByText("trauma.title")).not.toBeInTheDocument();
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    it("cancels new event form", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      await user.click(screen.getByText("trauma.newEvent"));

      expect(screen.getByText("trauma.title")).toBeInTheDocument();

      await user.click(screen.getByText("common.cancel"));

      expect(screen.queryByText("trauma.title")).not.toBeInTheDocument();
      expect(screen.getByText("trauma.newEvent")).toBeInTheDocument();
    });

    it("deletes event with two-click confirmation", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      await user.click(screen.getByText("Test Event"));

      // First click shows confirmation
      await user.click(screen.getByText("common.delete"));
      expect(props.onDeleteEvent).not.toHaveBeenCalled();
      expect(screen.getByText("trauma.confirmDelete")).toBeInTheDocument();

      // Second click deletes
      await user.click(screen.getByText("trauma.confirmDelete"));
      expect(props.onDeleteEvent).toHaveBeenCalledWith("e1");
    });

    it("shows event approximate date in display mode", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ approximate_date: "1990" })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      expect(screen.getByText("1990")).toBeInTheDocument();
    });

    it("saves event with all fields", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      await user.click(screen.getByText("trauma.newEvent"));

      fireEvent.change(screen.getByRole("textbox", { name: /trauma.title/i }), {
        target: { value: "Flood" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: /trauma.description/i }), {
        target: { value: "Big flood" },
      });
      await user.selectOptions(
        screen.getByRole("combobox", { name: /trauma.category/i }),
        TraumaCategory.War,
      );
      fireEvent.change(screen.getByRole("textbox", { name: /trauma.approximateDate/i }), {
        target: { value: "1999" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: /trauma.tags/i }), {
        target: { value: "nature, water" },
      });

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveEvent).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          title: "Flood",
          description: "Big flood",
          category: TraumaCategory.War,
          approximate_date: "1999",
          tags: ["nature", "water"],
        }),
        expect.arrayContaining(["p1"]),
      );
    });
  });

  describe("trauma event card display", () => {
    it("shows category pill with translated category name", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ category: TraumaCategory.Abuse })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      expect(screen.getByText("trauma.category.abuse")).toBeInTheDocument();
      const pill = screen.getByText("trauma.category.abuse");
      expect(pill).toHaveClass("detail-panel__category-pill");
    });

    it("shows severity bar with correct filled count", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ severity: 7 })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      const severityBar = screen.getByLabelText("7/10");
      expect(severityBar).toBeInTheDocument();
      const dots = severityBar.querySelectorAll(".detail-panel__severity-dot");
      expect(dots).toHaveLength(10);
    });

    it("does not show severity bar when severity is 0", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ severity: 0 })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      expect(screen.queryByLabelText(/\/10/)).not.toBeInTheDocument();
    });

    it("does not show severity bar when severity is undefined", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ severity: undefined as unknown as number })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      expect(screen.queryByLabelText(/\/10/)).not.toBeInTheDocument();
    });

    it("shows date on the first row next to title", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ approximate_date: "1992" })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /trauma.tab/ }));
      const dateEl = screen.getByText("1992");
      expect(dateEl).toHaveClass("detail-panel__event-card-date");
    });
  });

  describe("life event card display", () => {
    it("shows category pill with translated category name", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ category: LifeEventCategory.Education })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      expect(screen.getByText("lifeEvent.category.education")).toBeInTheDocument();
      const pill = screen.getByText("lifeEvent.category.education");
      expect(pill).toHaveClass("detail-panel__category-pill");
    });

    it("shows impact bar with correct filled count", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ impact: 4 })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      const impactBar = screen.getByLabelText("4/10");
      expect(impactBar).toBeInTheDocument();
      const dots = impactBar.querySelectorAll(".detail-panel__severity-dot");
      expect(dots).toHaveLength(10);
    });

    it("does not show impact bar when impact is 0", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ impact: 0 })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      expect(screen.queryByLabelText(/\/10/)).not.toBeInTheDocument();
    });

    it("does not show impact bar when impact is null", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ impact: null })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      expect(screen.queryByLabelText(/\/10/)).not.toBeInTheDocument();
    });
  });

  describe("life events tab", () => {
    it("does not show life event content when person tab is active", () => {
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent()];
      render(<PersonDetailPanel {...props} />);
      expect(screen.queryByText("Graduation")).not.toBeInTheDocument();
    });

    it("shows life events when tab is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      expect(screen.getByText("Graduation")).toBeInTheDocument();
    });

    it("shows life event approximate date", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ approximate_date: "2005" })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      expect(screen.getByText("2005")).toBeInTheDocument();
    });

    it("opens new life event form", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      await user.click(screen.getByText("lifeEvent.newEvent"));

      expect(screen.getByText("lifeEvent.title")).toBeInTheDocument();
    });

    it("saves new life event with null id", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      await user.click(screen.getByText("lifeEvent.newEvent"));

      fireEvent.change(screen.getByRole("textbox", { name: /lifeEvent.title/i }), {
        target: { value: "New Job" },
      });
      await user.click(screen.getByText("common.save"));

      expect(props.onSaveLifeEvent).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ title: "New Job" }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("saves life event with all fields", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      await user.click(screen.getByText("lifeEvent.newEvent"));

      fireEvent.change(screen.getByRole("textbox", { name: /lifeEvent.title/i }), {
        target: { value: "Moved" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: /lifeEvent.description/i }), {
        target: { value: "Moved to city" },
      });
      await user.selectOptions(
        screen.getByRole("combobox", { name: /lifeEvent.category/i }),
        LifeEventCategory.Relocation,
      );
      fireEvent.change(screen.getByRole("textbox", { name: /lifeEvent.approximateDate/i }), {
        target: { value: "2005" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: /lifeEvent.tags/i }), {
        target: { value: "move, city" },
      });

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveLifeEvent).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          title: "Moved",
          description: "Moved to city",
          category: LifeEventCategory.Relocation,
          approximate_date: "2005",
          tags: ["move", "city"],
        }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("edits existing life event", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      await user.click(screen.getByText("Graduation"));

      // Title should be pre-filled
      expect(screen.getByDisplayValue("Graduation")).toBeInTheDocument();

      // Change title
      const titleInput = screen.getByDisplayValue("Graduation");
      fireEvent.change(titleInput, { target: { value: "PhD" } });

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveLifeEvent).toHaveBeenCalledWith(
        "le1",
        expect.objectContaining({ title: "PhD" }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("cancels life event editing", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      await user.click(screen.getByText("Graduation"));
      await user.click(screen.getByText("common.cancel"));

      // Should go back to display mode
      expect(screen.getByText("Graduation")).toBeInTheDocument();
    });

    it("deletes life event with two-click confirmation", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      await user.click(screen.getByText("Graduation"));

      await user.click(screen.getByText("common.delete"));
      expect(props.onDeleteLifeEvent).not.toHaveBeenCalled();
      expect(screen.getByText("lifeEvent.confirmDelete")).toBeInTheDocument();

      await user.click(screen.getByText("lifeEvent.confirmDelete"));
      expect(props.onDeleteLifeEvent).toHaveBeenCalledWith("le1");
    });

    it("cancels new life event form", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      await user.click(screen.getByText("lifeEvent.newEvent"));
      await user.click(screen.getByText("common.cancel"));

      expect(screen.getByText("lifeEvent.newEvent")).toBeInTheDocument();
    });

    it("returns to card list when back button is clicked on life event sub-panel", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /lifeEvent.tab/ }));
      await user.click(screen.getByText("Graduation"));

      await user.click(screen.getByLabelText("common.close"));

      expect(screen.getByText("Graduation")).toBeInTheDocument();
      expect(screen.queryByText("lifeEvent.title")).not.toBeInTheDocument();
    });
  });

  describe("classifications tab", () => {
    it("does not show classification content when person tab is active", () => {
      const props = defaultProps();
      props.classifications = [makeClassification()];
      render(<PersonDetailPanel {...props} />);
      expect(screen.queryByText("dsm.anxiety")).not.toBeInTheDocument();
    });

    it("shows classifications when tab is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [makeClassification()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      expect(screen.getByText("dsm.anxiety")).toBeInTheDocument();
    });

    it("shows classification status pill", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          status: "diagnosed",
          diagnosis_year: 2015,
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      const pill = screen.getByText("classification.status.diagnosed");
      expect(pill).toHaveClass("detail-panel__status-pill");
      expect(pill).toHaveClass("detail-panel__status-pill--diagnosed");
    });

    it("shows period summary from diagnosis year", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          status: "diagnosed",
          diagnosis_year: 2015,
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      expect(screen.getByText(/2015.*common\.ongoing/)).toBeInTheDocument();
    });

    it("shows period summary from explicit periods", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          periods: [{ start_year: 2010, end_year: 2018 }],
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      expect(screen.getByText("2010-2018")).toBeInTheDocument();
    });

    it("shows ongoing period summary", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          periods: [{ start_year: 2020, end_year: null }],
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      expect(screen.getByText(/2020.*common\.ongoing/)).toBeInTheDocument();
    });

    it("shows subcategory as card title with category in meta", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          dsm_category: "neurodevelopmental",
          dsm_subcategory: "adhd",
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      // Subcategory is the card title
      const title = screen.getByText("dsm.sub.adhd");
      expect(title).toHaveClass("detail-panel__event-card-title");
      // Category shown in meta area
      expect(screen.getByText("dsm.neurodevelopmental")).toBeInTheDocument();
    });

    it("opens new classification form", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      expect(screen.getByText("classification.category")).toBeInTheDocument();
    });

    it("saves new classification", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          dsm_category: "anxiety",
          status: "suspected",
        }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("edits existing classification", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [makeClassification()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("dsm.anxiety"));

      // Form should be visible in sub-panel
      expect(screen.getByText("classification.category")).toBeInTheDocument();

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        "cls1",
        expect.objectContaining({ dsm_category: "anxiety" }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("cancels classification editing", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [makeClassification()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("dsm.anxiety"));
      await user.click(screen.getByText("common.cancel"));

      expect(screen.getByText("dsm.anxiety")).toBeInTheDocument();
    });

    it("deletes classification with two-click confirmation", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [makeClassification()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("dsm.anxiety"));

      await user.click(screen.getByText("common.delete"));
      expect(props.onDeleteClassification).not.toHaveBeenCalled();
      expect(screen.getByText("classification.confirmDelete")).toBeInTheDocument();

      await user.click(screen.getByText("classification.confirmDelete"));
      expect(props.onDeleteClassification).toHaveBeenCalledWith("cls1");
    });

    it("cancels new classification form", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));
      await user.click(screen.getByText("common.cancel"));

      expect(screen.getByText("classification.newClassification")).toBeInTheDocument();
    });

    it("returns to card list when back button is clicked on classification sub-panel", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [makeClassification()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("dsm.anxiety"));

      await user.click(screen.getByLabelText("common.close"));

      expect(screen.getByText("dsm.anxiety")).toBeInTheDocument();
      expect(screen.queryByText("classification.category")).not.toBeInTheDocument();
    });

    it("switches to diagnosed status and shows diagnosis year", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      // Switch to diagnosed
      const diagnosedRadio = screen.getByRole("radio", {
        name: /classification.status.diagnosed/i,
      });
      await user.click(diagnosedRadio);

      // Diagnosis year field should appear
      const yearInput = screen.getByRole("spinbutton", {
        name: /classification.diagnosisYear/i,
      });
      fireEvent.change(yearInput, { target: { value: "2020" } });

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          status: "diagnosed",
          diagnosis_year: 2020,
        }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("saves classification with notes", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      const notesTextarea = screen.getByRole("textbox", {
        name: /classification.notes/i,
      });
      fireEvent.change(notesTextarea, { target: { value: "Some clinical notes" } });
      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ notes: "Some clinical notes" }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("adds and removes classification periods", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      // Add a period
      await user.click(screen.getByText("classification.addPeriod"));

      // Should see a remove button
      expect(screen.getByText("classification.removePeriod")).toBeInTheDocument();

      // Remove it
      await user.click(screen.getByText("classification.removePeriod"));

      // Period row gone
      expect(screen.queryByText("classification.removePeriod")).not.toBeInTheDocument();

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ periods: [] }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("changes DSM category", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      // Change category to depressive
      const categorySelect = screen.getByDisplayValue("dsm.anxiety");
      await user.selectOptions(categorySelect, "depressive");

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ dsm_category: "depressive" }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("shows subcategories as options within optgroup", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      // The select should contain subcategory options (e.g. ADHD under neurodevelopmental)
      const categorySelect = screen.getByDisplayValue("dsm.anxiety");
      const adhdOption = within(categorySelect).getByText(/dsm\.sub\.adhd/);
      expect(adhdOption).toBeInTheDocument();
      expect(adhdOption.getAttribute("value")).toBe("neurodevelopmental::adhd");
    });

    it("filters DSM categories by search text", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      // Type search text - since t() returns the key, search for "anxiety"
      const searchInput = screen.getByPlaceholderText("classification.searchPlaceholder");
      fireEvent.change(searchInput, { target: { value: "anxiety" } });

      // The select should now only show matching categories
      const categorySelect = screen.getByDisplayValue("dsm.anxiety");
      const options = within(categorySelect).getAllByRole("option");
      // Should be filtered to only categories containing "anxiety"
      expect(options.length).toBeLessThan(22);
    });

    it("changes classification period start_year", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      // Add a period
      await user.click(screen.getByText("classification.addPeriod"));

      // The period should have the current year as start_year
      const currentYear = new Date().getFullYear();
      const startYearInput = screen.getByDisplayValue(String(currentYear));
      fireEvent.change(startYearInput, { target: { value: "2015" } });

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          periods: [expect.objectContaining({ start_year: 2015 })],
        }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("changes classification period end_year", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      // Add a period
      await user.click(screen.getByText("classification.addPeriod"));

      // Find end year input within the period row (next to "common.endYear" label)
      const endYearLabel = screen.getByText("common.endYear");
      const endYearInput = endYearLabel.closest("label")!.querySelector("input")!;
      fireEvent.change(endYearInput, { target: { value: "2020" } });

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          periods: [expect.objectContaining({ end_year: 2020 })],
        }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("clears classification period end_year to null", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          periods: [{ start_year: 2010, end_year: 2020 }],
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("dsm.anxiety"));

      // Clear the end_year
      const endYearInput = screen.getByDisplayValue("2020");
      fireEvent.change(endYearInput, { target: { value: "" } });

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        "cls1",
        expect.objectContaining({
          periods: [expect.objectContaining({ start_year: 2010, end_year: null })],
        }),
        expect.arrayContaining(["p1"]),
      );
    });

    it("links classification to multiple persons", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByRole("tab", { name: /classification.tab/ }));
      await user.click(screen.getByText("classification.newClassification"));

      // Expand PersonLinkField and add Bob
      await user.click(screen.getByText(/link/i));
      const bobCheckbox = screen.getByRole("checkbox", { name: "Bob" });
      await user.click(bobCheckbox);

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        null,
        expect.any(Object),
        expect.arrayContaining(["p1", "p2"]),
      );
    });
  });
});
