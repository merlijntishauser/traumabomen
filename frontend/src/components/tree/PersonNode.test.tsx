import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DecryptedEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { TRAUMA_COLORS } from "../../lib/traumaColors";
import { TraumaCategory } from "../../types/domain";
import { PersonNode } from "./PersonNode";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
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
    gender: "female",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<DecryptedEvent> = {}): DecryptedEvent {
  return {
    id: "e1",
    title: "Event 1",
    description: "desc",
    category: TraumaCategory.Loss,
    approximate_date: "1985",
    severity: 5,
    tags: [],
    person_ids: ["p1"],
    ...overrides,
  };
}

function renderNode(person: DecryptedPerson, events: DecryptedEvent[] = [], selected = false) {
  // PersonNode expects NodeProps shape but we only use data and selected
  const props = {
    id: person.id,
    data: { person, events, lifeEvents: [], classifications: [] },
    selected,
    type: "person",
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    draggable: true,
    dragging: false,
    selectable: true,
    deletable: false,
  } as Parameters<typeof PersonNode>[0];

  return render(<PersonNode {...props} />);
}

describe("PersonNode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders person name", () => {
    renderNode(makePerson({ name: "Alice" }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders birth year with dash and current age when alive", () => {
    renderNode(makePerson({ birth_year: 1960, death_year: null }));
    expect(screen.getByText("1960 - (66)")).toBeInTheDocument();
  });

  it("renders birth and death year with dagger-prefixed age when deceased", () => {
    renderNode(makePerson({ birth_year: 1920, death_year: 1995 }));
    expect(
      screen.getByText((_content, element) =>
        element?.classList.contains("person-node__years")
          ? element.textContent?.includes("1920 - 1995") === true &&
            element.textContent?.includes("\u2020") === true &&
            element.textContent?.includes("75") === true
          : false,
      ),
    ).toBeInTheDocument();
  });

  it("renders unknown birth year as question mark without age", () => {
    renderNode(makePerson({ birth_year: null, death_year: null }));
    expect(screen.getByText("? -")).toBeInTheDocument();
  });

  it("renders unknown birth year with known death year without age", () => {
    renderNode(makePerson({ birth_year: null, death_year: 1995 }));
    expect(screen.getByText("? - 1995")).toBeInTheDocument();
  });

  it("shows adopted label when is_adopted is true", () => {
    renderNode(makePerson({ is_adopted: true }));
    expect(screen.getByText(/person.isAdopted/i)).toBeInTheDocument();
  });

  it("does not show adopted label when is_adopted is false", () => {
    renderNode(makePerson({ is_adopted: false }));
    expect(screen.queryByText(/person.isAdopted/i)).not.toBeInTheDocument();
  });

  it("renders trauma event badges with correct colors", () => {
    const events = [
      makeEvent({ id: "e1", category: TraumaCategory.Loss }),
      makeEvent({ id: "e2", category: TraumaCategory.Abuse }),
    ];
    const { container } = renderNode(makePerson(), events);

    const badges = container.querySelectorAll(".person-node__badge");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveStyle({
      backgroundColor: TRAUMA_COLORS[TraumaCategory.Loss],
    });
    expect(badges[1]).toHaveStyle({
      backgroundColor: TRAUMA_COLORS[TraumaCategory.Abuse],
    });
  });

  it("renders no badges when events array is empty", () => {
    const { container } = renderNode(makePerson(), []);
    expect(container.querySelectorAll(".person-node__badge")).toHaveLength(0);
  });

  it("shows precise age when birthday has not yet passed this year", () => {
    // System time: Jan 1, 2026. Born July 8, 1960.
    // Birthday not yet passed => age = 66 - 1 = 65
    renderNode(makePerson({ birth_year: 1960, birth_month: 7, birth_day: 8 }));
    expect(screen.getByText("1960 - (65)")).toBeInTheDocument();
  });

  it("shows precise age when birthday falls on current date", () => {
    // System time: Jan 1, 2026. Born Jan 1, 1960.
    // Exact birthday => no subtraction => age = 66
    renderNode(makePerson({ birth_year: 1960, birth_month: 1, birth_day: 1 }));
    expect(screen.getByText("1960 - (66)")).toBeInTheDocument();
  });

  it("applies selected class when selected", () => {
    const { container } = renderNode(makePerson(), [], true);
    expect(container.querySelector(".person-node--selected")).toBeInTheDocument();
  });
});
