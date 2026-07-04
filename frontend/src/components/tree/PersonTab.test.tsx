import { fireEvent, render, screen } from "@testing-library/react";
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
  const view = render(
    <PersonTab person={person} onSavePerson={onSavePerson} onDeletePerson={onDeletePerson} />,
  );
  return { onSavePerson, onDeletePerson, person, ...view };
}

function editAndBlur(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("PersonTab", () => {
  describe("rendering", () => {
    it("renders the name input with person name", () => {
      renderTab({ name: "Bob" });
      expect(screen.getByDisplayValue("Bob")).toBeInTheDocument();
    });

    it("renders the gender select with correct value", () => {
      renderTab({ gender: "male" });
      expect(screen.getByDisplayValue("person.male")).toBeInTheDocument();
    });

    it("renders the birth year input as a text field without spinners", () => {
      renderTab({ birth_year: 1985 });
      const input = screen.getByDisplayValue("1985");
      expect(input).toHaveAttribute("type", "text");
      expect(input).toHaveAttribute("inputmode", "numeric");
    });

    it("renders notes textarea when notes present", () => {
      renderTab({ notes: "Some notes" });
      expect(screen.getByDisplayValue("Some notes")).toBeInTheDocument();
    });

    it("renders adopted toggle unchecked by default", () => {
      renderTab({ is_adopted: false });
      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("renders adopted toggle checked when is_adopted is true", () => {
      renderTab({ is_adopted: true });
      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    it("renders no save button; delete remains", () => {
      renderTab();
      expect(screen.queryByText("person.save")).not.toBeInTheDocument();
      expect(screen.getByText("person.delete")).toBeInTheDocument();
    });

    it("shows a ghost row instead of death fields when there is no death year", () => {
      renderTab({ death_year: null });
      expect(screen.getByText("person.addDeathDate")).toBeInTheDocument();
      expect(screen.queryByText("person.deathYear")).not.toBeInTheDocument();
    });

    it("shows death fields and cause of death when death year is set", () => {
      renderTab({ death_year: 2020 });
      expect(screen.getByDisplayValue("2020")).toBeInTheDocument();
      expect(screen.getByText("person.causeOfDeath")).toBeInTheDocument();
      expect(screen.queryByText("person.addDeathDate")).not.toBeInTheDocument();
    });
  });

  describe("death date ghost row", () => {
    it("reveals the death fields and focuses the year input when clicked", async () => {
      const user = userEvent.setup();
      renderTab({ death_year: null });

      await user.click(screen.getByText("person.addDeathDate"));

      expect(screen.getByText("person.deathYear")).toBeInTheDocument();
      const yearInput = screen
        .getByText("person.deathYear")
        .parentElement?.querySelector("input") as HTMLInputElement;
      expect(yearInput).toHaveFocus();
    });
  });

  describe("month and day fields visibility", () => {
    it("shows month select when birth year is set", () => {
      renderTab({ birth_year: 1990 });
      expect(screen.getByLabelText("person.birthMonth")).toBeInTheDocument();
    });

    it("shows day select when both birth year and birth month are set", () => {
      renderTab({ birth_year: 1990, birth_month: 6 });
      expect(screen.getByLabelText("person.birthDay")).toBeInTheDocument();
    });

    it("does not show month field when birth year is not set", () => {
      renderTab({ birth_year: null });
      expect(screen.queryByLabelText("person.birthMonth")).not.toBeInTheDocument();
    });
  });

  describe("age hint", () => {
    it("displays age hint when birth year is set", () => {
      renderTab({ birth_year: 1960 });
      expect(screen.getByText(/person\.age:/)).toBeInTheDocument();
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

  describe("autosave behavior", () => {
    it("saves an edited name on blur", () => {
      const { onSavePerson } = renderTab({ name: "Alice", birth_year: 1960 });

      editAndBlur(screen.getByDisplayValue("Alice"), "Bob");

      expect(onSavePerson).toHaveBeenCalledOnce();
      const saved: Person = onSavePerson.mock.calls[0][0];
      expect(saved.name).toBe("Bob");
      expect(saved.birth_year).toBe(1960);
    });

    it("does not save when nothing changed", () => {
      const { onSavePerson } = renderTab({ name: "Alice" });

      const input = screen.getByDisplayValue("Alice");
      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(onSavePerson).not.toHaveBeenCalled();
    });

    it("saves immediately when the gender select changes", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({ gender: "female" });

      await user.selectOptions(screen.getByDisplayValue("person.female"), "other");

      expect(onSavePerson).toHaveBeenCalledOnce();
      expect(onSavePerson.mock.calls[0][0].gender).toBe("other");
    });

    it("saves immediately when the adopted toggle changes", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({ is_adopted: false });

      await user.click(screen.getByRole("checkbox"));

      expect(onSavePerson).toHaveBeenCalledOnce();
      expect(onSavePerson.mock.calls[0][0].is_adopted).toBe(true);
    });

    it("commits a single-line field on Enter", () => {
      const { onSavePerson } = renderTab({ name: "Alice" });

      const input = screen.getByDisplayValue("Alice");
      fireEvent.change(input, { target: { value: "Bob" } });
      fireEvent.keyDown(input, { key: "Enter" });
      // blurOnEnter blurs the element; jsdom fires blur via the DOM call.
      fireEvent.blur(input);

      expect(onSavePerson).toHaveBeenCalledOnce();
      expect(onSavePerson.mock.calls[0][0].name).toBe("Bob");
    });

    it("saves notes on blur", () => {
      const { onSavePerson } = renderTab({ notes: null });

      const textarea = screen
        .getByText("person.notes")
        .parentElement?.querySelector("textarea") as HTMLTextAreaElement;
      editAndBlur(textarea, "A note");

      expect(onSavePerson).toHaveBeenCalledOnce();
      expect(onSavePerson.mock.calls[0][0].notes).toBe("A note");
    });

    it("saves notes after the debounce without blurring", () => {
      vi.useFakeTimers();
      try {
        const { onSavePerson } = renderTab({ notes: null });
        const textarea = screen
          .getByText("person.notes")
          .parentElement?.querySelector("textarea") as HTMLTextAreaElement;

        fireEvent.change(textarea, { target: { value: "Slow thought" } });
        expect(onSavePerson).not.toHaveBeenCalled();

        vi.advanceTimersByTime(900);

        expect(onSavePerson).toHaveBeenCalledOnce();
        expect(onSavePerson.mock.calls[0][0].notes).toBe("Slow thought");
      } finally {
        vi.useRealTimers();
      }
    });

    it("flushes a pending edit when unmounted", () => {
      const { onSavePerson, unmount } = renderTab({ name: "Alice" });

      fireEvent.change(screen.getByDisplayValue("Alice"), { target: { value: "Edited" } });
      unmount();

      expect(onSavePerson).toHaveBeenCalledOnce();
      expect(onSavePerson.mock.calls[0][0].name).toBe("Edited");
    });

    it("saves null for cleared optional fields", () => {
      const { onSavePerson } = renderTab({ notes: "old note" });

      const textarea = screen.getByDisplayValue("old note");
      editAndBlur(textarea, "");

      expect(onSavePerson).toHaveBeenCalledOnce();
      expect(onSavePerson.mock.calls[0][0].notes).toBeNull();
    });

    it("preserves the person position on save", () => {
      const { onSavePerson } = renderTab({
        name: "Alice",
        position: { x: 12, y: 34 },
      } as Partial<DecryptedPerson>);

      editAndBlur(screen.getByDisplayValue("Alice"), "Bob");

      expect(onSavePerson.mock.calls[0][0].position).toEqual({ x: 12, y: 34 });
    });
  });

  describe("validation guard", () => {
    it("does not save a blank name and reverts it on blur", () => {
      const { onSavePerson } = renderTab({ name: "Alice" });

      editAndBlur(screen.getByDisplayValue("Alice"), "   ");

      expect(onSavePerson).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
    });

    it("strips non-digits from year input", () => {
      const { onSavePerson } = renderTab({ birth_year: null });

      const yearInput = screen
        .getByText("person.birthYear")
        .parentElement?.querySelector("input") as HTMLInputElement;
      editAndBlur(yearInput, "19a75x");

      expect(onSavePerson).toHaveBeenCalledOnce();
      expect(onSavePerson.mock.calls[0][0].birth_year).toBe(1975);
    });
  });

  describe("delete behavior", () => {
    it("calls onDeletePerson with person id after confirming delete", async () => {
      const user = userEvent.setup();
      const { onDeletePerson } = renderTab({ id: "p42" } as Partial<DecryptedPerson>);

      await user.click(screen.getByText("person.delete"));
      await user.click(screen.getByText("person.delete"));

      expect(onDeletePerson).toHaveBeenCalledWith("p42");
    });
  });

  describe("dependent field clearing", () => {
    it("clears birth month and day when birth year is removed", () => {
      renderTab({ birth_year: 1990, birth_month: 6, birth_day: 15 });

      expect(screen.getByLabelText("person.birthMonth")).toBeInTheDocument();

      fireEvent.change(screen.getByDisplayValue("1990"), { target: { value: "" } });

      expect(screen.queryByLabelText("person.birthMonth")).not.toBeInTheDocument();
    });
  });

  describe("re-render behavior", () => {
    it("keeps an in-progress edit when the same person re-renders", () => {
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
      expect(screen.getByDisplayValue("Edited")).toBeInTheDocument();
    });
  });

  describe("death fields", () => {
    it("saves cause of death once a death year is set", async () => {
      const user = userEvent.setup();
      const { onSavePerson } = renderTab({ birth_year: 1950 });

      await user.click(screen.getByText("person.addDeathDate"));

      const yearInput = screen
        .getByText("person.deathYear")
        .parentElement?.querySelector("input") as HTMLInputElement;
      editAndBlur(yearInput, "2020");

      const causeInput = screen
        .getByText("person.causeOfDeath")
        .parentElement?.querySelector("input") as HTMLInputElement;
      editAndBlur(causeInput, "illness");

      const saved = onSavePerson.mock.calls.at(-1)?.[0] as Person;
      expect(saved.death_year).toBe(2020);
      expect(saved.cause_of_death).toBe("illness");
    });
  });
});
