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
      cause_of_death: null,
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

  it("returns null when life event entity is not found", () => {
    const { container } = render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "life_event", entityId: "missing" }}
        persons={persons}
        events={emptyEvents}
        lifeEvents={lifeEvents}
        classifications={emptyClassifications}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector(".tl-summary-card")).toBeNull();
  });

  it("returns null when classification entity is not found", () => {
    const { container } = render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "classification", entityId: "missing" }}
        persons={persons}
        events={emptyEvents}
        lifeEvents={emptyLifeEvents}
        classifications={classifications}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector(".tl-summary-card")).toBeNull();
  });

  it("renders classification with subcategory label", () => {
    const clsWithSub = new Map<string, DecryptedClassification>([
      [
        "c2",
        {
          id: "c2",
          person_ids: ["p1"],
          dsm_category: "neurodevelopmental",
          dsm_subcategory: "adhd",
          status: "diagnosed",
          diagnosis_year: 2010,
          periods: [{ start_year: 2010, end_year: null }],
          notes: null,
        },
      ],
    ]);

    render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "classification", entityId: "c2" }}
        persons={persons}
        events={emptyEvents}
        lifeEvents={emptyLifeEvents}
        classifications={clsWithSub}
        onClose={vi.fn()}
      />,
    );
    // With subcategory, the name should be "catLabel: subLabel"
    expect(screen.getByText("dsm.neurodevelopmental: dsm.sub.adhd")).toBeTruthy();
    expect(screen.getByText("classification.status.diagnosed")).toBeTruthy();
    expect(screen.getByText("2010")).toBeTruthy();
  });

  it("renders classification without diagnosis_year", () => {
    const clsNoDiag = new Map<string, DecryptedClassification>([
      [
        "c3",
        {
          id: "c3",
          person_ids: ["p1"],
          dsm_category: "anxiety",
          dsm_subcategory: null,
          status: "suspected",
          diagnosis_year: null,
          periods: [{ start_year: 1995, end_year: null }],
          notes: null,
        },
      ],
    ]);

    const { container } = render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "classification", entityId: "c3" }}
        persons={persons}
        events={emptyEvents}
        lifeEvents={emptyLifeEvents}
        classifications={clsNoDiag}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("dsm.anxiety")).toBeTruthy();
    expect(screen.getByText("classification.status.suspected")).toBeTruthy();
    // Should not render a diagnosis year detail row
    const details = container.querySelectorAll(".tl-summary-card__detail");
    expect(details).toHaveLength(0);
  });

  it("falls back to empty string when personId is not in the persons map", () => {
    render(
      <MarkerDetailCard
        info={{ personId: "unknown", entityType: "trauma_event", entityId: "e1" }}
        persons={persons}
        events={events}
        lifeEvents={emptyLifeEvents}
        classifications={emptyClassifications}
        onClose={vi.fn()}
      />,
    );
    // The person row should still render but with empty text
    const personEl = document.querySelector(".tl-summary-card__person");
    expect(personEl).toBeTruthy();
    expect(personEl?.textContent).toBe("");
  });

  it("hides impact row when life event impact is zero", () => {
    const leNoImpact = new Map<string, DecryptedLifeEvent>([
      [
        "le2",
        {
          id: "le2",
          person_ids: ["p1"],
          title: "Minor change",
          description: "",
          category: LifeEventCategory.Relocation,
          approximate_date: "1990",
          impact: 0,
          tags: [],
        },
      ],
    ]);

    const { container } = render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "life_event", entityId: "le2" }}
        persons={persons}
        events={emptyEvents}
        lifeEvents={leNoImpact}
        classifications={emptyClassifications}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Minor change")).toBeTruthy();
    // Only the approximate_date detail should render, not impact
    const details = container.querySelectorAll(".tl-summary-card__detail");
    expect(details).toHaveLength(1);
    expect(details[0].textContent).toBe("1990");
  });

  it("hides severity row when trauma event severity is zero", () => {
    const noSevEvents = new Map<string, DecryptedEvent>([
      [
        "e2",
        {
          id: "e2",
          person_ids: ["p1"],
          title: "Minor event",
          description: "",
          category: TraumaCategory.Loss,
          approximate_date: "1985",
          severity: 0,
          tags: [],
        },
      ],
    ]);

    const { container } = render(
      <MarkerDetailCard
        info={{ personId: "p1", entityType: "trauma_event", entityId: "e2" }}
        persons={persons}
        events={noSevEvents}
        lifeEvents={emptyLifeEvents}
        classifications={emptyClassifications}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Minor event")).toBeTruthy();
    // Only the approximate_date detail should render, not severity
    const details = container.querySelectorAll(".tl-summary-card__detail");
    expect(details).toHaveLength(1);
    expect(details[0].textContent).toBe("1985");
  });
});
