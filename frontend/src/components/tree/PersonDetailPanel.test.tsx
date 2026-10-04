import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CREATE_NEW } from "../../hooks/useLifelineEditing";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import {
  LifeEventCategory,
  PartnerStatus,
  RelationshipType,
  TraumaCategory,
  TurningPointCategory,
} from "../../types/domain";
import { PersonDetailPanel } from "./PersonDetailPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Mirrors i18next's context suffix for the gendered glance keys.
    t: (key: string, opts?: { context?: string; name?: string }) =>
      opts?.context === "female" || opts?.context === "male" ? `${key}_${opts.context}` : key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../lib/reflectionPrompts", () => ({
  pickPersonPromptIndex: () => 1,
  personPromptText: (_t: unknown, _index: number, name: string) => `Reflect on ${name}`,
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

function makeTurningPoint(overrides: Partial<DecryptedTurningPoint> = {}): DecryptedTurningPoint {
  return {
    id: "tp1",
    title: "Therapy Start",
    description: "Started therapy",
    category: TurningPointCategory.Recovery,
    approximate_date: "2010",
    significance: 8,
    tags: ["healing"],
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
  turningPoints: [] as DecryptedTurningPoint[],
  classifications: [] as DecryptedClassification[],
  allPersons: new Map([["p1", makePerson()]]),
  handlers: {
    onSavePerson: vi.fn(),
    onDeletePerson: vi.fn(),
    onSaveRelationship: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
  },
  entityHandlers: {
    onSaveEvent: vi.fn(),
    onDeleteEvent: vi.fn(),
    onSaveLifeEvent: vi.fn(),
    onDeleteLifeEvent: vi.fn(),
    onSaveTurningPoint: vi.fn(),
    onDeleteTurningPoint: vi.fn(),
    onSaveClassification: vi.fn(),
    onDeleteClassification: vi.fn(),
  },
});

function makePattern(overrides: Partial<DecryptedPattern> = {}): DecryptedPattern {
  return {
    id: "pat1",
    name: "Silence after loss",
    description: "",
    color: "#818cf8",
    linked_entities: [],
    person_ids: ["p1"],
    ...overrides,
  };
}

