import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import { LifeEventCategory, TraumaCategory } from "../../types/domain";
import { MarkerDetailCard } from "./MarkerDetailCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && "value" in opts) return `${key.split(".").pop()}: ${opts.value}`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

const persons = new Map<string, DecryptedPerson>([
  [
    "p1",
    {
      id: "p1",
      name: "Alice",
      birth_year: 1960,
      birth_month: null,
      birth_day: null,
      death_year: null,
      death_month: null,
      death_day: null,
      gender: "female",
      is_adopted: false,
      notes: null,
    },
  ],
]);

const events = new Map<string, DecryptedEvent>([
  [
    "e1",
    {
      id: "e1",
      person_ids: ["p1"],
      title: "House Fire",
      description: "desc",
      category: TraumaCategory.Loss,
      approximate_date: "1990",
      severity: 7,
      tags: [],
    },
  ],
]);

const lifeEvents = new Map<string, DecryptedLifeEvent>([
  [
    "le1",
    {
      id: "le1",
      person_ids: ["p1"],
      title: "Moved to Amsterdam",
      description: "",
      category: LifeEventCategory.Relocation,
      approximate_date: "1985",
      impact: 3,
      tags: [],
    },
  ],
]);

const classifications = new Map<string, DecryptedClassification>([
  [
    "c1",
    {
      id: "c1",
      person_ids: ["p1"],
      dsm_category: "anxiety",
      dsm_subcategory: null,
      status: "diagnosed",
      diagnosis_year: 2000,
      periods: [{ start_year: 2000, end_year: null }],
      notes: null,
    },
  ],
]);

const emptyEvents = new Map<string, DecryptedEvent>();
const emptyLifeEvents = new Map<string, DecryptedLifeEvent>();
const emptyClassifications = new Map<string, DecryptedClassification>();

describe("MarkerDetailCard", () => {
  it("renders trauma event details", () => {
    render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "trauma_event", entityId: "e1" }}
        persons={persons}
        events={events}
        lifeEvents={emptyLifeEvents}
        classifications={emptyClassifications}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("House Fire")).toBeTruthy();
    expect(screen.getByText("trauma.category.loss")).toBeTruthy();
    expect(screen.getByText("1990")).toBeTruthy();
    expect(screen.getByText("severity: 7")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("renders life event details", () => {
    render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "life_event", entityId: "le1" }}
        persons={persons}
        events={emptyEvents}
        lifeEvents={lifeEvents}
        classifications={emptyClassifications}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Moved to Amsterdam")).toBeTruthy();
    expect(screen.getByText("lifeEvent.category.relocation")).toBeTruthy();
    expect(screen.getByText("1985")).toBeTruthy();
    expect(screen.getByText("impact: 3")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("renders classification details", () => {
    render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "classification", entityId: "c1" }}
        persons={persons}
        events={emptyEvents}
        lifeEvents={emptyLifeEvents}
        classifications={classifications}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("dsm.anxiety")).toBeTruthy();
    expect(screen.getByText("classification.status.diagnosed")).toBeTruthy();
    expect(screen.getByText("2000")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "trauma_event", entityId: "e1" }}
        persons={persons}
        events={events}
        lifeEvents={emptyLifeEvents}
        classifications={emptyClassifications}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByLabelText("common.close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns null for unknown entity id", () => {
    const { container } = render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "trauma_event", entityId: "missing" }}
        persons={persons}
        events={events}
        lifeEvents={emptyLifeEvents}
        classifications={emptyClassifications}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector(".tl-summary-card")).toBeNull();
  });
});
