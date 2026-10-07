import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedLifeEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { LifeEventCategory } from "../../types/domain";
import { LifeEventForm } from "./LifeEventForm";

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

const defaultProps = (event: DecryptedLifeEvent | null = null) => ({
  event,
  allPersons: new Map([["p1", makePerson()]]),
  initialPersonIds: ["p1"],
  onSave: vi.fn(),
  onDelete: vi.fn(),
});

describe("LifeEventForm", () => {
  it("shows how the date will read under the date field", () => {
    render(<LifeEventForm {...defaultProps()} />);
    const input = screen.getByRole("textbox", { name: "lifeEvent.approximateDate" });
    expect(screen.queryByText(/^dateHint\./)).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "as a child" } });
    expect(screen.getByText("dateHint.readsFor")).toBeInTheDocument();
  });

  describe("new event", () => {
    it("renders all form fields", () => {
      render(<LifeEventForm {...defaultProps()} />);

      expect(screen.getByText("lifeEvent.title")).toBeInTheDocument();
      expect(screen.getByText("lifeEvent.description")).toBeInTheDocument();
      expect(screen.getByText("lifeEvent.category")).toBeInTheDocument();
      expect(screen.getByText("lifeEvent.approximateDate")).toBeInTheDocument();
      expect(screen.getByText("lifeEvent.tags")).toBeInTheDocument();
    });

    it("calls onSave with the form data when add is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventForm {...props} />);

      await user.type(screen.getByRole("textbox", { name: "lifeEvent.title" }), "New Job");
      await user.type(
        screen.getByRole("textbox", { name: "lifeEvent.description" }),
        "Started a new position",
      );
      await user.type(screen.getByPlaceholderText("lifeEvent.datePlaceholder"), "2022");
      await user.click(screen.getByText("common.add"));

      expect(props.onSave).toHaveBeenCalledOnce();
      const [data, personIds] = props.onSave.mock.calls[0];
      expect(data.title).toBe("New Job");
      expect(data.description).toBe("Started a new position");
      expect(data.approximate_date).toBe("2022");
      expect(data.category).toBe(LifeEventCategory.Family); // default
      expect(personIds).toContain("p1");
    });

    it("parses tags from comma-separated input", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventForm {...props} />);

      await user.type(screen.getByRole("textbox", { name: "lifeEvent.title" }), "New Job");
      await user.type(
        screen.getByPlaceholderText("lifeEvent.tagsPlaceholder"),
        "work, career, growth",
      );
      await user.click(screen.getByText("common.add"));

      expect(props.onSave.mock.calls[0][0].tags).toEqual(["work", "career", "growth"]);
    });

    it("handles empty tags gracefully", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventForm {...props} />);

      await user.type(screen.getByRole("textbox", { name: "lifeEvent.title" }), "Untagged");
      await user.click(screen.getByText("common.add"));

      expect(props.onSave.mock.calls[0][0].tags).toEqual([]);
    });

    it("saves null impact when impact is empty", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventForm {...props} />);

      await user.type(screen.getByRole("textbox", { name: "lifeEvent.title" }), "New Job");
      await user.click(screen.getByText("common.add"));

      expect(props.onSave.mock.calls[0][0].impact).toBeNull();
    });

    it("does nothing when add is clicked with an empty title", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventForm {...props} />);

      await user.click(screen.getByText("common.add"));

      expect(props.onSave).not.toHaveBeenCalled();
    });

    it("does not autosave while typing or on blur", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<LifeEventForm {...props} />);

      const titleInput = screen.getByRole("textbox", { name: "lifeEvent.title" });
      await user.type(titleInput, "Half-typed");
      fireEvent.blur(titleInput);

      expect(props.onSave).not.toHaveBeenCalled();
      expect(screen.getByText("common.add")).toBeInTheDocument();
    });

    it("does not show delete button for new events", () => {
      render(<LifeEventForm {...defaultProps()} />);
      expect(screen.queryByText("common.delete")).not.toBeInTheDocument();
    });
  });

  describe("existing event", () => {
    it("shows delete and no save or add button", () => {
      render(<LifeEventForm {...defaultProps(makeLifeEvent({ title: "Graduation" }))} />);

      expect(screen.queryByText("common.save")).not.toBeInTheDocument();
      expect(screen.queryByText("common.add")).not.toBeInTheDocument();
      expect(screen.getByText("common.delete")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Graduation")).toBeInTheDocument();
    });

    it("pre-fills form with existing event data", () => {
      render(
        <LifeEventForm
          {...defaultProps(
            makeLifeEvent({
              title: "Graduation",
              description: "Finished school",
              category: LifeEventCategory.Education,
              approximate_date: "2000",
              tags: ["school"],
            }),
          )}
        />,
      );

      expect(screen.getByDisplayValue("Graduation")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Finished school")).toBeInTheDocument();
      expect(screen.getByDisplayValue("2000")).toBeInTheDocument();
      expect(screen.getByDisplayValue("school")).toBeInTheDocument();
    });

    it("calls onDelete when delete is confirmed", async () => {
      const user = userEvent.setup();
      const props = defaultProps(makeLifeEvent({ id: "le1" }));
      render(<LifeEventForm {...props} />);

      // Click delete, then confirm
      await user.click(screen.getByText("common.delete"));
      await user.click(screen.getByText("common.delete"));

      expect(props.onDelete).toHaveBeenCalledOnce();
    });

    it("commits a title change on blur", () => {
      const props = defaultProps(makeLifeEvent({ id: "le1", title: "Graduation" }));
      render(<LifeEventForm {...props} />);

      const titleInput = screen.getByRole("textbox", { name: "lifeEvent.title" });
      fireEvent.change(titleInput, { target: { value: "PhD" } });
      fireEvent.blur(titleInput);

      expect(props.onSave).toHaveBeenCalledOnce();
      const [data, personIds] = props.onSave.mock.calls[0];
      expect(data.title).toBe("PhD");
      expect(personIds).toEqual(["p1"]);
    });

    it("does not save on blur without a change", () => {
      const props = defaultProps(makeLifeEvent({ id: "le1", title: "Graduation" }));
      render(<LifeEventForm {...props} />);

      fireEvent.blur(screen.getByRole("textbox", { name: "lifeEvent.title" }));

      expect(props.onSave).not.toHaveBeenCalled();
    });

    it("keeps the editor in place after an autosave commit", () => {
      const props = defaultProps(makeLifeEvent({ id: "le1", title: "Graduation" }));
      render(<LifeEventForm {...props} />);

      const titleInput = screen.getByRole("textbox", { name: "lifeEvent.title" });
      fireEvent.change(titleInput, { target: { value: "PhD" } });
      fireEvent.blur(titleInput);

      expect(props.onSave).toHaveBeenCalledOnce();
      expect(screen.getByText("lifeEvent.title")).toBeInTheDocument();
      expect(screen.getByDisplayValue("PhD")).toBeInTheDocument();
    });

    it("commits a category change immediately", async () => {
      const user = userEvent.setup();
      const props = defaultProps(
        makeLifeEvent({ id: "le1", category: LifeEventCategory.Education }),
      );
      render(<LifeEventForm {...props} />);

      await user.selectOptions(screen.getByRole("combobox"), LifeEventCategory.Career);

      expect(props.onSave).toHaveBeenCalledOnce();
      expect(props.onSave.mock.calls[0][0].category).toBe(LifeEventCategory.Career);
    });
  });
});
