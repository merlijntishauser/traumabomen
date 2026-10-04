import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson, DecryptedTurningPoint } from "../../hooks/useTreeData";
import { TurningPointCategory } from "../../types/domain";
import { TurningPointForm } from "./TurningPointForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function makePerson(id = "p1", name = "Alice"): DecryptedPerson {
  return {
    id,
    name,
    birth_year: 1980,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "female",
    is_adopted: false,
    notes: null,
  };
}

function makeTurningPoint(overrides: Partial<DecryptedTurningPoint> = {}): DecryptedTurningPoint {
  return {
    id: "tp1",
    title: "Broke the cycle",
    description: "Sought therapy",
    category: TurningPointCategory.CycleBreaking,
    approximate_date: "1998",
    significance: 8,
    tags: ["healing", "growth"],
    person_ids: ["p1"],
    ...overrides,
  };
}

function renderForm(turningPoint: DecryptedTurningPoint | null = null) {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  render(
    <TurningPointForm
      turningPoint={turningPoint}
      allPersons={
        new Map([
          ["p1", makePerson()],
          ["p2", makePerson("p2", "Bob")],
        ])
      }
      initialPersonIds={["p1"]}
      onSave={onSave}
      onDelete={onDelete}
    />,
  );
  return { onSave, onDelete };
}

describe("TurningPointForm", () => {
  it("renders all fields for a new turning point", () => {
    renderForm();

    expect(screen.getByText("turningPoint.titleField")).toBeInTheDocument();
    expect(screen.getByText("turningPoint.description")).toBeInTheDocument();
    expect(screen.getByText("turningPoint.category")).toBeInTheDocument();
    expect(screen.getByText("turningPoint.approximate_date")).toBeInTheDocument();
    expect(screen.getByText("turningPoint.tags")).toBeInTheDocument();
  });

  it("saves form with all fields filled", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.type(
      screen.getByRole("textbox", { name: "turningPoint.titleField" }),
      "Started therapy",
    );
    await user.type(
      screen.getByRole("textbox", { name: "turningPoint.description" }),
      "A turning point",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "turningPoint.category" }),
      TurningPointCategory.Recovery,
    );
    await user.type(screen.getByPlaceholderText("turningPoint.datePlaceholder"), "2005");
    await user.type(
      screen.getByPlaceholderText("turningPoint.tagsPlaceholder"),
      "therapy, healing",
    );

    await user.click(screen.getByText("common.add"));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Started therapy",
        description: "A turning point",
        category: TurningPointCategory.Recovery,
        approximate_date: "2005",
        tags: ["therapy", "healing"],
      }),
      ["p1"],
    );
  });

  it("does not autosave a new turning point before add is clicked", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    const titleInput = screen.getByRole("textbox", { name: "turningPoint.titleField" });
    await user.type(titleInput, "Half-typed");
    fireEvent.blur(titleInput);

    expect(onSave).not.toHaveBeenCalled();
  });

  it("does nothing when add is clicked with an empty title", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.click(screen.getByText("common.add"));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("populates form with existing values when editing", () => {
    renderForm(makeTurningPoint());

    expect(screen.getByRole("textbox", { name: "turningPoint.titleField" })).toHaveValue(
      "Broke the cycle",
    );
    expect(screen.getByRole("textbox", { name: "turningPoint.description" })).toHaveValue(
      "Sought therapy",
    );
    expect(screen.getByRole("combobox", { name: "turningPoint.category" })).toHaveValue(
      TurningPointCategory.CycleBreaking,
    );
    expect(screen.getByPlaceholderText("turningPoint.datePlaceholder")).toHaveValue("1998");
    expect(screen.getByPlaceholderText("turningPoint.tagsPlaceholder")).toHaveValue(
      "healing, growth",
    );
  });

  it("calls onSave with updated data on blur when editing", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm(makeTurningPoint());

    const titleInput = screen.getByRole("textbox", { name: "turningPoint.titleField" });
    await user.clear(titleInput);
    await user.type(titleInput, "New title");
    fireEvent.blur(titleInput);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "New title" }), ["p1"]);
  });

  it("does not save on blur without a change when editing", () => {
    const { onSave } = renderForm(makeTurningPoint());

    fireEvent.blur(screen.getByRole("textbox", { name: "turningPoint.titleField" }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the editor in place after an autosave commit", () => {
    const { onSave } = renderForm(makeTurningPoint());

    const dateInput = screen.getByPlaceholderText("turningPoint.datePlaceholder");
    fireEvent.change(dateInput, { target: { value: "1999" } });
    fireEvent.blur(dateInput);

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].approximate_date).toBe("1999");
    expect(screen.getByText("turningPoint.titleField")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1999")).toBeInTheDocument();
  });

  it("shows no save or add button in edit mode", () => {
    renderForm(makeTurningPoint());

    expect(screen.queryByText("common.save")).not.toBeInTheDocument();
    expect(screen.queryByText("common.add")).not.toBeInTheDocument();
    expect(screen.getByText("common.delete")).toBeInTheDocument();
  });

  it("shows an add button and no delete in create mode", () => {
    renderForm();

    expect(screen.getByText("common.add")).toBeInTheDocument();
    expect(screen.queryByText("common.delete")).not.toBeInTheDocument();
  });

  it("requires two clicks to delete", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderForm(makeTurningPoint());

    await user.click(screen.getByText("common.delete"));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByText("common.delete"));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("handles significance range input", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.type(screen.getByRole("textbox", { name: "turningPoint.titleField" }), "Test");
    // userEvent does not drive range inputs well; fire the change directly
    fireEvent.change(screen.getByRole("slider"), { target: { value: "6" } });

    await user.click(screen.getByText("common.add"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test", significance: 6 }),
      ["p1"],
    );
  });
});