function lifelineRows() {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

describe("PersonDetailPanel", () => {
  describe("header", () => {
    it("shows the name as the page heading", () => {
      render(<PersonDetailPanel {...defaultProps()} />);
      expect(screen.getByRole("heading", { level: 2, name: "Alice" })).toBeInTheDocument();
    });

    it("labels the page with the person's name", () => {
      render(<PersonDetailPanel {...defaultProps()} />);
      expect(screen.getByRole("complementary", { name: "Alice" })).toBeInTheDocument();
    });

    it("shows the year range for someone who died", () => {
      const props = defaultProps();
      props.person = makePerson({ birth_year: 1927, death_year: 2011 });
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByText("1927 - 2011")).toBeInTheDocument();
    });

    it("shows the birth line for someone living", () => {
      render(<PersonDetailPanel {...defaultProps()} />);
      expect(screen.getByText("personPage.born")).toBeInTheDocument();
    });

    it("shows the death line when only the death year is known", () => {
      const props = defaultProps();
      props.person = makePerson({ birth_year: null, death_year: 1990 });
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByText("personPage.died")).toBeInTheDocument();
    });

    it("mentions adoption", () => {
      const props = defaultProps();
      props.person = makePerson({ birth_year: null, is_adopted: true });
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByText("person.isadopted")).toBeInTheDocument();
    });

    it("calls onClose from the close button", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);
      await user.click(screen.getByRole("button", { name: "common.close" }));
      expect(props.handlers.onClose).toHaveBeenCalledOnce();
    });
  });

  describe("glance line", () => {
    it("says when the person is not connected to anyone", () => {
      render(<PersonDetailPanel {...defaultProps()} />);
      expect(screen.getByText("personPage.glance.none")).toBeInTheDocument();
    });

    it("names parents with the gendered phrase", () => {
      const props = defaultProps();
      props.allPersons = new Map([
        ["p1", makePerson()],
        ["p2", makePerson({ id: "p2", name: "Margriet" })],
      ]);
      props.relationships = [
        makeRelationship({
          type: RelationshipType.BiologicalParent,
          source_person_id: "p2",
          target_person_id: "p1",
        }),
      ];
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByText(/personPage\.glance\.childOf_female/)).toBeInTheDocument();
      expect(screen.getByText("Margriet")).toBeInTheDocument();
    });

    it("falls back to the neutral phrase without a known gender", () => {
      const props = defaultProps();
      props.person = makePerson({ gender: "" });
      props.allPersons = new Map([
        ["p1", props.person],
        ["p2", makePerson({ id: "p2", name: "Kid" })],
      ]);
      props.relationships = [
        makeRelationship({
          type: RelationshipType.BiologicalParent,
          source_person_id: "p1",
          target_person_id: "p2",
        }),
      ];
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByText(/personPage\.glance\.parentOf\b/)).toBeInTheDocument();
    });

    it("lists several people in one phrase", () => {
      const props = defaultProps();
      props.allPersons = new Map([
        ["p1", makePerson()],
        ["k1", makePerson({ id: "k1", name: "Pieter" })],
        ["k2", makePerson({ id: "k2", name: "Anna" })],
      ]);
      props.relationships = [
        makeRelationship({
          id: "r1",
          type: RelationshipType.BiologicalParent,
          source_person_id: "p1",
          target_person_id: "k1",
        }),
        makeRelationship({
          id: "r2",
          type: RelationshipType.BiologicalParent,
          source_person_id: "p1",
          target_person_id: "k2",
        }),
      ];
      render(<PersonDetailPanel {...props} />);
      const glance = screen.getByText(/personPage\.glance\.parentOf_female/);
      expect(glance).toHaveTextContent("Pieter and Anna.");
    });

    it("opens another person's page from a name", async () => {
      const user = userEvent.setup();
      const onSelectPerson = vi.fn();
      const props = defaultProps();
      props.allPersons = new Map([
        ["p1", makePerson()],
        ["p2", makePerson({ id: "p2", name: "Hendrik" })],
      ]);
      props.relationships = [
        makeRelationship({
          periods: [{ start_year: 1949, end_year: null, status: PartnerStatus.Married }],
        }),
      ];
      render(<PersonDetailPanel {...props} onSelectPerson={onSelectPerson} />);
      expect(screen.getByText(/personPage\.glance\.marriedTo/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Hendrik" }));
      expect(onSelectPerson).toHaveBeenCalledWith("p2");
    });

    it("shows names as plain text without a selection handler", () => {
      const props = defaultProps();
      props.allPersons = new Map([
        ["p1", makePerson()],
        ["p2", makePerson({ id: "p2", name: "Hendrik" })],
      ]);
      props.relationships = [makeRelationship()];
      render(<PersonDetailPanel {...props} />);
      expect(screen.queryByRole("button", { name: "Hendrik" })).not.toBeInTheDocument();
    });

    it("shows ? for a person missing from the tree", () => {
      const props = defaultProps();
      props.relationships = [makeRelationship({ target_person_id: "gone" })];
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByText(/personPage\.glance\.partnerOf/)).toHaveTextContent("?");
    });
  });

  describe("patterns", () => {
    it("shows the patterns this person belongs to", () => {
      render(
        <PersonDetailPanel
          {...defaultProps()}
          patterns={[makePattern(), makePattern({ id: "pat2", name: "Other", person_ids: ["p9"] })]}
          onFocusPattern={vi.fn()}
        />,
      );
      expect(screen.getByRole("button", { name: "Silence after loss" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Other" })).not.toBeInTheDocument();
    });

    it("focuses a pattern and clears the focus when pressed again", async () => {
      const user = userEvent.setup();
      const onFocusPattern = vi.fn();
      const { rerender } = render(
        <PersonDetailPanel
          {...defaultProps()}
          patterns={[makePattern()]}
          onFocusPattern={onFocusPattern}
        />,
      );
      const chip = screen.getByRole("button", { name: "Silence after loss" });
      expect(chip).toHaveAttribute("aria-pressed", "false");
      await user.click(chip);
      expect(onFocusPattern).toHaveBeenLastCalledWith("pat1");

      rerender(
        <PersonDetailPanel
          {...defaultProps()}
          patterns={[makePattern()]}
          focusedPatternId="pat1"
          onFocusPattern={onFocusPattern}
        />,
      );
      const pressed = screen.getByRole("button", { name: "Silence after loss" });
      expect(pressed).toHaveAttribute("aria-pressed", "true");
      await user.click(pressed);
      expect(onFocusPattern).toHaveBeenLastCalledWith(null);
    });

    it("disables the chips without a focus handler", () => {
      render(<PersonDetailPanel {...defaultProps()} patterns={[makePattern()]} />);
      expect(screen.getByRole("button", { name: "Silence after loss" })).toBeDisabled();
    });
  });

  describe("lifeline", () => {
    it("says nothing is recorded yet for an empty life", () => {
      render(<PersonDetailPanel {...defaultProps()} />);
      expect(screen.getByText("personPage.nothingYet")).toBeInTheDocument();
    });

    it("reads every kind in year order between birth and death", () => {
      const props = defaultProps();
      props.person = makePerson({ birth_year: 1927, death_year: 2011 });
      props.events = [makeEvent({ title: "Hunger winter", approximate_date: "1944" })];
      props.lifeEvents = [makeLifeEvent({ title: "Married", approximate_date: "1949" })];
      props.turningPoints = [
        makeTurningPoint({ title: "Told the story", approximate_date: "1997" }),
      ];
      props.classifications = [
        makeClassification({ periods: [{ start_year: 1958, end_year: 1964 }] }),
      ];
      render(<PersonDetailPanel {...props} />);
      const text = lifelineRows().map((row) => row.textContent);
      expect(text[0]).toContain("personPage.birth");
      expect(text[1]).toContain("Hunger winter");
      expect(text[2]).toContain("Married");
      expect(text[3]).toContain("dsm.anxiety");
      expect(text.at(-1)).toContain("personPage.death");
      expect(text.some((t) => t?.includes("Told the story"))).toBe(true);
      expect(screen.getByText("personPage.entries")).toBeInTheDocument();
    });

    it("shows the category and other people involved", () => {
      const props = defaultProps();
      props.allPersons = new Map([
        ["p1", makePerson()],
        ["p2", makePerson({ id: "p2", name: "Hendrik" })],
      ]);
      props.events = [makeEvent({ person_ids: ["p1", "p2"] })];
      render(<PersonDetailPanel {...props} />);
      expect(
        screen.getByText("personPage.kind.trauma_event, trauma.category.loss, personPage.with"),
      ).toBeInTheDocument();
    });

    it("shows a classification's status and years", () => {
      const props = defaultProps();
      props.classifications = [
        makeClassification({ periods: [{ start_year: 2001, end_year: null }] }),
      ];
      render(<PersonDetailPanel {...props} />);
      expect(
        screen.getByText("classification.status.suspected, 2001, common.ongoing"),
      ).toBeInTheDocument();
    });

    it("shows the description while closed", () => {
      const props = defaultProps();
      props.events = [makeEvent({ description: "Nobody spoke of it" })];
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByText("Nobody spoke of it")).toBeInTheDocument();
    });

    it("names a long silence and offers to add something", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [
        makeEvent({ id: "a", approximate_date: "1971" }),
        makeEvent({ id: "b", approximate_date: "1989" }),
      ];
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByText(/personPage\.gap/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "personPage.addSomething" }));
      expect(
        screen.getByRole("button", { name: "personPage.kind.life_event" }),
      ).toBeInTheDocument();
    });

    it("lists entries without a year separately", () => {
      const props = defaultProps();
      props.events = [makeEvent({ title: "Childhood", approximate_date: "childhood" })];
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByText("personPage.undated")).toBeInTheDocument();
      expect(screen.getByText("Childhood")).toBeInTheDocument();
    });

    it("falls back to a placeholder for an untitled entry", () => {
      const props = defaultProps();
      props.events = [makeEvent({ title: "" })];
      render(<PersonDetailPanel {...props} />);
      expect(screen.getByText("personPage.untitled")).toBeInTheDocument();
    });
  });

  describe("editing in place", () => {
    it("opens and closes an entry's form", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ title: "Loss" })];
      render(<PersonDetailPanel {...props} />);
      const entry = screen.getByRole("button", { name: /Loss/ });
      await user.click(entry);
      expect(entry).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByDisplayValue("Loss")).toBeInTheDocument();
      await user.click(entry);
      expect(screen.queryByDisplayValue("Loss")).not.toBeInTheDocument();
    });

    it.each([
      ["trauma event", "events", () => makeEvent({ title: "Entry" }), "onSaveEvent", "e1"],
      [
        "life event",
        "lifeEvents",
        () => makeLifeEvent({ title: "Entry" }),
        "onSaveLifeEvent",
        "le1",
      ],
      [
        "turning point",
        "turningPoints",
        () => makeTurningPoint({ title: "Entry" }),
        "onSaveTurningPoint",
        "tp1",
      ],
    ] as const)("autosaves an edited %s with its id", async (_label, field, make, handler, id) => {
      const user = userEvent.setup();
      const props = defaultProps();
      (props as Record<string, unknown>)[field] = [make()];
      render(<PersonDetailPanel {...props} />);
      await user.click(screen.getByRole("button", { name: /Entry/ }));
      const input = screen.getByDisplayValue("Entry");
      await user.clear(input);
      await user.type(input, "Renamed");
      await user.tab();
      expect(props.entityHandlers[handler]).toHaveBeenCalledWith(
        id,
        expect.objectContaining({ title: "Renamed" }),
        ["p1"],
      );
    });

    it("opens a classification's form", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [makeClassification({ diagnosis_year: 2001 })];
      render(<PersonDetailPanel {...props} />);
      await user.click(screen.getByRole("button", { name: /dsm\.anxiety/ }));
      expect(screen.getByText("common.delete")).toBeInTheDocument();
    });

    it.each([
      ["events", () => makeEvent(), "onDeleteEvent", "e1", /Test Event/],
      ["lifeEvents", () => makeLifeEvent(), "onDeleteLifeEvent", "le1", /Graduation/],
      ["turningPoints", () => makeTurningPoint(), "onDeleteTurningPoint", "tp1", /Therapy Start/],
      [
        "classifications",
        () => makeClassification({ diagnosis_year: 2001 }),
        "onDeleteClassification",
        "cls1",
        /dsm\.anxiety/,
      ],
    ] as const)(
      "deletes from %s after confirming and closes the form",
      async (field, make, handler, id, name) => {
        const user = userEvent.setup();
        const props = defaultProps();
        (props as Record<string, unknown>)[field] = [make()];
        render(<PersonDetailPanel {...props} />);
        const entry = screen.getByRole("button", { name });
        await user.click(entry);
        await user.click(screen.getByText("common.delete"));
        await user.click(screen.getByRole("button", { name: "common.delete" }));
        expect(props.entityHandlers[handler]).toHaveBeenCalledWith(id);
        expect(entry).toHaveAttribute("aria-expanded", "false");
      },
    );

    it("opens the requested entity from initialSection and initialEntityId", () => {
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent()];
      render(<PersonDetailPanel {...props} initialSection="life_event" initialEntityId="le1" />);
      expect(screen.getByDisplayValue("Graduation")).toBeInTheDocument();
    });
  });

  describe("adding to a life", () => {
    it("offers the four kinds", async () => {
      const user = userEvent.setup();
      render(<PersonDetailPanel {...defaultProps()} />);
      const add = screen.getByRole("button", { name: /personPage\.addTo/ });
      expect(add).toHaveAttribute("aria-expanded", "false");
      await user.click(add);
      expect(add).toHaveAttribute("aria-expanded", "true");
      for (const kind of ["trauma_event", "life_event", "classification", "turning_point"]) {
        expect(screen.getByRole("button", { name: `personPage.kind.${kind}` })).toBeInTheDocument();
      }
    });

    it.each([
      ["trauma_event", "onSaveEvent", "trauma.title"],
      ["life_event", "onSaveLifeEvent", "lifeEvent.title"],
      ["turning_point", "onSaveTurningPoint", "turningPoint.titleField"],
    ] as const)(
      "adds a new %s with a null id and closes the form",
      async (kind, handler, label) => {
        const user = userEvent.setup();
        const props = defaultProps();
        render(<PersonDetailPanel {...props} />);
        await user.click(screen.getByRole("button", { name: /personPage\.addTo/ }));
        await user.click(screen.getByRole("button", { name: `personPage.kind.${kind}` }));
        expect(screen.getByText(`personPage.new.${kind}`)).toBeInTheDocument();
        await user.type(screen.getByLabelText(label), "Something new");
        await user.click(screen.getByRole("button", { name: "common.add" }));
        expect(props.entityHandlers[handler]).toHaveBeenCalledWith(
          null,
          expect.objectContaining({ title: "Something new" }),
          ["p1"],
        );
        expect(screen.queryByText(`personPage.new.${kind}`)).not.toBeInTheDocument();
      },
    );

    it("adds a new classification with a null id", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);
      await user.click(screen.getByRole("button", { name: /personPage\.addTo/ }));
      await user.click(screen.getByRole("button", { name: "personPage.kind.classification" }));
      await user.click(screen.getByRole("button", { name: "common.add" }));
      expect(props.entityHandlers.onSaveClassification).toHaveBeenCalledWith(
        null,
        expect.any(Object),
        ["p1"],
      );
    });

    it("cancels a new entry", async () => {
      const user = userEvent.setup();
      render(<PersonDetailPanel {...defaultProps()} />);
      await user.click(screen.getByRole("button", { name: /personPage\.addTo/ }));
      await user.click(screen.getByRole("button", { name: "personPage.kind.trauma_event" }));
      await user.click(screen.getByRole("button", { name: "common.cancel" }));
      expect(screen.queryByText("personPage.new.trauma_event")).not.toBeInTheDocument();
    });

    it("opens a new form for the context menu's create shortcut", () => {
      render(
        <PersonDetailPanel
          {...defaultProps()}
          initialSection="turning_point"
          initialEntityId={CREATE_NEW}
        />,
      );
      expect(screen.getByText("personPage.new.turning_point")).toBeInTheDocument();
    });
  });

  describe("reflection", () => {
    it("offers a prompt that opens the journal linked to the person", async () => {
      const user = userEvent.setup();
      const onOpenJournal = vi.fn();
      render(
        <PersonDetailPanel
          {...defaultProps()}
          showReflectionPrompts
          onOpenJournal={onOpenJournal}
        />,
      );
      expect(screen.getByText("Reflect on Alice")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "personPage.writeJournal" }));
      expect(onOpenJournal).toHaveBeenCalledWith("Reflect on Alice", {
        entity_type: "person",
        entity_id: "p1",
      });
    });

    it("is hidden when prompts are off", () => {
      render(
        <PersonDetailPanel
          {...defaultProps()}
          showReflectionPrompts={false}
          onOpenJournal={vi.fn()}
        />,
      );
      expect(screen.queryByText("Reflect on Alice")).not.toBeInTheDocument();
    });

    it("is hidden without a journal handler", () => {
      render(<PersonDetailPanel {...defaultProps()} showReflectionPrompts />);
      expect(screen.queryByText("Reflect on Alice")).not.toBeInTheDocument();
    });
  });

  describe("folded sections", () => {
    function fold(name: string) {
      return screen.getByText(name).closest("details") as HTMLDetailsElement;
    }

    it("keeps relationships and details folded by default", () => {
      render(<PersonDetailPanel {...defaultProps()} />);
      expect(fold("relationship.tab").open).toBe(false);
      expect(fold("personPage.details").open).toBe(false);
    });

    it("opens the relationships section on request", () => {
      render(<PersonDetailPanel {...defaultProps()} initialSection="relationships" />);
      expect(fold("relationship.tab").open).toBe(true);
    });

    it("opens the details section on request", () => {
      render(<PersonDetailPanel {...defaultProps()} initialSection="person" />);
      expect(fold("personPage.details").open).toBe(true);
    });

    it("follows a later request while open", () => {
      const props = defaultProps();
      const { rerender } = render(<PersonDetailPanel {...props} />);
      rerender(<PersonDetailPanel {...props} initialSection="relationships" />);
      expect(fold("relationship.tab").open).toBe(true);
    });

    it("tracks the user's toggling", () => {
      render(<PersonDetailPanel {...defaultProps()} />);
      const details = fold("personPage.details");
      details.open = true;
      fireEvent(details, new Event("toggle"));
      expect(details.open).toBe(true);
      details.open = false;
      fireEvent(details, new Event("toggle"));
      expect(details.open).toBe(false);
    });

    it("holds the person form and the relationship list", () => {
      const props = defaultProps();
      render(<PersonDetailPanel {...props} />);
      expect(within(fold("personPage.details")).getByDisplayValue("Alice")).toBeInTheDocument();
      expect(within(fold("relationship.tab")).getByText("relationship.none")).toBeInTheDocument();
    });
  });

  describe("switching people", () => {
    it("starts over with folds and forms closed", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ title: "Loss" })];
      const { rerender } = render(<PersonDetailPanel {...props} initialSection="person" />);
      await user.click(screen.getByRole("button", { name: /Loss/ }));
      expect(screen.getByDisplayValue("Loss")).toBeInTheDocument();

      const bob = makePerson({ id: "p2", name: "Bob" });
      rerender(
        <PersonDetailPanel {...props} person={bob} events={props.events} initialSection={null} />,
      );
      expect(screen.queryByDisplayValue("Loss")).not.toBeInTheDocument();
      const details = screen.getByText("personPage.details").closest("details");
      expect(details?.open).toBe(false);
    });

    it("opens the details of a newly added person", () => {
      const props = defaultProps();
      const { rerender } = render(<PersonDetailPanel {...props} initialSection="person" />);
      const fresh = makePerson({ id: "p3", name: "New person" });
      rerender(<PersonDetailPanel {...props} person={fresh} initialSection="person" />);
      const details = screen.getByText("personPage.details").closest("details");
      expect(details?.open).toBe(true);
    });
  });

  describe("canvas highlight", () => {
    it("lights up the hovered entry's badge and the other people involved", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.allPersons = new Map([
        ["p1", makePerson()],
        ["p2", makePerson({ id: "p2", name: "Hendrik" })],
      ]);
      props.events = [makeEvent({ person_ids: ["p1", "p2"] })];
      const { container } = render(<PersonDetailPanel {...props} />);
      await user.hover(screen.getByRole("button", { name: /Test Event/ }));
      const style = container.querySelector("style")?.textContent ?? "";
      expect(style).toContain('[data-badge-id="e1"]');
      expect(style).toContain('[data-id="p2"]');
      expect(style).not.toContain('[data-id="p1"]');
      await user.unhover(screen.getByRole("button", { name: /Test Event/ }));
      expect(container.querySelector("style")).toBeNull();
    });

    it("refuses ids that are not plain identifiers", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ id: 'e1"]{}' })];
      const { container } = render(<PersonDetailPanel {...props} />);
      await user.hover(screen.getByRole("button", { name: /Test Event/ }));
      expect(container.querySelector("style")).toBeNull();
    });
  });
});
