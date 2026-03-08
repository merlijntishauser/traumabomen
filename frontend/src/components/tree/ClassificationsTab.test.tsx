import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedClassification, DecryptedPerson } from "../../hooks/useTreeData";
import { ClassificationsTab } from "./ClassificationsTab";

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

const defaultProps = () => ({
  person: makePerson(),
  classifications: [] as DecryptedClassification[],
  allPersons: new Map([["p1", makePerson()]]),
  onSaveClassification: vi.fn(),
  onDeleteClassification: vi.fn(),
});

describe("ClassificationsTab", () => {
  describe("list view", () => {
    it("renders new classification button when list is empty", () => {
      render(<ClassificationsTab {...defaultProps()} />);
      expect(screen.getByText("classification.newClassification")).toBeInTheDocument();
    });

    it("renders classification cards for each classification", () => {
      const props = defaultProps();
      props.classifications = [
        makeClassification({ id: "cls1", dsm_category: "anxiety" }),
        makeClassification({ id: "cls2", dsm_category: "mood" }),
      ];
      render(<ClassificationsTab {...props} />);
      expect(screen.getByText("dsm.anxiety")).toBeInTheDocument();
      expect(screen.getByText("dsm.mood")).toBeInTheDocument();
    });

    it("shows subcategory name when dsm_subcategory is set", () => {
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          dsm_category: "neurodevelopmental",
          dsm_subcategory: "adhd",
        }),
      ];
      render(<ClassificationsTab {...props} />);
      expect(screen.getByText("dsm.sub.adhd")).toBeInTheDocument();
    });

    it("shows status pill for each classification", () => {
      const props = defaultProps();
      props.classifications = [makeClassification({ status: "suspected" })];
      render(<ClassificationsTab {...props} />);
      expect(screen.getByText("classification.status.suspected")).toBeInTheDocument();
    });

    it("shows parent category when subcategory is set", () => {
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          dsm_category: "neurodevelopmental",
          dsm_subcategory: "adhd",
        }),
      ];
      render(<ClassificationsTab {...props} />);
      expect(screen.getByText("dsm.neurodevelopmental")).toBeInTheDocument();
    });
  });

  describe("period formatting", () => {
    it("shows period range for classification with periods", () => {
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          periods: [{ start_year: 2010, end_year: 2015 }],
        }),
      ];
      render(<ClassificationsTab {...props} />);
      expect(screen.getByText("2010-2015")).toBeInTheDocument();
    });

    it("shows ongoing period when end_year is null", () => {
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          periods: [{ start_year: 2010, end_year: null }],
        }),
      ];
      render(<ClassificationsTab {...props} />);
      expect(screen.getByText("2010, common.ongoing")).toBeInTheDocument();
    });

    it("shows multiple periods separated by semicolons", () => {
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          periods: [
            { start_year: 2005, end_year: 2008 },
            { start_year: 2012, end_year: null },
          ],
        }),
      ];
      render(<ClassificationsTab {...props} />);
      expect(screen.getByText("2005-2008; 2012, common.ongoing")).toBeInTheDocument();
    });

    it("shows diagnosis year as ongoing when no periods", () => {
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          diagnosis_year: 2018,
          periods: [],
        }),
      ];
      render(<ClassificationsTab {...props} />);
      expect(screen.getByText("2018, common.ongoing")).toBeInTheDocument();
    });

    it("shows no period summary when no periods and no diagnosis year", () => {
      const props = defaultProps();
      props.classifications = [
        makeClassification({
          diagnosis_year: null,
          periods: [],
        }),
      ];
      render(<ClassificationsTab {...props} />);
      expect(screen.queryByClassName?.("detail-panel__period-summary")).toBeFalsy();
    });
  });

  describe("opening the form", () => {
    it("opens new classification form when add button is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationsTab {...props} />);

      await user.click(screen.getByText("classification.newClassification"));
      // Form should be visible with the new classification title
      expect(screen.getByText("classification.newClassification")).toBeInTheDocument();
      // Form elements should be present
      expect(screen.getByText("classification.category")).toBeInTheDocument();
    });

    it("opens edit form when a classification card is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [makeClassification({ id: "cls1", dsm_category: "anxiety" })];
      render(<ClassificationsTab {...props} />);

      await user.click(screen.getByText("dsm.anxiety"));

      // Should show the form with save button
      expect(screen.getByText("common.save")).toBeInTheDocument();
      expect(screen.getByText("common.delete")).toBeInTheDocument();
    });

    it("opens directly to edit form when initialEditId is provided", () => {
      const props = defaultProps();
      props.classifications = [makeClassification({ id: "cls1", dsm_category: "anxiety" })];
      render(<ClassificationsTab {...props} initialEditId="cls1" />);

      expect(screen.getByText("common.save")).toBeInTheDocument();
    });
  });

  describe("classification form", () => {
    it("shows status radio buttons defaulting to suspected", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationsTab {...props} />);

      await user.click(screen.getByText("classification.newClassification"));

      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(2);
      // Suspected should be checked by default
      expect(radios[0]).toBeChecked();
      expect(radios[1]).not.toBeChecked();
    });

    it("shows diagnosis year field when status is diagnosed", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationsTab {...props} />);

      await user.click(screen.getByText("classification.newClassification"));

      // Click "diagnosed" radio
      const diagnosedRadio = screen.getAllByRole("radio")[1];
      await user.click(diagnosedRadio);

      expect(screen.getByText("classification.diagnosisYear")).toBeInTheDocument();
    });

    it("does not show diagnosis year field when status is suspected", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationsTab {...props} />);

      await user.click(screen.getByText("classification.newClassification"));
      expect(screen.queryByText("classification.diagnosisYear")).not.toBeInTheDocument();
    });

    it("adds a period when add period button is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationsTab {...props} />);

      await user.click(screen.getByText("classification.newClassification"));
      await user.click(screen.getByText("classification.addPeriod"));

      expect(screen.getByText("common.startYear")).toBeInTheDocument();
      expect(screen.getByText("common.endYear")).toBeInTheDocument();
    });

    it("removes a period when remove period button is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationsTab {...props} />);

      await user.click(screen.getByText("classification.newClassification"));
      await user.click(screen.getByText("classification.addPeriod"));

      expect(screen.getByText("common.startYear")).toBeInTheDocument();

      await user.click(screen.getByText("classification.removePeriod"));
      expect(screen.queryByText("common.startYear")).not.toBeInTheDocument();
    });

    it("calls onSaveClassification with form data when save is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationsTab {...props} />);

      await user.click(screen.getByText("classification.newClassification"));

      // Fill in notes (the textarea, not the search input)
      const textboxes = screen.getAllByRole("textbox");
      const notesTextarea = textboxes.find((el) => el.tagName === "TEXTAREA")!;
      await user.type(notesTextarea, "Test notes");

      await user.click(screen.getByText("common.save"));

      expect(props.onSaveClassification).toHaveBeenCalledOnce();
      const [classificationId, data, personIds] = props.onSaveClassification.mock.calls[0];
      expect(classificationId).toBeNull(); // New classification
      expect(data.dsm_category).toBe("anxiety");
      expect(data.status).toBe("suspected");
      expect(data.notes).toBe("Test notes");
      expect(personIds).toContain("p1");
    });

    it("calls onDeleteClassification when delete is confirmed on existing classification", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.classifications = [makeClassification({ id: "cls1" })];
      render(<ClassificationsTab {...props} />);

      // Click the classification card to edit
      await user.click(screen.getByText("dsm.anxiety"));

      // Click delete, then confirm
      await user.click(screen.getByText("common.delete"));
      await user.click(screen.getByText("common.delete"));

      expect(props.onDeleteClassification).toHaveBeenCalledWith("cls1");
    });

    it("auto-creates period from diagnosis year when no periods set", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationsTab {...props} />);

      await user.click(screen.getByText("classification.newClassification"));

      // Switch to diagnosed status
      const diagnosedRadio = screen.getAllByRole("radio")[1];
      await user.click(diagnosedRadio);

      // Set diagnosis year
      const yearInput = screen.getByPlaceholderText("---");
      await user.type(yearInput, "2020");

      await user.click(screen.getByText("common.save"));

      const savedData = props.onSaveClassification.mock.calls[0][1];
      expect(savedData.diagnosis_year).toBe(2020);
      expect(savedData.periods).toEqual([{ start_year: 2020, end_year: null }]);
    });

    it("returns to list view when back/cancel button is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      render(<ClassificationsTab {...props} />);

      await user.click(screen.getByText("classification.newClassification"));
      expect(screen.getByText("common.save")).toBeInTheDocument();

      // Click the back/cancel button
      await user.click(screen.getByLabelText("common.close"));

      // Should be back to the list view
      expect(screen.getByText("classification.newClassification")).toBeInTheDocument();
      expect(screen.queryByText("common.save")).not.toBeInTheDocument();
    });
  });
});
