import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedLifeEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { LifeEventCategory } from "../../types/domain";
import { LifeEventsTab } from "./LifeEventsTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../lib/lifeEventColors", () => ({
  getLifeEventColor: () => "#60a5fa",
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

const defaultProps = () => ({
  person: makePerson(),
  lifeEvents: [] as DecryptedLifeEvent[],
  allPersons: new Map([["p1", makePerson()]]),
  onSaveLifeEvent: vi.fn(),
  onDeleteLifeEvent: vi.fn(),
});

describe("LifeEventsTab", () => {
  describe("list view", () => {
    it("renders add new event button when list is empty", () => {
      render(<LifeEventsTab {...defaultProps()} />);
      expect(screen.getByText("lifeEvent.newEvent")).toBeInTheDocument();
    });

    it("renders event cards for each life event", () => {
      const props = defaultProps();
      props.lifeEvents = [
        makeLifeEvent({ id: "le1", title: "Graduation" }),
        makeLifeEvent({ id: "le2", title: "Job Start" }),
      ];
      render(<LifeEventsTab {...props} />);
      expect(screen.getByText("Graduation")).toBeInTheDocument();
      expect(screen.getByText("Job Start")).toBeInTheDocument();
    });

    it("shows category label on event cards", () => {
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ category: LifeEventCategory.Education })];
      render(<LifeEventsTab {...props} />);
      expect(screen.getByText("lifeEvent.category.education")).toBeInTheDocument();
    });

    it("shows approximate date on event cards", () => {
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ approximate_date: "1998" })];
      render(<LifeEventsTab {...props} />);
      expect(screen.getByText("1998")).toBeInTheDocument();
    });

    it("shows severity bar when impact is set", () => {
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ impact: 7 })];
      render(<LifeEventsTab {...props} />);
      expect(screen.getByRole("img", { name: "7/10" })).toBeInTheDocument();
    });
  });

  describe("opening the form", () => {
    it("opens new event form when add button is clicked", async () => {
      const user = userEvent.setup();
      render(<LifeEventsTab {...defaultProps()} />);

      await user.click(screen.getByText("lifeEvent.newEvent"));

      expect(screen.getByText("lifeEvent.title")).toBeInTheDocument();
      expect(screen.getByText("lifeEvent.description")).toBeInTheDocument();
      expect(screen.getByText("lifeEvent.category")).toBeInTheDocument();
    });

    it("opens edit form when an event card is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ id: "le1", title: "Graduation" })];
      render(<LifeEventsTab {...props} />);

      await user.click(screen.getByText("Graduation"));

      expect(screen.getByText("common.save")).toBeInTheDocument();
      expect(screen.getByText("common.delete")).toBeInTheDocument();
      // Form should be pre-populated with event title
      expect(screen.getByDisplayValue("Graduation")).toBeInTheDocument();
    });

    it("opens directly to edit form when initialEditId is provided", () => {
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ id: "le1", title: "Graduation" })];
      render(<LifeEventsTab {...props} initialEditId="le1" />);

      expect(screen.getByDisplayValue("Graduation")).toBeInTheDocument();
      expect(screen.getByText("common.save")).toBeInTheDocument();
    });

    it("shows event title in sub-panel header when editing existing", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ id: "le1", title: "Graduation" })];
      render(<LifeEventsTab {...props} />);

      await user.click(screen.getByText("Graduation"));

      // The sub-panel title should be the event title
      const subTitle = screen.getByText("Graduation");
      expect(subTitle).toBeInTheDocument();
    });
  });

  describe("life event form", () => {
    it("renders all form fields for a new event", async () => {
      const user = userEvent.setup();
      render(<LifeEventsTab {...defaultProps()} />);

      await user.click(screen.getByText("lifeEvent.newEvent"));

      expect(screen.getByText("lifeEvent.title")).toBeInTheDocument();
      expect(screen.getByText("lifeEvent.description")).toBeInTheDocument();
      expect(screen.getByText("lifeEvent.category")).toBeInTheDocument();
      expect(screen.getByText("lifeEvent.approximateDate")).toBeInTheDocument();
      expect(screen.getByText("lifeEvent.tags")).toBeInTheDocument();
    });

    it("calls onSaveLifeEvent with form data when save is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventsTab {...props} />);

      await user.click(screen.getByText("lifeEvent.newEvent"));

      // Fill title
      const titleInput = screen.getByRole("textbox", { name: "lifeEvent.title" });
      await user.type(titleInput, "New Job");

      // Fill description
      const descTextarea = screen.getByRole("textbox", { name: "lifeEvent.description" });
      await user.type(descTextarea, "Started a new position");

      // Fill approximate date
      const dateInput = screen.getByPlaceholderText("lifeEvent.datePlaceholder");
      await user.type(dateInput, "2022");

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveLifeEvent).toHaveBeenCalledOnce();
      const [eventId, data, personIds] = props.onSaveLifeEvent.mock.calls[0];
      expect(eventId).toBeNull();
      expect(data.title).toBe("New Job");
      expect(data.description).toBe("Started a new position");
      expect(data.approximate_date).toBe("2022");
      expect(data.category).toBe(LifeEventCategory.Family); // default
      expect(personIds).toContain("p1");
    });

    it("parses tags from comma-separated input", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventsTab {...props} />);

      await user.click(screen.getByText("lifeEvent.newEvent"));

      const tagsInput = screen.getByPlaceholderText("lifeEvent.tagsPlaceholder");
      await user.type(tagsInput, "work, career, growth");

      await user.click(screen.getByText("common.save"));

      const savedData = props.onSaveLifeEvent.mock.calls[0][1];
      expect(savedData.tags).toEqual(["work", "career", "growth"]);
    });

    it("handles empty tags gracefully", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventsTab {...props} />);

      await user.click(screen.getByText("lifeEvent.newEvent"));
      await user.click(screen.getByText("common.save"));

      const savedData = props.onSaveLifeEvent.mock.calls[0][1];
      expect(savedData.tags).toEqual([]);
    });

    it("saves null impact when impact is empty", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventsTab {...props} />);

      await user.click(screen.getByText("lifeEvent.newEvent"));
      await user.click(screen.getByText("common.save"));

      const savedData = props.onSaveLifeEvent.mock.calls[0][1];
      expect(savedData.impact).toBeNull();
    });

    it("pre-fills form with existing event data when editing", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [
        makeLifeEvent({
          title: "Graduation",
          description: "Finished school",
          category: LifeEventCategory.Education,
          approximate_date: "2000",
          tags: ["school"],
        }),
      ];
      render(<LifeEventsTab {...props} />);

      await user.click(screen.getByText("Graduation"));

      expect(screen.getByDisplayValue("Graduation")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Finished school")).toBeInTheDocument();
      expect(screen.getByDisplayValue("2000")).toBeInTheDocument();
      expect(screen.getByDisplayValue("school")).toBeInTheDocument();
    });

    it("calls onDeleteLifeEvent when delete is confirmed", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.lifeEvents = [makeLifeEvent({ id: "le1" })];
      render(<LifeEventsTab {...props} />);

      await user.click(screen.getByText("Graduation"));
      // Click delete, then confirm
      await user.click(screen.getByText("common.delete"));
      await user.click(screen.getByText("common.delete"));

      expect(props.onDeleteLifeEvent).toHaveBeenCalledWith("le1");
    });

    it("does not show delete button for new events", async () => {
      const user = userEvent.setup();
      render(<LifeEventsTab {...defaultProps()} />);

      await user.click(screen.getByText("lifeEvent.newEvent"));

      expect(screen.queryByText("common.delete")).not.toBeInTheDocument();
    });

    it("returns to list view after saving", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventsTab {...props} />);

      await user.click(screen.getByText("lifeEvent.newEvent"));
      await user.click(screen.getByText("common.save"));

      // Should be back in list view
      expect(screen.getByText("lifeEvent.newEvent")).toBeInTheDocument();
      expect(screen.queryByText("lifeEvent.title")).not.toBeInTheDocument();
    });

    it("returns to list view when cancel is clicked", async () => {
      const user = userEvent.setup();
      render(<LifeEventsTab {...defaultProps()} />);

      await user.click(screen.getByText("lifeEvent.newEvent"));
      expect(screen.getByText("common.save")).toBeInTheDocument();

      await user.click(screen.getByLabelText("common.close"));

      expect(screen.getByText("lifeEvent.newEvent")).toBeInTheDocument();
      expect(screen.queryByText("common.save")).not.toBeInTheDocument();
    });
  });
});
