import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { TraumaCategory } from "../../types/domain";
import { TraumaEventForm } from "./TraumaEventForm";

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

const defaultProps = (event: DecryptedEvent | null = null) => ({
  event,
  allPersons: new Map([["p1", makePerson()]]),
  initialPersonIds: ["p1"],
  onSave: vi.fn(),
  onDelete: vi.fn(),
});

describe("TraumaEventForm", () => {
  describe("new event", () => {
    it("renders all form fields", () => {
      render(<TraumaEventForm {...defaultProps()} />);

      expect(screen.getByText("trauma.title")).toBeInTheDocument();
      expect(screen.getByText("trauma.description")).toBeInTheDocument();
      expect(screen.getByText("trauma.category")).toBeInTheDocument();
      expect(screen.getByText("trauma.approximateDate")).toBeInTheDocument();
      expect(screen.getByText("trauma.tags")).toBeInTheDocument();
    });

    it("defaults severity to 5 for new events", () => {
      render(<TraumaEventForm {...defaultProps()} />);
      expect(screen.getByRole("slider")).toHaveValue("5");
    });

    it("calls onSave with the form data when add is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventForm {...props} />);

      await user.type(screen.getByRole("textbox", { name: "trauma.title" }), "War experience");
      await user.type(
        screen.getByRole("textbox", { name: "trauma.description" }),
        "Witnessed conflict",
      );
      await user.click(screen.getByText("common.add"));

      expect(props.onSave).toHaveBeenCalledOnce();
      const [data, personIds] = props.onSave.mock.calls[0];
      expect(data.title).toBe("War experience");
      expect(data.description).toBe("Witnessed conflict");
      expect(data.category).toBe(TraumaCategory.Loss); // default
      expect(data.severity).toBe(5); // default
      expect(personIds).toContain("p1");
    });

    it("parses tags from comma-separated input", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventForm {...props} />);

      await user.type(screen.getByRole("textbox", { name: "trauma.title" }), "War experience");
      await user.type(screen.getByPlaceholderText("trauma.tagsPlaceholder"), "war, conflict, ptsd");
      await user.click(screen.getByText("common.add"));

      expect(props.onSave.mock.calls[0][0].tags).toEqual(["war", "conflict", "ptsd"]);
    });

    it("handles empty tags gracefully", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventForm {...props} />);

      await user.type(screen.getByRole("textbox", { name: "trauma.title" }), "Untagged");
      await user.click(screen.getByText("common.add"));

      expect(props.onSave.mock.calls[0][0].tags).toEqual([]);
    });

    it("does nothing when add is clicked with an empty title", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventForm {...props} />);

      await user.click(screen.getByText("common.add"));

      expect(props.onSave).not.toHaveBeenCalled();
      expect(screen.getByText("trauma.title")).toBeInTheDocument();
    });

    it("changes category via select", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventForm {...props} />);

      await user.type(screen.getByRole("textbox", { name: "trauma.title" }), "War experience");
      await user.selectOptions(screen.getByRole("combobox"), TraumaCategory.War);
      await user.click(screen.getByText("common.add"));

      expect(props.onSave).toHaveBeenCalledOnce();
      expect(props.onSave.mock.calls[0][0].category).toBe(TraumaCategory.War);
    });

    it("does not autosave while typing or on blur", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<TraumaEventForm {...props} />);

      const titleInput = screen.getByRole("textbox", { name: "trauma.title" });
      await user.type(titleInput, "Half-typed");
      fireEvent.blur(titleInput);

      expect(props.onSave).not.toHaveBeenCalled();
    });

    it("does not show delete button for new events", () => {
      render(<TraumaEventForm {...defaultProps()} />);
      expect(screen.queryByText("common.delete")).not.toBeInTheDocument();
    });
  });

  describe("existing event", () => {
    it("shows delete and no save or add button", () => {
      render(<TraumaEventForm {...defaultProps(makeEvent())} />);

      expect(screen.queryByText("common.save")).not.toBeInTheDocument();
      expect(screen.queryByText("common.add")).not.toBeInTheDocument();
      expect(screen.getByText("common.delete")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Loss of parent")).toBeInTheDocument();
    });

    it("pre-fills form with existing event data", () => {
      render(
        <TraumaEventForm
          {...defaultProps(
            makeEvent({
              title: "Loss of parent",
              description: "Parent passed away",
              category: TraumaCategory.Loss,
              approximate_date: "1985",
              severity: 8,
              tags: ["grief", "family"],
            }),
          )}
        />,
      );

      expect(screen.getByDisplayValue("Loss of parent")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Parent passed away")).toBeInTheDocument();
      expect(screen.getByDisplayValue("1985")).toBeInTheDocument();
      expect(screen.getByDisplayValue("grief, family")).toBeInTheDocument();
      expect(screen.getByRole("slider")).toHaveValue("8");
    });

    it("calls onDelete when delete is confirmed", async () => {
      const user = userEvent.setup();
      const props = defaultProps(makeEvent({ id: "e1" }));
      render(<TraumaEventForm {...props} />);

      await user.click(screen.getByText("common.delete"));
      await user.click(screen.getByText("common.delete"));

      expect(props.onDelete).toHaveBeenCalledOnce();
    });

    it("commits a title change on blur", () => {
      const props = defaultProps(makeEvent({ id: "e1", title: "Loss of parent" }));
      render(<TraumaEventForm {...props} />);

      const titleInput = screen.getByRole("textbox", { name: "trauma.title" });
      fireEvent.change(titleInput, { target: { value: "Loss of both parents" } });
      fireEvent.blur(titleInput);

      expect(props.onSave).toHaveBeenCalledOnce();
      const [data, personIds] = props.onSave.mock.calls[0];
      expect(data.title).toBe("Loss of both parents");
      expect(personIds).toEqual(["p1"]);
    });

    it("does not save on blur without a change", () => {
      const props = defaultProps(makeEvent({ id: "e1", title: "Loss of parent" }));
      render(<TraumaEventForm {...props} />);

      fireEvent.blur(screen.getByRole("textbox", { name: "trauma.title" }));

      expect(props.onSave).not.toHaveBeenCalled();
    });

    it("keeps the editor in place after an autosave commit", () => {
      const props = defaultProps(makeEvent({ id: "e1", title: "Loss of parent" }));
      render(<TraumaEventForm {...props} />);

      const dateInput = screen.getByRole("textbox", { name: "trauma.approximateDate" });
      fireEvent.change(dateInput, { target: { value: "1986" } });
      fireEvent.blur(dateInput);

      expect(props.onSave).toHaveBeenCalledOnce();
      expect(props.onSave.mock.calls[0][0].approximate_date).toBe("1986");
      expect(screen.getByText("trauma.title")).toBeInTheDocument();
      expect(screen.getByDisplayValue("1986")).toBeInTheDocument();
    });

    it("commits a category change immediately", async () => {
      const user = userEvent.setup();
      const props = defaultProps(makeEvent({ id: "e1", category: TraumaCategory.Loss }));
      render(<TraumaEventForm {...props} />);

      await user.selectOptions(screen.getByRole("combobox"), TraumaCategory.War);

      expect(props.onSave).toHaveBeenCalledOnce();
      expect(props.onSave.mock.calls[0][0].category).toBe(TraumaCategory.War);
    });

    it("uses the event's severity value", () => {
      render(<TraumaEventForm {...defaultProps(makeEvent({ severity: 5 }))} />);
      expect(screen.getByRole("slider")).toHaveValue("5");
    });

    it("omits the delete button when no onDelete is given", () => {
      render(<TraumaEventForm {...defaultProps(makeEvent())} onDelete={undefined} />);
      expect(screen.queryByText("common.delete")).not.toBeInTheDocument();
    });
  });
});
