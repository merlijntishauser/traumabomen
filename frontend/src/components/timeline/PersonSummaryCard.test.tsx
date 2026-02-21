import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedEvent, DecryptedLifeEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { LifeEventCategory, TraumaCategory } from "../../types/domain";
import { PersonSummaryCard } from "./PersonSummaryCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === "person.age" && opts?.age) return `Age: ${opts.age}`;
      if (key === "timeline.summaryPresent") return "present";
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

describe("PersonSummaryCard", () => {
  it("renders person name", () => {
    render(
      <PersonSummaryCard
        person={makePerson()}
        events={[]}
        lifeEvents={[]}
        classifications={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("renders year range for living person", () => {
    render(
      <PersonSummaryCard
        person={makePerson()}
        events={[]}
        lifeEvents={[]}
        classifications={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/1960/)).toBeTruthy();
    expect(screen.getByText(/present/)).toBeTruthy();
  });

  it("renders year range for deceased person", () => {
    render(
      <PersonSummaryCard
        person={makePerson({ death_year: 2010 })}
        events={[]}
        lifeEvents={[]}
        classifications={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/1960/)).toBeTruthy();
    expect(screen.getByText(/2010/)).toBeTruthy();
  });

  it("renders age", () => {
    render(
      <PersonSummaryCard
        person={makePerson()}
        events={[]}
        lifeEvents={[]}
        classifications={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Age:/)).toBeTruthy();
  });

  it("renders trauma event count", () => {
    const events: DecryptedEvent[] = [
      {
        id: "e1",
        person_ids: ["p1"],
        title: "Event",
        description: "",
        category: TraumaCategory.Loss,
        approximate_date: "1990",
        severity: 5,
        tags: [],
      },
    ];
    const { container } = render(
      <PersonSummaryCard
        person={makePerson()}
        events={events}
        lifeEvents={[]}
        classifications={[]}
        onClose={vi.fn()}
      />,
    );
    const traumaCount = container.querySelector(".tl-summary-card__count--trauma");
    expect(traumaCount).toBeTruthy();
    expect(traumaCount?.textContent).toBe("1");
  });

  it("renders life event count", () => {
    const lifeEvents: DecryptedLifeEvent[] = [
      {
        id: "le1",
        person_ids: ["p1"],
        title: "Move",
        description: "",
        category: LifeEventCategory.Relocation,
        approximate_date: "1990",
        impact: null,
        tags: [],
      },
    ];
    const { container } = render(
      <PersonSummaryCard
        person={makePerson()}
        events={[]}
        lifeEvents={lifeEvents}
        classifications={[]}
        onClose={vi.fn()}
      />,
    );
    const lifeCount = container.querySelector(".tl-summary-card__count--life");
    expect(lifeCount).toBeTruthy();
    expect(lifeCount?.textContent).toBe("1");
  });

  it("does not render counts section when all empty", () => {
    const { container } = render(
      <PersonSummaryCard
        person={makePerson()}
        events={[]}
        lifeEvents={[]}
        classifications={[]}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector(".tl-summary-card__counts")).toBeNull();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(
      <PersonSummaryCard
        person={makePerson()}
        events={[]}
        lifeEvents={[]}
        classifications={[]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByLabelText("common.close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
