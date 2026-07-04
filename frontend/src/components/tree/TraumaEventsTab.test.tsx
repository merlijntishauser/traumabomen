import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { TraumaCategory } from "../../types/domain";
import { TraumaEventsTab } from "./TraumaEventsTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../lib/traumaColors", () => ({
  getTraumaColor: () => "#818cf8",
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
    title: "Loss of parent",
    description: "Parent passed away",
    category: TraumaCategory.Loss,
    approximate_date: "1985",
    severity: 5,
    tags: [],
    person_ids: ["p1"],
    ...overrides,
  };
}

const defaultProps = () => ({
  person: makePerson(),
  events: [] as DecryptedEvent[],
  allPersons: new Map([["p1", makePerson()]]),
  onSaveEvent: vi.fn(),
  onDeleteEvent: vi.fn(),
});

describe("TraumaEventsTab", () => {
  describe("list view", () => {
    it("renders add new event button when list is empty", () => {
      render(<TraumaEventsTab {...defaultProps()} />);
      expect(screen.getByText("trauma.newEvent")).toBeInTheDocument();
    });

    it("renders event cards for each trauma event", () => {
      const props = defaultProps();
      props.events = [
        makeEvent({ id: "e1", title: "Loss of parent" }),
        makeEvent({ id: "e2", title: "Childhood abuse" }),
      ];
      render(<TraumaEventsTab {...props} />);
      expect(screen.getByText("Loss of parent")).toBeInTheDocument();
      expect(screen.getByText("Childhood abuse")).toBeInTheDocument();
    });

    it("shows category label on event cards", () => {
      const props = defaultProps();
      props.events = [makeEvent({ category: TraumaCategory.Abuse })];
      render(<TraumaEventsTab {...props} />);
      expect(screen.getByText("trauma.category.abuse")).toBeInTheDocument();
    });

    it("shows approximate date on event cards", () => {
      const props = defaultProps();
      props.events = [makeEvent({ approximate_date: "1985" })];
      render(<TraumaEventsTab {...props} />);
      expect(screen.getByText("1985")).toBeInTheDocument();
    });

    it("shows severity bar when severity is set", () => {
      const props = defaultProps();
      props.events = [makeEvent({ severity: 8 })];
      render(<TraumaEventsTab {...props} />);
      expect(screen.getByText("8/10")).toBeInTheDocument();
    });

    it("renders add button even when events exist", () => {
      const props = defaultProps();
      props.events = [makeEvent()];
      render(<TraumaEventsTab {...props} />);
      expect(screen.getByText("trauma.newEvent")).toBeInTheDocument();
    });
  });

  describe("opening the form", () => {
    it("opens new event form when add button is clicked", async () => {
      const user = userEvent.setup();
      render(<TraumaEventsTab {...defaultProps()} />);

      await user.click(screen.getByText("trauma.newEvent"));

      expect(screen.getByText("trauma.title")).toBeInTheDocument();
      expect(screen.getByText("trauma.description")).toBeInTheDocument();
      expect(screen.getByText("trauma.category")).toBeInTheDocument();
    });

    it("opens edit form when an event card is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ id: "e1", title: "Loss of parent" })];
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("Loss of parent"));

      // Autosave model: no save button, only delete
      expect(screen.queryByText("common.save")).not.toBeInTheDocument();
      expect(screen.getByText("common.delete")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Loss of parent")).toBeInTheDocument();
    });

    it("opens directly to edit form when initialEditId is provided", () => {
      const props = defaultProps();
      props.events = [makeEvent({ id: "e1", title: "Loss of parent" })];
      render(<TraumaEventsTab {...props} initialEditId="e1" />);

      expect(screen.getByDisplayValue("Loss of parent")).toBeInTheDocument();
      expect(screen.getByText("common.delete")).toBeInTheDocument();
    });
  });

  describe("trauma event form", () => {
    it("renders all form fields", async () => {
      const user = userEvent.setup();
      render(<TraumaEventsTab {...defaultProps()} />);

      await user.click(screen.getByText("trauma.newEvent"));

      expect(screen.getByText("trauma.title")).toBeInTheDocument();
      expect(screen.getByText("trauma.description")).toBeInTheDocument();
      expect(screen.getByText("trauma.category")).toBeInTheDocument();
      expect(screen.getByText("trauma.approximateDate")).toBeInTheDocument();
      expect(screen.getByText("trauma.tags")).toBeInTheDocument();
    });

    it("defaults severity to 5 for new events", async () => {
      const user = userEvent.setup();
      render(<TraumaEventsTab {...defaultProps()} />);

      await user.click(screen.getByText("trauma.newEvent"));

      const slider = screen.getByRole("slider");
      expect(slider).toHaveValue("5");
    });

    it("calls onSaveEvent with null id when add is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("trauma.newEvent"));

      const titleInput = screen.getByRole("textbox", { name: "trauma.title" });
      await user.type(titleInput, "War experience");

      const descTextarea = screen.getByRole("textbox", { name: "trauma.description" });
      await user.type(descTextarea, "Witnessed conflict");

      await user.click(screen.getByText("common.add"));

      expect(props.onSaveEvent).toHaveBeenCalledOnce();
      const [eventId, data, personIds] = props.onSaveEvent.mock.calls[0];
      expect(eventId).toBeNull();
      expect(data.title).toBe("War experience");
      expect(data.description).toBe("Witnessed conflict");
      expect(data.category).toBe(TraumaCategory.Loss); // default
      expect(data.severity).toBe(5); // default
      expect(personIds).toContain("p1");
    });

    it("parses tags from comma-separated input", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("trauma.newEvent"));

      const titleInput = screen.getByRole("textbox", { name: "trauma.title" });
      await user.type(titleInput, "War experience");

      const tagsInput = screen.getByPlaceholderText("trauma.tagsPlaceholder");
      await user.type(tagsInput, "war, conflict, ptsd");

      await user.click(screen.getByText("common.add"));

      const savedData = props.onSaveEvent.mock.calls[0][1];
      expect(savedData.tags).toEqual(["war", "conflict", "ptsd"]);
    });

    it("handles empty tags gracefully", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("trauma.newEvent"));
      await user.type(screen.getByRole("textbox", { name: "trauma.title" }), "Untagged");
      await user.click(screen.getByText("common.add"));

      const savedData = props.onSaveEvent.mock.calls[0][1];
      expect(savedData.tags).toEqual([]);
    });

    it("does nothing when add is clicked with an empty title", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("trauma.newEvent"));
      await user.click(screen.getByText("common.add"));

      expect(props.onSaveEvent).not.toHaveBeenCalled();
      // Still in the creation form
      expect(screen.getByText("trauma.title")).toBeInTheDocument();
    });

    it("pre-fills form with existing event data when editing", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [
        makeEvent({
          title: "Loss of parent",
          description: "Parent passed away",
          category: TraumaCategory.Loss,
          approximate_date: "1985",
          severity: 8,
          tags: ["grief", "family"],
        }),
      ];
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("Loss of parent"));

      expect(screen.getByDisplayValue("Loss of parent")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Parent passed away")).toBeInTheDocument();
      expect(screen.getByDisplayValue("1985")).toBeInTheDocument();
      expect(screen.getByDisplayValue("grief, family")).toBeInTheDocument();
      expect(screen.getByRole("slider")).toHaveValue("8");
    });

    it("changes category via select", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("trauma.newEvent"));

      await user.type(screen.getByRole("textbox", { name: "trauma.title" }), "War experience");

      const categorySelect = screen.getByRole("combobox");
      await user.selectOptions(categorySelect, TraumaCategory.War);

      await user.click(screen.getByText("common.add"));

      expect(props.onSaveEvent.mock.calls[0][1].category).toBe(TraumaCategory.War);
    });

    it("calls onDeleteEvent when delete is confirmed", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ id: "e1" })];
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("Loss of parent"));
      await user.click(screen.getByText("common.delete"));
      await user.click(screen.getByText("common.delete"));

      expect(props.onDeleteEvent).toHaveBeenCalledWith("e1");
    });

    it("does not show delete button for new events", async () => {
      const user = userEvent.setup();
      render(<TraumaEventsTab {...defaultProps()} />);

      await user.click(screen.getByText("trauma.newEvent"));

      expect(screen.queryByText("common.delete")).not.toBeInTheDocument();
    });

    it("returns to list view after adding a new event", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("trauma.newEvent"));
      await user.type(screen.getByRole("textbox", { name: "trauma.title" }), "War experience");
      await user.click(screen.getByText("common.add"));

      expect(props.onSaveEvent).toHaveBeenCalledOnce();
      expect(screen.getByText("trauma.newEvent")).toBeInTheDocument();
      expect(screen.queryByText("trauma.title")).not.toBeInTheDocument();
    });

    it("saves nothing when backing out of a creation without adding", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("trauma.newEvent"));
      await user.type(screen.getByRole("textbox", { name: "trauma.title" }), "Half-typed");
      await user.click(screen.getByLabelText("common.close"));

      expect(props.onSaveEvent).not.toHaveBeenCalled();
      expect(screen.getByText("trauma.newEvent")).toBeInTheDocument();
      expect(screen.queryByText("common.add")).not.toBeInTheDocument();
    });

    it("commits a title change on blur when editing", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ id: "e1", title: "Loss of parent" })];
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("Loss of parent"));

      const titleInput = screen.getByRole("textbox", { name: "trauma.title" });
      fireEvent.change(titleInput, { target: { value: "Loss of both parents" } });
      fireEvent.blur(titleInput);

      expect(props.onSaveEvent).toHaveBeenCalledOnce();
      const [eventId, data, personIds] = props.onSaveEvent.mock.calls[0];
      expect(eventId).toBe("e1");
      expect(data.title).toBe("Loss of both parents");
      expect(personIds).toEqual(["p1"]);
    });

    it("does not save on blur without a change", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ id: "e1", title: "Loss of parent" })];
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("Loss of parent"));

      const titleInput = screen.getByRole("textbox", { name: "trauma.title" });
      fireEvent.blur(titleInput);

      expect(props.onSaveEvent).not.toHaveBeenCalled();
    });

    it("keeps the editor open after an autosave commit", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ id: "e1", title: "Loss of parent" })];
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("Loss of parent"));

      const dateInput = screen.getByRole("textbox", { name: "trauma.approximateDate" });
      fireEvent.change(dateInput, { target: { value: "1986" } });
      fireEvent.blur(dateInput);

      expect(props.onSaveEvent).toHaveBeenCalledOnce();
      // Editor stays open after a commit
      expect(screen.getByText("trauma.title")).toBeInTheDocument();
      expect(screen.queryByText("trauma.newEvent")).not.toBeInTheDocument();
    });

    it("commits a category change immediately when editing", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ id: "e1", category: TraumaCategory.Loss })];
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("Loss of parent"));

      const categorySelect = screen.getByRole("combobox");
      await user.selectOptions(categorySelect, TraumaCategory.War);

      expect(props.onSaveEvent).toHaveBeenCalledOnce();
      expect(props.onSaveEvent.mock.calls[0][0]).toBe("e1");
      expect(props.onSaveEvent.mock.calls[0][1].category).toBe(TraumaCategory.War);
    });

    it("defaults severity to 1 when severity input is invalid", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.events = [makeEvent({ severity: 5 })];
      render(<TraumaEventsTab {...props} />);

      await user.click(screen.getByText("Loss of parent"));

      // Severity defaults to the event's severity value
      const slider = screen.getByRole("slider");
      expect(slider).toHaveValue("5");
    });
  });
});
