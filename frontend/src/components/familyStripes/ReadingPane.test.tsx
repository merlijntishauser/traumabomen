import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { buildStripeLayout, readAt, type StripeEntry } from "../../lib/familyStripes";
import { ReadingPane, type ReadingPaneProps } from "./ReadingPane";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
  }),
}));

const NOW = 2026;

function person(id: string, birth: number, death: number | null = null): DecryptedPerson {
  return {
    id,
    name: `${id} Smith`,
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

const rows = buildStripeLayout(
  new Map([
    ["old", person("old", 1900, 1950)],
    ["mid", person("mid", 1960)],
    ["new", person("new", 2020)],
    ["quiet", person("quiet", 1970)],
    ["unsure", person("unsure", 1975)],
  ]),
  new Map(),
  NOW,
).rows;

const entries: StripeEntry[] = [
  {
    id: "dx",
    kind: "classification",
    category: "diagnosed",
    title: "Depression",
    personIds: ["mid"],
    spans: [{ from: 1990, to: NOW }],
    approx: false,
  },
  {
    id: "school",
    kind: "life_event",
    category: "education",
    title: "School years",
    personIds: ["mid"],
    spans: [],
    approx: true,
    relative: { kind: "ages", from: 4, to: 12 },
  },
  {
    id: "old",
    kind: "life_event",
    category: "health",
    title: "Later years",
    personIds: ["mid"],
    spans: [],
    approx: true,
    relative: { kind: "ages", from: 65, to: 110 },
  },
  {
    id: "twelve",
    kind: "trauma_event",
    category: "loss",
    title: "Moved house",
    personIds: ["mid"],
    spans: [],
    approx: true,
    relative: { kind: "ages", from: 12, to: 12 },
  },
  {
    id: "move",
    kind: "life_event",
    category: "relocation",
    title: "",
    personIds: ["new"],
    spans: [{ from: 2020, to: 2020 }],
    approx: true,
  },
];

function renderPane(overrides: Partial<ReadingPaneProps>) {
  const mode = overrides.mode ?? "years";
  const value = overrides.value ?? 2020;
  const props: ReadingPaneProps = {
    mode,
    value,
    reading: readAt(rows, entries, mode, value, NOW),
    now: NOW,
    coarsePointer: false,
    lit: null,
    focusPersonId: null,
    onStep: vi.fn(),
    onOpenPerson: vi.fn(),
    onOpenEntry: vi.fn(),
    onHoverEntry: vi.fn(),
    onFocusPerson: vi.fn(),
    undatedFor: new Map([["unsure", [{ id: "u1", kind: "trauma_event", personIds: ["unsure"] }]]]),
    ...overrides,
  };
  render(<ReadingPane {...props} />);
  return props;
}

describe("ReadingPane", () => {
  it("says dates read by age as ages, not as the years they land on", () => {
    renderPane({ value: 1972 });
    expect(screen.getByText(/timeline\.date\.ages:/)).toBeInTheDocument();
    expect(screen.getByText(/timeline\.date\.age:/)).toBeInTheDocument();
  });

  it("says stages that run to the end of life as from an age", () => {
    renderPane({ mode: "age", value: 66 });
    expect(screen.getByText(/timeline\.date\.fromAge:/)).toBeInTheDocument();
  });

  it("only says nothing was recorded of people without undated entries", () => {
    renderPane({});
    const notes = screen.getByText(/timeline.nothingRecorded/).textContent ?? "";
    expect(notes).toContain('timeline.nothingRecorded:{"names":"quiet"}');
    expect(notes).toContain('timeline.maybeUndated:{"names":"unsure","count":1}');
  });

  it("says an ongoing classification runs onwards and marks approximate dates", () => {
    renderPane({});
    expect(screen.getByText(/timeline.entryMeta:.*timeline.date.onwards/)).toBeInTheDocument();
    expect(screen.getByText(/timeline.entryMeta:.*timeline.date.about/)).toBeInTheDocument();
    expect(screen.getByText("personPage.untitled")).toBeInTheDocument();
    expect(screen.getByText("timeline.bornThisYear")).toBeInTheDocument();
  });

  it("names who had not reached an age and who never did, in age mode", () => {
    renderPane({ mode: "age", value: 60 });
    expect(screen.getByText(/timeline.notYetAge:.*new/)).toBeInTheDocument();
    expect(screen.getByText(/timeline.didNotReach:.*old/)).toBeInTheDocument();
    expect(screen.getByText(/timeline.questionAge.0/)).toBeInTheDocument();
    expect(screen.getByText("timeline.hint.age")).toBeInTheDocument();
  });

  it("says when the age falls in the present year", () => {
    renderPane({ mode: "age", value: 66 });
    expect(screen.getByText(/timeline.inYearNow/)).toBeInTheDocument();
  });

  it("gives touch screens a tap hint", () => {
    renderPane({ coarsePointer: true });
    expect(screen.getByText("timeline.hint.yearTouch")).toBeInTheDocument();
  });

  it("reports pointing at a person and stepping", () => {
    const props = renderPane({});
    const block = screen.getByRole("button", { name: "mid Smith" }).closest("li")!;
    fireEvent.pointerEnter(block);
    expect(props.onFocusPerson).toHaveBeenCalledWith("mid");
    fireEvent.pointerLeave(block);
    expect(props.onFocusPerson).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: "timeline.next.year" }));
    expect(props.onStep).toHaveBeenCalledWith(1);
  });

  it("dims blocks that do not belong to the person pointed at", () => {
    renderPane({ focusPersonId: "new" });
    expect(screen.getByRole("button", { name: "mid Smith" }).closest("li")).toHaveClass("is-dim");
  });
});
