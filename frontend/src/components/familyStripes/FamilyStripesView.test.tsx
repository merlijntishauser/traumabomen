import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import {
  LifeEventCategory,
  RelationshipType,
  TraumaCategory,
  TurningPointCategory,
} from "../../types/domain";
import { FamilyStripesView, type FamilyStripesViewProps } from "./FamilyStripesView";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
  }),
}));

function person(
  id: string,
  name: string,
  birth: number | null,
  death: number | null = null,
): DecryptedPerson {
  return {
    id,
    name,
    birth_year: birth,
    birth_month: null,
    birth_day: null,
    death_year: death,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "female",
    is_adopted: false,
    notes: null,
  };
}

function rel(
  id: string,
  type: RelationshipType,
  source: string,
  target: string,
): DecryptedRelationship {
  return {
    id,
    type,
    source_person_id: source,
    target_person_id: target,
    periods: [],
    active_period: null,
  };
}

function trauma(
  id: string,
  title: string,
  date: string,
  people: string[],
  category = TraumaCategory.Loss,
) {
  return [
    id,
    {
      id,
      title,
      description: "",
      category,
      approximate_date: date,
      severity: 5,
      tags: [],
      person_ids: people,
    },
  ] as [string, DecryptedEvent];
}

function life(id: string, title: string, date: string, people: string[]) {
  return [
    id,
    {
      id,
      title,
      description: "",
      category: LifeEventCategory.Family,
      approximate_date: date,
      impact: null,
      tags: [],
      person_ids: people,
    },
  ] as [string, DecryptedLifeEvent];
}

const persons = new Map(
  [
    person("ada", "Ada Blake", 1910, 1947),
    person("dorothy", "Dorothy Whitfield", 1935, 2012),
    person("catherine", "Catherine Whitfield", 1958),
    person("sophie", "Sophie Porter", 1985),
    person("lucas", "Lucas Porter", 1988),
    person("emma", "Emma Porter", 2014),
    person("nobirth", "Unknown Aunt", null),
  ].map((p) => [p.id, p]),
);

const relationships = new Map(
  [
    rel("r1", RelationshipType.BiologicalParent, "ada", "dorothy"),
    rel("r2", RelationshipType.BiologicalParent, "dorothy", "catherine"),
    rel("r3", RelationshipType.BiologicalParent, "catherine", "sophie"),
    rel("r4", RelationshipType.BiologicalParent, "catherine", "lucas"),
    rel("r5", RelationshipType.BiologicalParent, "sophie", "emma"),
    rel("r6", RelationshipType.BiologicalParent, "catherine", "nobirth"),
  ].map((r) => [r.id, r]),
);

const events = new Map([
  trauma("war", "War years", "1940-1945", ["ada", "dorothy"], TraumaCategory.War),
  trauma("death", "Death of her mother", "1947", ["dorothy"]),
  trauma("divorced", "Parents divorced", "1997", ["sophie", "lucas"]),
  trauma(
    "hardship",
    "Hardship",
    "about 1997-2000",
    ["catherine", "sophie", "lucas"],
    TraumaCategory.Poverty,
  ),
]);
const lifeEvents = new Map([
  life("divorce", "Divorce", "1997", ["catherine"]),
  life("school", "School years", "after the war", ["catherine"]),
]);
const classifications = new Map<string, DecryptedClassification>([
  [
    "autism",
    {
      id: "autism",
      person_ids: ["dorothy"],
      dsm_category: "neurodevelopmental",
      dsm_subcategory: null,
      status: "suspected",
      diagnosis_year: null,
      periods: [{ start_year: 1935, end_year: 2012 }],
      notes: null,
    },
  ],
]);
const turningPoints = new Map<string, DecryptedTurningPoint>([
  [
    "therapy",
    {
      id: "therapy",
      person_ids: ["catherine"],
      title: "Started therapy",
      description: "",
      category: TurningPointCategory.Recovery,
      approximate_date: "2001",
      significance: null,
      tags: [],
    },
  ],
]);

function setup(overrides: Partial<FamilyStripesViewProps> = {}) {
  const props: FamilyStripesViewProps = {
    persons,
    relationships,
    events,
    lifeEvents,
    classifications,
    turningPoints,
    onOpenPerson: vi.fn(),
    onOpenEntry: vi.fn(),
    ...overrides,
  };
  render(<FamilyStripesView {...props} />);
  return props;
}

