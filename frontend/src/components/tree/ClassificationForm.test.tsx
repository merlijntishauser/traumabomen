import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedClassification, DecryptedPerson } from "../../hooks/useTreeData";
import { ClassificationForm } from "./ClassificationForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../lib/classificationColors", () => ({
  getClassificationColor: (status: string) => (status === "suspected" ? "#fbbf24" : "#38bdf8"),
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

const defaultProps = (classification: DecryptedClassification | null = null) => ({
  classification,
  allPersons: new Map([["p1", makePerson()]]),
  initialPersonIds: ["p1"],
  onSave: vi.fn(),
  onDelete: vi.fn(),
});

describe("ClassificationForm", () => {
  describe("new classification", () => {
    it("renders the category field", () => {
      render(<ClassificationForm {...defaultProps()} />);
      expect(screen.getByRole("combobox", { name: "classification.category" })).toHaveValue(
        "anxiety",
      );
    });

    it("shows status radio buttons defaulting to suspected", () => {
      render(<ClassificationForm {...defaultProps()} />);

      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(2);
      expect(radios[0]).toBeChecked();
      expect(radios[1]).not.toBeChecked();
    });

    it("shows diagnosis year field when status is diagnosed", async () => {
      const user = userEvent.setup();
      render(<ClassificationForm {...defaultProps()} />);

      await user.click(screen.getAllByRole("radio")[1]);

      expect(screen.getByText("classification.diagnosisYear")).toBeInTheDocument();
    });

    it("does not show diagnosis year field when status is suspected", () => {
      render(<ClassificationForm {...defaultProps()} />);
      expect(screen.queryByText("classification.diagnosisYear")).not.toBeInTheDocument();
    });

    it("adds a period when add period button is clicked", async () => {
      const user = userEvent.setup();
      render(<ClassificationForm {...defaultProps()} />);

      await user.click(screen.getByText("classification.addPeriod"));

      expect(screen.getByText("common.startYear")).toBeInTheDocument();
      expect(screen.getByText("common.endYear")).toBeInTheDocument();
    });

    it("removes a period when remove period button is clicked", async () => {
      const user = userEvent.setup();
      render(<ClassificationForm {...defaultProps()} />);

      await user.click(screen.getByText("classification.addPeriod"));
      expect(screen.getByText("common.startYear")).toBeInTheDocument();

      await user.click(screen.getByText("classification.removePeriod"));
      expect(screen.queryByText("common.startYear")).not.toBeInTheDocument();
    });

    it("does not autosave while building a new classification", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationForm {...props} />);

      await user.click(screen.getAllByRole("radio")[1]);
      await user.click(screen.getByText("classification.addPeriod"));

      expect(props.onSave).not.toHaveBeenCalled();
      expect(screen.getByText("common.add")).toBeInTheDocument();
    });

    it("calls onSave when add is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationForm {...props} />);

      await user.type(screen.getByRole("textbox", { name: "classification.notes" }), "Test notes");
      await user.click(screen.getByText("common.add"));

      expect(props.onSave).toHaveBeenCalledOnce();
      const [data, personIds] = props.onSave.mock.calls[0];
      expect(data.dsm_category).toBe("anxiety");
      expect(data.status).toBe("suspected");
      expect(data.notes).toBe("Test notes");
      expect(personIds).toContain("p1");
    });

    it("auto-creates period from diagnosis year when no periods set", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationForm {...props} />);

      await user.click(screen.getAllByRole("radio")[1]);
      await user.type(
        screen.getByRole("textbox", { name: "classification.diagnosisYear" }),
        "2020",
      );
      await user.click(screen.getByText("common.add"));

      const savedData = props.onSave.mock.calls[0][0];
      expect(savedData.diagnosis_year).toBe(2020);
      expect(savedData.periods).toEqual([{ start_year: 2020, end_year: null }]);
    });

    it("does not show delete button for new classifications", () => {
      render(<ClassificationForm {...defaultProps()} />);
      expect(screen.queryByText("common.delete")).not.toBeInTheDocument();
    });
  });

  describe("existing classification", () => {
    it("shows delete and no save or add button", () => {
      render(<ClassificationForm {...defaultProps(makeClassification())} />);

      expect(screen.queryByText("common.save")).not.toBeInTheDocument();
      expect(screen.queryByText("common.add")).not.toBeInTheDocument();
      expect(screen.getByText("common.delete")).toBeInTheDocument();
    });

    it("selects the subcategory of an existing classification", () => {
      render(
        <ClassificationForm
          {...defaultProps(
            makeClassification({ dsm_category: "neurodevelopmental", dsm_subcategory: "adhd" }),
          )}
        />,
      );
      expect(screen.getByRole("combobox", { name: "classification.category" })).toHaveValue(
        "neurodevelopmental::adhd",
      );
    });

    it("calls onDelete when delete is confirmed", async () => {
      const user = userEvent.setup();
      const props = defaultProps(makeClassification({ id: "cls1" }));
      render(<ClassificationForm {...props} />);

      // Click delete, then confirm
      await user.click(screen.getByText("common.delete"));
      await user.click(screen.getByText("common.delete"));

      expect(props.onDelete).toHaveBeenCalledOnce();
    });

    it("commits a status change immediately", async () => {
      const user = userEvent.setup();
      const props = defaultProps(makeClassification({ id: "cls1", status: "suspected" }));
      render(<ClassificationForm {...props} />);

      await user.click(screen.getAllByRole("radio")[1]);

      expect(props.onSave).toHaveBeenCalledOnce();
      const [data, personIds] = props.onSave.mock.calls[0];
      expect(data.status).toBe("diagnosed");
      expect(personIds).toEqual(["p1"]);
    });

    it("commits the diagnosis year on blur", () => {
      const props = defaultProps(
        makeClassification({ id: "cls1", status: "diagnosed", diagnosis_year: 2015 }),
      );
      render(<ClassificationForm {...props} />);

      const yearInput = screen.getByRole("textbox", { name: "classification.diagnosisYear" });
      expect(yearInput).toHaveValue("2015");
      fireEvent.change(yearInput, { target: { value: "2018" } });
      fireEvent.blur(yearInput);

      expect(props.onSave).toHaveBeenCalledOnce();
      expect(props.onSave.mock.calls[0][0].diagnosis_year).toBe(2018);
    });

    it("commits adding a period immediately", async () => {
      const user = userEvent.setup();
      const props = defaultProps(makeClassification({ id: "cls1" }));
      render(<ClassificationForm {...props} />);

      await user.click(screen.getByText("classification.addPeriod"));

      expect(props.onSave).toHaveBeenCalledOnce();
      expect(props.onSave.mock.calls[0][0].periods).toEqual([
        { start_year: new Date().getFullYear(), end_year: null },
      ]);
    });

    it("commits removing a period immediately", async () => {
      const user = userEvent.setup();
      const props = defaultProps(
        makeClassification({ id: "cls1", periods: [{ start_year: 2010, end_year: 2015 }] }),
      );
      render(<ClassificationForm {...props} />);

      await user.click(screen.getByText("classification.removePeriod"));

      expect(props.onSave).toHaveBeenCalledOnce();
      expect(props.onSave.mock.calls[0][0].periods).toEqual([]);
    });

    it("commits a period year change on blur", () => {
      const props = defaultProps(
        makeClassification({ id: "cls1", periods: [{ start_year: 2010, end_year: 2015 }] }),
      );
      render(<ClassificationForm {...props} />);

      const startYearInput = screen.getByDisplayValue("2010");
      fireEvent.change(startYearInput, { target: { value: "2008" } });
      fireEvent.blur(startYearInput);

      expect(props.onSave).toHaveBeenCalledOnce();
      expect(props.onSave.mock.calls[0][0].periods).toEqual([{ start_year: 2008, end_year: 2015 }]);
    });

    it("does not save on blur without a change", () => {
      const props = defaultProps(
        makeClassification({ id: "cls1", periods: [{ start_year: 2010, end_year: 2015 }] }),
      );
      render(<ClassificationForm {...props} />);

      fireEvent.blur(screen.getByDisplayValue("2010"));

      expect(props.onSave).not.toHaveBeenCalled();
    });
  });
});
