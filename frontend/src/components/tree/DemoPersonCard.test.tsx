import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { buildDemoState } from "../../lib/buildDemoState";
import type { DemoFixture } from "../../lib/createDemoTree";
import { DemoPersonCard } from "./DemoPersonCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const FIXTURE: DemoFixture = {
  treeName: "Demo",
  persons: [
    {
      id: "p1",
      name: "Ada",
      birth_year: 1942,
      death_year: 1998,
      gender: "female",
      is_adopted: false,
      notes: "the matriarch",
    },
  ],
  relationships: [],
  events: [
    {
      id: "e1",
      person_ids: ["p1"],
      title: "Loss",
      description: "a loss in the family",
      category: "loss",
      approximate_date: "1980",
      severity: 4,
      tags: [],
    },
  ],
  lifeEvents: [
    {
      id: "le1",
      person_ids: ["p1"],
      title: "Graduated",
      description: "finished school",
      category: "education",
      approximate_date: "1960",
      impact: 3,
      tags: [],
    },
  ],
  turningPoints: [],
  classifications: [
    {
      id: "c1",
      person_ids: ["p1"],
      dsm_category: "Neurodevelopmental",
      dsm_subcategory: "",
      status: "suspected",
      diagnosis_year: null,
      periods: [],
      notes: "",
    },
  ],
  patterns: [],
  siblingGroups: [],
};

const state = buildDemoState(FIXTURE);
const person = state.persons.get("p1")!;

function renderCard(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <DemoPersonCard person={person} state={state} onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
}

describe("DemoPersonCard", () => {
  it("shows the person name and year range", () => {
    renderCard();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("1942 - 1998")).toBeInTheDocument();
  });

  it("lists the person's events, life events, and classifications", () => {
    renderCard();
    expect(screen.getByText("Loss")).toBeInTheDocument();
    expect(screen.getByText("Graduated")).toBeInTheDocument();
    expect(screen.getByText("Neurodevelopmental")).toBeInTheDocument();
  });

  it("is read-only: renders no form inputs", () => {
    const { container } = render(
      <MemoryRouter>
        <DemoPersonCard person={person} state={state} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(container.querySelector("input, textarea, select")).toBeNull();
  });

  it("offers a create-your-own CTA linking to register", () => {
    renderCard();
    expect(screen.getByText("demo.live.cta").closest("a")).toHaveAttribute("href", "/register");
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = renderCard();
    fireEvent.click(screen.getByLabelText("common.close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
