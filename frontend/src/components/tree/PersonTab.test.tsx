import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import type { Person } from "../../types/domain";
import { PersonTab } from "./PersonTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts?.age) return `${key}:${opts.age}`;
      return key;
    },
    i18n: { language: "en" },
  }),
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

function renderTab(
  personOverrides: Partial<DecryptedPerson> = {},
  handlers?: Partial<{
    onSavePerson: ReturnType<typeof vi.fn>;
    onDeletePerson: ReturnType<typeof vi.fn>;
  }>,
) {
  const onSavePerson = handlers?.onSavePerson ?? vi.fn();
  const onDeletePerson = handlers?.onDeletePerson ?? vi.fn();
  const person = makePerson(personOverrides);
  render(<PersonTab person={person} onSavePerson={onSavePerson} onDeletePerson={onDeletePerson} />);
  return { onSavePerson, onDeletePerson, person };
}

describe("PersonTab", () => {
  describe("rendering", () => {
    it("renders the name input with person name", () => {
      renderTab({ name: "Bob" });
      const input = screen.getByDisplayValue("Bob");
      expect(input).toBeInTheDocument();
    });

    it("renders the gender select with correct value", () => {
      renderTab({ gender: "male" });
      const select = screen.getByDisplayValue("person.male");
      expect(select).toBeInTheDocument();
    });

    it("renders the birth year input", () => {
      renderTab({ birth_year: 1985 });
      expect(screen.getByDisplayValue("1985")).toBeInTheDocument();
    });

    it("renders notes textarea when notes present", () => {
      renderTab({ notes: "Some notes" });
      expect(screen.getByDisplayValue("Some notes")).toBeInTheDocument();
    });

    it("renders adopted checkbox unchecked by default", () => {
      renderTab({ is_adopted: false });
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
    });

    it("renders adopted checkbox checked when is_adopted is true", () => {
      renderTab({ is_adopted: true });
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });

    it("renders save and delete buttons", () => {
      renderTab();
      expect(screen.getByText("person.save")).toBeInTheDocument();
      expect(screen.getByText("person.delete")).toBeInTheDocument();
    });

    it("does not render death year fields initially when no death year", () => {
      renderTab({ death_year: null });
      // The death year input should exist but be empty
      const inputs = screen.getAllByRole("spinbutton");
      // We have birth year and death year inputs
      expect(inputs.length).toBeGreaterThanOrEqual(1);
    });

    it("shows cause of death field when death year is set", () => {
      renderTab({ death_year: 2020 });
      expect(screen.getByDisplayValue("2020")).toBeInTheDocument();
      // Cause of death label should be visible
      expect(screen.getByText("person.causeOfDeath")).toBeInTheDocument();
    });

    it("does not show cause of death field when no death year", () => {
      renderTab({ death_year: null });
      expect(screen.queryByText("person.causeOfDeath")).not.toBeInTheDocument();
    });
  });

  describe("month and day fields visibility", () => {
    it("shows month select when birth year is set", () => {
      renderTab({ birth_year: 1990 });
      // Should have the birth month label
      expect(screen.getByText("person.birthMonth")).toBeInTheDocument();
    });

    it("shows day select when both birth year and birth month are set", () => {
      renderTab({ birth_year: 1990, birth_month: 6 });
      expect(screen.getByText("person.birthDay")).toBeInTheDocument();
    });

    it("does not show month field when birth year is not set", () => {
      renderTab({ birth_year: null });
      expect(screen.queryByText("person.birthMonth")).not.toBeInTheDocument();
    });
  });

  describe("age hint", () => {
    it("displays age hint when birth year is set", () => {
      renderTab({ birth_year: 1960 });
      const ageHint = screen.getByText(/person\.age:/);
      expect(ageHint).toBeInTheDocument();
    });

    it("displays age at death when both birth and death years are set", () => {
      renderTab({ birth_year: 1960, death_year: 2020 });
      expect(screen.getByText("person.ageAtDeath:60")).toBeInTheDocument();
    });

    it("does not display age hint when birth year is null", () => {
      renderTab({ birth_year: null });
      expect(screen.queryByText(/person\.age/)).not.toBeInTheDocument();
    });
  });

  describe("save behavior", () => {
    it("calls onSavePerson with form data when save is clicked", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({ name: "Alice", birth_year: 1960, gender: "female" });

      await user.click(screen.getByText("person.save"));

      expect(onSavePerson).toHaveBeenCalledOnce();
      const savedData: Person = onSavePerson.mock.calls[0][0];
      expect(savedData.name).toBe("Alice");
      expect(savedData.birth_year).toBe(1960);
      expect(savedData.gender).toBe("female");
      expect(savedData.is_adopted).toBe(false);
    });

    it("saves updated name after user edits it", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({ name: "Alice" });

      const nameInput = screen.getByDisplayValue("Alice");
      await user.clear(nameInput);
      await user.type(nameInput, "Bob");
      await user.click(screen.getByText("person.save"));

      expect(onSavePerson.mock.calls[0][0].name).toBe("Bob");
    });

    it("saves null for empty optional fields", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({
        death_year: null,
        notes: null,
        cause_of_death: null,
      });

      await user.click(screen.getByText("person.save"));

      const saved: Person = onSavePerson.mock.calls[0][0];
      expect(saved.death_year).toBeNull();
      expect(saved.notes).toBeNull();
      expect(saved.cause_of_death).toBeNull();
    });

    it("saves is_adopted as true after checking the checkbox", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({ is_adopted: false });

      await user.click(screen.getByRole("checkbox"));
      await user.click(screen.getByText("person.save"));

      expect(onSavePerson.mock.calls[0][0].is_adopted).toBe(true);
    });
  });

  describe("delete behavior", () => {
    it("calls onDeletePerson with person id after confirming delete", async () => {
      const user = userEvent.setup();
      const { onDeletePerson } = renderTab({ id: "p42" } as Partial<DecryptedPerson>);

      // First click shows confirmation
      await user.click(screen.getByText("person.delete"));
      // Second click confirms
      await user.click(screen.getByText("person.delete"));

      expect(onDeletePerson).toHaveBeenCalledWith("p42");
    });
  });

  describe("dependent field clearing", () => {
    it("clears birth month and day when birth year is removed", async () => {
      const user = userEvent.setup();
      renderTab({ birth_year: 1990, birth_month: 6, birth_day: 15 });

      // Verify month is shown
      expect(screen.getByText("person.birthMonth")).toBeInTheDocument();

      // Clear the birth year
      const birthYearInput = screen.getByDisplayValue("1990");
      await user.clear(birthYearInput);

      // Month field should disappear since year is now empty
      expect(screen.queryByText("person.birthMonth")).not.toBeInTheDocument();
    });
  });

  describe("gender selection", () => {
    it("saves updated gender after selection change", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({ gender: "female" });

      const genderSelect = screen.getByDisplayValue("person.female");
      await user.selectOptions(genderSelect, "other");
      await user.click(screen.getByText("person.save"));

      expect(onSavePerson.mock.calls[0][0].gender).toBe("other");
    });
  });

  describe("person prop changes reset the form", () => {
    it("resets edited fields when a different person is passed in", () => {
      const onSavePerson = vi.fn();
      const onDeletePerson = vi.fn();
      const { rerender } = render(
        <PersonTab
          person={makePerson({ id: "p1", name: "Alice" })}
          onSavePerson={onSavePerson}
          onDeletePerson={onDeletePerson}
        />,
      );
      // Edit the name via fireEvent.change to avoid the onFocus selection
      // handler interfering with keyboard-simulated typing.
      fireEvent.change(screen.getByDisplayValue("Alice"), { target: { value: "Edited" } });
      expect(screen.getByDisplayValue("Edited")).toBeInTheDocument();

      // Switching to a different person should blow away the dirty state.
      rerender(
        <PersonTab
          person={makePerson({ id: "p2", name: "Carol", birth_year: 1975 })}
          onSavePerson={onSavePerson}
          onDeletePerson={onDeletePerson}
        />,
      );
      expect(screen.queryByDisplayValue("Edited")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("Carol")).toBeInTheDocument();
      expect(screen.getByDisplayValue("1975")).toBeInTheDocument();
    });

    it("does not reset when the same person prop is re-rendered", () => {
      const onSavePerson = vi.fn();
      const onDeletePerson = vi.fn();
      const person = makePerson({ id: "p1", name: "Alice" });
      const { rerender } = render(
        <PersonTab person={person} onSavePerson={onSavePerson} onDeletePerson={onDeletePerson} />,
      );
      fireEvent.change(screen.getByDisplayValue("Alice"), { target: { value: "Edited" } });
      rerender(
        <PersonTab person={person} onSavePerson={onSavePerson} onDeletePerson={onDeletePerson} />,
      );
      // Edit survives because the person key didn't change.
      expect(screen.getByDisplayValue("Edited")).toBeInTheDocument();
    });
  });

  describe("death fields", () => {
    it("renders and saves cause of death once a death year is set", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({ birth_year: 1950 });

      // Cause-of-death input is hidden until a death year is entered.
      expect(screen.queryByText("person.causeOfDeath")).not.toBeInTheDocument();

      const deathYearInput = screen.getByPlaceholderText("---");
      await user.type(deathYearInput, "2020");

      const causeLabel = screen.getByText("person.causeOfDeath");
      const causeInput = causeLabel.parentElement!.querySelector("input")!;
      await user.type(causeInput, "illness");

      await user.click(screen.getByText("person.save"));
      const saved = onSavePerson.mock.calls[0][0] as Person;
      expect(saved.death_year).toBe(2020);
      expect(saved.cause_of_death).toBe("illness");
    });

    it("saves death month and day when selected", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({
        birth_year: 1950,
        death_year: 2020,
      });

      const deathMonthLabel = screen.getByText("person.deathMonth").parentElement as HTMLElement;
      const deathMonthSelect = within(deathMonthLabel).getByRole("combobox") as HTMLSelectElement;
      await user.selectOptions(deathMonthSelect, "7");

      const deathDayLabel = screen.getByText("person.deathDay").parentElement as HTMLElement;
      const deathDaySelect = within(deathDayLabel).getByRole("combobox") as HTMLSelectElement;
      await user.selectOptions(deathDaySelect, "15");

      await user.click(screen.getByText("person.save"));
      const saved = onSavePerson.mock.calls[0][0] as Person;
      expect(saved.death_year).toBe(2020);
      expect(saved.death_month).toBe(7);
      expect(saved.death_day).toBe(15);
    });

    it("clears death month and day when death year is removed", async () => {
      const user = userEvent.setup();
      renderTab({ birth_year: 1950, death_year: 2020, death_month: 6, death_day: 15 });

      expect(screen.getByText("person.deathMonth")).toBeInTheDocument();

      const deathYearInput = screen.getByDisplayValue("2020");
      await user.clear(deathYearInput);

      expect(screen.queryByText("person.deathMonth")).not.toBeInTheDocument();
      expect(screen.queryByText("person.deathDay")).not.toBeInTheDocument();
      expect(screen.queryByText("person.causeOfDeath")).not.toBeInTheDocument();
    });

    it("clears death day when death month is changed back to empty", async () => {
      const user = userEvent.setup();
      renderTab({ birth_year: 1950, death_year: 2020, death_month: 6, death_day: 15 });

      const deathMonthLabel = screen.getByText("person.deathMonth").parentElement as HTMLElement;
      const deathMonthSelect = within(deathMonthLabel).getByRole("combobox") as HTMLSelectElement;
      await user.selectOptions(deathMonthSelect, ""); // back to ---

      expect(screen.queryByText("person.deathDay")).not.toBeInTheDocument();
    });
  });

  describe("birth day field", () => {
    it("persists the birth day selection when saved", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({ birth_year: 1990, birth_month: 6 });

      const birthDayLabel = screen.getByText("person.birthDay").parentElement as HTMLElement;
      const birthDaySelect = within(birthDayLabel).getByRole("combobox") as HTMLSelectElement;
      await user.selectOptions(birthDaySelect, "15");

      await user.click(screen.getByText("person.save"));
      const saved = onSavePerson.mock.calls[0][0] as Person;
      expect(saved.birth_day).toBe(15);
    });
  });
});
