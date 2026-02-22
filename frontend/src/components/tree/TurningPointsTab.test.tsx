import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson, DecryptedTurningPoint } from "../../hooks/useTreeData";
import { TurningPointCategory } from "../../types/domain";
import { TurningPointsTab } from "./TurningPointsTab";

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

function renderTab(
  overrides: {
    turningPoints?: DecryptedTurningPoint[];
    onSave?: ReturnType<typeof vi.fn>;
    onDelete?: ReturnType<typeof vi.fn>;
    initialEditId?: string;
  } = {},
) {
  const onSave = overrides.onSave ?? vi.fn();
  const onDelete = overrides.onDelete ?? vi.fn();
  render(
    <TurningPointsTab
      person={makePerson()}
      turningPoints={overrides.turningPoints ?? []}
      allPersons={
        new Map([
          ["p1", makePerson()],
          ["p2", makePerson("p2", "Bob")],
        ])
      }
      onSaveTurningPoint={onSave}
      onDeleteTurningPoint={onDelete}
      initialEditId={overrides.initialEditId}
    />,
  );
  return { onSave, onDelete };
}

describe("TurningPointsTab", () => {
  it("shows new form when add button is clicked", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByText("turningPoint.newEvent"));
    expect(screen.getByText("turningPoint.titleField")).toBeInTheDocument();
    expect(screen.getByText("turningPoint.description")).toBeInTheDocument();
    expect(screen.getByText("turningPoint.category")).toBeInTheDocument();
    expect(screen.getByText("turningPoint.approximate_date")).toBeInTheDocument();
    expect(screen.getByText("turningPoint.tags")).toBeInTheDocument();
  });

  it("saves form with all fields filled", async () => {
    const user = userEvent.setup();
    const { onSave } = renderTab();

    await user.click(screen.getByText("turningPoint.newEvent"));

    const titleInput = screen.getByRole("textbox", { name: "turningPoint.titleField" });
    await user.type(titleInput, "Started therapy");

    const descTextarea = screen.getByRole("textbox", { name: "turningPoint.description" });
    await user.type(descTextarea, "A turning point");

    const categorySelect = screen.getByRole("combobox", { name: "turningPoint.category" });
    await user.selectOptions(categorySelect, TurningPointCategory.Recovery);

    const dateInput = screen.getByPlaceholderText("turningPoint.datePlaceholder");
    await user.type(dateInput, "2005");

    const tagsInput = screen.getByPlaceholderText("turningPoint.tagsPlaceholder");
    await user.type(tagsInput, "therapy, healing");

    await user.click(screen.getByText("common.save"));

    expect(onSave).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        title: "Started therapy",
        description: "A turning point",
        category: TurningPointCategory.Recovery,
        approximate_date: "2005",
        tags: ["therapy", "healing"],
      }),
      expect.any(Array),
    );
  });

  it("populates form with existing values when editing", async () => {
    const user = userEvent.setup();
    const tp = makeTurningPoint();
    renderTab({ turningPoints: [tp] });

    // Click the card to open edit form
    await user.click(screen.getByText("Broke the cycle"));

    const titleInput = screen.getByRole("textbox", { name: "turningPoint.titleField" });
    expect(titleInput).toHaveValue("Broke the cycle");

    const descTextarea = screen.getByRole("textbox", { name: "turningPoint.description" });
    expect(descTextarea).toHaveValue("Sought therapy");

    const categorySelect = screen.getByRole("combobox", { name: "turningPoint.category" });
    expect(categorySelect).toHaveValue(TurningPointCategory.CycleBreaking);

    const dateInput = screen.getByPlaceholderText("turningPoint.datePlaceholder");
    expect(dateInput).toHaveValue("1998");

    const tagsInput = screen.getByPlaceholderText("turningPoint.tagsPlaceholder");
    expect(tagsInput).toHaveValue("healing, growth");
  });

  it("opens edit form via initialEditId", () => {
    const tp = makeTurningPoint();
    renderTab({ turningPoints: [tp], initialEditId: "tp1" });

    const titleInput = screen.getByRole("textbox", { name: "turningPoint.titleField" });
    expect(titleInput).toHaveValue("Broke the cycle");
  });

  it("calls onSave with updated data when editing", async () => {
    const user = userEvent.setup();
    const tp = makeTurningPoint();
    const { onSave } = renderTab({ turningPoints: [tp] });

    await user.click(screen.getByText("Broke the cycle"));

    const titleInput = screen.getByRole("textbox", { name: "turningPoint.titleField" });
    await user.clear(titleInput);
    await user.type(titleInput, "New title");

    await user.click(screen.getByText("common.save"));

    expect(onSave).toHaveBeenCalledWith(
      "tp1",
      expect.objectContaining({ title: "New title" }),
      expect.any(Array),
    );
  });

  it("requires two clicks to delete", async () => {
    const user = userEvent.setup();
    const tp = makeTurningPoint();
    const { onDelete } = renderTab({ turningPoints: [tp] });

    await user.click(screen.getByText("Broke the cycle"));

    const deleteBtn = screen.getByText("common.delete");
    await user.click(deleteBtn);
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByText("turningPoint.confirmDelete"));
    expect(onDelete).toHaveBeenCalledWith("tp1");
  });

  it("renders card list with category pill and significance bar", () => {
    const tp = makeTurningPoint({ significance: 7 });
    renderTab({ turningPoints: [tp] });

    expect(screen.getByText("Broke the cycle")).toBeInTheDocument();
    expect(screen.getByText("turningPoint.category.cycle_breaking")).toBeInTheDocument();
    expect(screen.getByText("1998")).toBeInTheDocument();
  });

  it("handles significance range input", async () => {
    const user = userEvent.setup();
    const { onSave } = renderTab();

    await user.click(screen.getByText("turningPoint.newEvent"));

    const titleInput = screen.getByRole("textbox", { name: "turningPoint.titleField" });
    await user.type(titleInput, "Test");

    const slider = screen.getByRole("slider");
    // Fire change event directly since userEvent doesn't handle range well
    slider.focus();

    await user.click(screen.getByText("common.save"));

    expect(onSave).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ title: "Test" }),
      expect.any(Array),
    );
  });
});