const pane = () => screen.getByRole("complementary");
const slider = () => screen.getByRole("slider");
const field = () => screen.getByTestId("stripes-field");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FamilyStripesView", () => {
  it("lists everyone with a birth year by generation and names who cannot be placed", () => {
    setup();
    expect(screen.getAllByText(/^timeline.generation:/)).toHaveLength(5);
    expect(screen.getByText("Ada Blake")).toBeInTheDocument();
    expect(screen.getByText(/timeline.unplaced:.*Unknown Aunt/)).toBeInTheDocument();
  });

  it("opens on the busiest year and reads what it held for everyone", () => {
    setup();
    expect(slider()).toHaveValue("1997");
    const reading = within(pane());
    expect(reading.getByText("1997")).toBeInTheDocument();
    // Sophie and Lucas had the same year, so they share one block with their surname said once
    expect(reading.getByRole("button", { name: "Sophie" })).toBeInTheDocument();
    expect(reading.getByRole("button", { name: "Lucas" })).toBeInTheDocument();
    expect(reading.getByText("Parents divorced")).toBeInTheDocument();
    expect(reading.getByText(/timeline.notYetBorn:.*Emma/)).toBeInTheDocument();
    expect(reading.getByText(/timeline.hadDied:.*Ada/)).toBeInTheDocument();
  });

  it("steps through years with the native slider, Shift for ten, and the pane buttons", () => {
    setup();
    fireEvent.change(slider(), { target: { value: "1998" } });
    expect(slider()).toHaveValue("1998");
    fireEvent.keyDown(slider(), { key: "ArrowLeft", shiftKey: true });
    expect(slider()).toHaveValue("1988");
    fireEvent.keyDown(slider(), { key: "ArrowUp", shiftKey: true });
    expect(slider()).toHaveValue("1998");
    fireEvent.keyDown(slider(), { key: "Enter", shiftKey: true });
    fireEvent.keyDown(slider(), { key: "ArrowLeft" });
    expect(slider()).toHaveValue("1998");
    fireEvent.change(slider(), { target: { value: "2026" } });
    fireEvent.click(within(pane()).getByRole("button", { name: "timeline.previous.year" }));
    expect(slider()).toHaveValue("2025");
    fireEvent.click(within(pane()).getByRole("button", { name: "timeline.next.year" }));
    fireEvent.click(within(pane()).getByRole("button", { name: "timeline.next.year" }));
    expect(slider()).toHaveValue("2026");
  });

  it("picks the year under the pointer, but not at the end of a scroll", () => {
    setup();
    // jsdom has no layout: cells fall back to the 6px minimum from x = 0
    const x = 6 * 44 + 2;
    fireEvent.pointerDown(field(), { clientX: x, clientY: 10 });
    fireEvent.pointerUp(field(), { clientX: x, clientY: 10 });
    expect(slider()).toHaveValue("1944");
    expect(within(pane()).getAllByText("War years")).toHaveLength(2);
    fireEvent.pointerDown(field(), { clientX: x, clientY: 10 });
    fireEvent.pointerUp(field(), { clientX: x + 60, clientY: 10 });
    expect(slider()).toHaveValue("1944");
    fireEvent.pointerUp(field(), { clientX: x, clientY: 10 });
    expect(slider()).toHaveValue("1944");
    fireEvent.pointerMove(field(), { clientX: x });
    fireEvent.pointerMove(field(), { clientX: -40 });
  });

  it("lines lives up by age and reads the year each person reached it", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "timeline.age" }));
    expect(screen.getByRole("button", { name: "timeline.age" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(slider()).toHaveAttribute("aria-label", "timeline.reading.age");
    fireEvent.change(slider(), { target: { value: "0" } });
    expect(slider()).toHaveValue("0");
    act(() => {
      vi.advanceTimersByTime(700);
    });
    fireEvent.click(screen.getByRole("button", { name: "timeline.years" }));
    expect(slider()).toHaveValue("1997");
  });

  it("opens a person from the names column and the pane, and an entry from the pane", () => {
    const props = setup();
    fireEvent.click(screen.getAllByRole("button", { name: /Dorothy Whitfield/ })[0]);
    expect(props.onOpenPerson).toHaveBeenCalledWith("dorothy");
    fireEvent.click(within(pane()).getByRole("button", { name: "Sophie" }));
    expect(props.onOpenPerson).toHaveBeenCalledWith("sophie");
    fireEvent.click(within(pane()).getByText("Divorce"));
    expect(props.onOpenEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: "divorce" }),
      "catherine",
    );
  });

  it("lights up an entry and everything with the same title while it is hovered", () => {
    setup();
    const entry = within(pane()).getByText("Divorce").closest("button")!;
    fireEvent.pointerEnter(entry);
    expect(field()).toHaveClass("fs-field--lit");
    expect(within(pane()).getByText("Parents divorced").closest("button")).toHaveClass("is-dim");
    expect(entry).not.toHaveClass("is-dim");
    fireEvent.pointerLeave(entry);
    expect(field()).not.toHaveClass("fs-field--lit");
  });

  it("lights up a mark's matches when it is hovered in the field", () => {
    setup();
    const mark = field().querySelector('[data-entry="war"]')!;
    fireEvent.pointerOver(mark);
    expect(field().querySelectorAll(".fs-mark--lit").length).toBeGreaterThan(0);
    fireEvent.pointerLeave(field());
    expect(field()).not.toHaveClass("fs-field--lit");
  });

  it("keeps a key item lit when it is clicked, until it is clicked again", () => {
    setup();
    const key = screen.getByRole("list", { name: "timeline.key.label" });
    const loss = within(key).getByRole("button", { name: "trauma.category.loss" });
    fireEvent.click(loss);
    expect(loss).toHaveAttribute("aria-pressed", "true");
    expect(field()).toHaveClass("fs-field--lit");
    expect(within(key).getByRole("button", { name: "trauma.category.war" })).toHaveClass("is-dim");
    fireEvent.click(loss);
    expect(loss).toHaveAttribute("aria-pressed", "false");
    expect(field()).not.toHaveClass("fs-field--lit");
  });

  it("previews a key item on hover and focus", () => {
    setup();
    const war = screen.getByRole("button", { name: "trauma.category.war" });
    fireEvent.focus(war);
    expect(field()).toHaveClass("fs-field--lit");
    fireEvent.blur(war);
    fireEvent.pointerEnter(screen.getByRole("button", { name: "timeline.key.approx" }));
    expect(field()).toHaveClass("fs-field--lit");
  });

  it("quiets everyone else when a person is pointed at", () => {
    setup();
    const row = screen
      .getAllByRole("button", { name: /Catherine Whitfield/ })[0]
      .closest(".fs__person")!;
    fireEvent.pointerEnter(row);
    expect(
      screen.getAllByRole("button", { name: /Ada Blake/ })[0].closest(".fs__person"),
    ).toHaveClass("is-dim");
    fireEvent.pointerLeave(row);
    expect(
      screen.getAllByRole("button", { name: /Ada Blake/ })[0].closest(".fs__person"),
    ).not.toHaveClass("is-dim");
  });

  it("hides ruler labels that scroll under the names column, and keys turning points by category", () => {
    setup();
    const labels = () => [...field().querySelectorAll(".fs-ruler text")].map((n) => n.textContent);
    expect(labels()).toContain("1900");
    const scroller = field().closest(".fs__scroller")!;
    scroller.scrollLeft = 30;
    fireEvent.scroll(scroller);
    expect(labels()).not.toContain("1900");
    expect(
      screen.getByRole("button", { name: "turningPoint.category.recovery" }),
    ).toBeInTheDocument();
  });

  it("points to entries without a year instead of leaving them out silently", () => {
    const props = setup();
    expect(screen.getByText(/timeline.undatedTotal:.*"count":1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /timeline.undatedCount:.*"count":1/ }));
    expect(props.onOpenEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: "school", kind: "life_event" }),
      "catherine",
    );
  });

  it("shows an empty state when nobody has a birth year", () => {
    setup({ persons: new Map([["nobirth", person("nobirth", "Unknown Aunt", null)]]) });
    expect(screen.getByText("timeline.empty")).toBeInTheDocument();
  });
});
