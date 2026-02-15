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

  it("has relationships section collapsed by default", () => {
    const props = defaultProps();
    props.relationships = [makeRelationship()];
    render(<PersonDetailPanel {...props} />);
    expect(screen.queryByText("relationship.type.partner")).not.toBeInTheDocument();
  });

  it("has events section collapsed by default", () => {
    const props = defaultProps();
    props.events = [makeEvent()];
    render(<PersonDetailPanel {...props} />);
    expect(screen.queryByText("Test Event")).not.toBeInTheDocument();
  });

  it("toggles relationships section on click", async () => {
    const user = userEvent.setup();
    const bob = makePerson({ id: "p2", name: "Bob" });
    const props = defaultProps();
    props.allPersons.set("p2", bob);
    props.relationships = [makeRelationship()];
    render(<PersonDetailPanel {...props} />);

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

    await user.click(screen.getByText(/trauma.events/));
    await user.click(screen.getByText("trauma.newEvent"));

    expect(screen.getByText("trauma.title")).toBeInTheDocument();
  });

  it("calls onSaveEvent with null id for new events", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PersonDetailPanel {...props} />);

    await user.click(screen.getByText(/trauma.events/));
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

    await user.click(screen.getByText(/trauma.events/));
    await user.click(screen.getByText("common.edit"));

    const checkboxes = screen.getAllByRole("checkbox");
    const bobCheckbox = checkboxes.find((cb) => cb.closest("label")?.textContent?.includes("Bob"));
    expect(bobCheckbox).toBeDefined();
    await user.click(bobCheckbox!);

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

    await user.click(screen.getByText(/trauma.events/));
    await user.click(screen.getByText("common.edit"));

    const checkboxes = screen.getAllByRole("checkbox");
    const aliceCheckbox = checkboxes.find((cb) =>
      cb.closest("label")?.textContent?.includes("Alice"),
    );
    expect(aliceCheckbox).toBeDefined();
    expect(aliceCheckbox).toBeChecked();
    await user.click(aliceCheckbox!);

    expect(aliceCheckbox).toBeChecked();
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

    it("collapses person section on toggle click", async () => {
      const user = userEvent.setup();
      render(<PersonDetailPanel {...defaultProps()} />);

      expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
      await user.click(screen.getByText(/person.details/));
      expect(screen.queryByDisplayValue("Alice")).not.toBeInTheDocument();
    });
  });

  describe("relationship display", () => {
    it("shows empty message when no relationships or inferred siblings", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/relationship.relationships/));
      expect(screen.getByText("---")).toBeInTheDocument();
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

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
      expect(screen.getByText("relationship.type.half_sibling")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText(/relationship.viaParent/)).toBeInTheDocument();
    });

    it("shows ? for unknown other person in relationship", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      // p2 is not in allPersons
      props.relationships = [makeRelationship()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
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

      await user.click(screen.getByText(/relationship.relationships/));
      await user.click(screen.getByText("common.edit"));

      expect(screen.queryByText("relationship.removePeriod")).not.toBeInTheDocument();
    });
  });

  describe("event form edge cases", () => {
    it("cancels event editing", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/trauma.events/));
      await user.click(screen.getByText("common.edit"));

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

      await user.click(screen.getByText(/trauma.events/));
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

      await user.click(screen.getByText(/trauma.events/));
      await user.click(screen.getByText("common.edit"));

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

      await user.click(screen.getByText(/trauma.events/));
      expect(screen.getByText("1990")).toBeInTheDocument();
    });

    it("saves event with all fields", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/trauma.events/));
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

  describe("life events section", () => {
    it("has life events section collapsed by default", () => {
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent()];
      render(<PersonDetailPanel {...props} />);
      expect(screen.queryByText("Graduation")).not.toBeInTheDocument();
    });

    it("toggles life events section on click", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/lifeEvent.events/));
      expect(screen.getByText("Graduation")).toBeInTheDocument();
    });

    it("shows life event approximate date", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ approximate_date: "2005" })];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/lifeEvent.events/));
      expect(screen.getByText("2005")).toBeInTheDocument();
    });

    it("opens new life event form", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/lifeEvent.events/));
      await user.click(screen.getByText("lifeEvent.newEvent"));

      expect(screen.getByText("lifeEvent.title")).toBeInTheDocument();
    });

    it("saves new life event with null id", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/lifeEvent.events/));
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

      await user.click(screen.getByText(/lifeEvent.events/));
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

      await user.click(screen.getByText(/lifeEvent.events/));
      await user.click(screen.getByText("common.edit"));

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

      await user.click(screen.getByText(/lifeEvent.events/));
      await user.click(screen.getByText("common.edit"));
      await user.click(screen.getByText("common.cancel"));

      // Should go back to display mode
      expect(screen.getByText("Graduation")).toBeInTheDocument();
    });

    it("deletes life event with two-click confirmation", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/lifeEvent.events/));
      await user.click(screen.getByText("common.edit"));

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

      await user.click(screen.getByText(/lifeEvent.events/));
      await user.click(screen.getByText("lifeEvent.newEvent"));
      await user.click(screen.getByText("common.cancel"));

      expect(screen.getByText("lifeEvent.newEvent")).toBeInTheDocument();
    });
  });

  describe("classifications section", () => {
    it("has classifications section collapsed by default", () => {
      const props = defaultProps();
      props.classifications = [makeClassification()];
      render(<PersonDetailPanel {...props} />);
      expect(screen.queryByText("dsm.anxiety")).not.toBeInTheDocument();
    });

    it("toggles classifications section on click", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [makeClassification()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/classification.classifications/));
      expect(screen.getByText("dsm.anxiety")).toBeInTheDocument();
    });

    it("shows classification status and diagnosis year", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          status: "diagnosed",
          diagnosis_year: 2015,
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/classification.classifications/));
      expect(screen.getByText(/classification.status.diagnosed.*2015/)).toBeInTheDocument();
    });

    it("shows classification with subcategory", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          dsm_category: "neurodevelopmental",
          dsm_subcategory: "adhd",
        }),
      ];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/classification.classifications/));
      expect(screen.getByText(/dsm.neurodevelopmental.*dsm.sub.adhd/)).toBeInTheDocument();
    });

    it("opens new classification form", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/classification.classifications/));
      await user.click(screen.getByText("classification.newClassification"));

      expect(screen.getByText("classification.category")).toBeInTheDocument();
    });

    it("saves new classification", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/classification.classifications/));
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

      await user.click(screen.getByText(/classification.classifications/));
      await user.click(screen.getByText("common.edit"));

      // Form should be visible
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

      await user.click(screen.getByText(/classification.classifications/));
      await user.click(screen.getByText("common.edit"));
      await user.click(screen.getByText("common.cancel"));

      expect(screen.getByText("dsm.anxiety")).toBeInTheDocument();
    });

    it("deletes classification with two-click confirmation", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [makeClassification()];
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/classification.classifications/));
      await user.click(screen.getByText("common.edit"));

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

      await user.click(screen.getByText(/classification.classifications/));
      await user.click(screen.getByText("classification.newClassification"));
      await user.click(screen.getByText("common.cancel"));

      expect(screen.getByText("classification.newClassification")).toBeInTheDocument();
    });

    it("switches to diagnosed status and shows diagnosis year", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/classification.classifications/));
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

      await user.click(screen.getByText(/classification.classifications/));
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

      await user.click(screen.getByText(/classification.classifications/));
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

      await user.click(screen.getByText(/classification.classifications/));
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

    it("shows subcategory select for categories with subcategories", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/classification.classifications/));
      await user.click(screen.getByText("classification.newClassification"));

      // Change to neurodevelopmental (has subcategories)
      const categorySelect = screen.getByDisplayValue("dsm.anxiety");
      await user.selectOptions(categorySelect, "neurodevelopmental");

      // Subcategory select should appear
      expect(screen.getByText("classification.subcategory")).toBeInTheDocument();
    });

    it("filters DSM categories by search text", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/classification.classifications/));
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

    it("links classification to multiple persons", async () => {
      const user = userEvent.setup();
      const bob = makePerson({ id: "p2", name: "Bob" });
      const props = defaultProps();
      props.allPersons.set("p2", bob);
      render(<PersonDetailPanel {...props} />);

      await user.click(screen.getByText(/classification.classifications/));
      await user.click(screen.getByText("classification.newClassification"));

      // Find and check Bob's checkbox
      const checkboxes = screen.getAllByRole("checkbox");
      const bobCheckbox = checkboxes.find((cb) =>
        cb.closest("label")?.textContent?.includes("Bob"),
      );
      expect(bobCheckbox).toBeDefined();
      await user.click(bobCheckbox!);

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledWith(
        null,
        expect.any(Object),
        expect.arrayContaining(["p1", "p2"]),
      );
    });
  });
});
