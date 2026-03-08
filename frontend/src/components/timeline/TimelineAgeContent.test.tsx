import { cleanup, fireEvent, render } from "@testing-library/react";
import type * as d3 from "d3";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { PartnerStatus, RelationshipType } from "../../types/domain";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../lib/traumaColors", () => ({
  getTraumaColors: () => ({ loss: "#ff0000" }),
}));

vi.mock("../../lib/lifeEventColors", () => ({
  getLifeEventColors: () => ({ career: "#00ff00" }),
}));

vi.mock("../../lib/turningPointColors", () => ({
  getTurningPointColors: () => ({ recovery: "#0000ff" }),
}));

const noopZoomActions = { zoomIn: () => {}, zoomOut: () => {}, resetZoom: () => {} };
vi.mock("../../hooks/useTimelineZoom", () => ({
  useTimelineZoom: ({ scale }: { scale: d3.ScaleLinear<number, number> }) => ({
    rescaled: scale,
    zoomK: 1,
    zoomActions: noopZoomActions,
  }),
}));

function makePerson(id: string, overrides: Partial<DecryptedPerson> = {}): DecryptedPerson {
  return {
    id,
    name: `Person ${id}`,
    birth_year: 1980,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "unknown",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

function makeBaseProps() {
  return {
    relationships: new Map<string, DecryptedRelationship>(),
    events: new Map<string, DecryptedEvent>(),
    lifeEvents: new Map<string, DecryptedLifeEvent>(),
    turningPoints: new Map<string, DecryptedTurningPoint>(),
    classifications: new Map<string, DecryptedClassification>(),
    width: 800,
    height: 400,
    mode: "full" as const,
    selectedPersonId: null,
    onTooltip: vi.fn(),
  };
}

const { TimelineAgeContent } = await import("./TimelineAgeContent");

describe("TimelineAgeContent", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders SVG with age clip path and column headers", () => {
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const { container } = render(
      <TimelineAgeContent {...makeBaseProps()} persons={new Map([["p1", p1]])} />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("#timeline-clip-age")).toBeTruthy();
    expect(container.querySelector(".tl-col-header")).toBeTruthy();
    expect(container.querySelector(".tl-col-person-name")).toBeTruthy();
  });

  it("shows tooltip on person name mouseenter and hides on mouseleave", () => {
    const onTooltip = vi.fn();
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const { container } = render(
      <TimelineAgeContent
        {...makeBaseProps()}
        persons={new Map([["p1", p1]])}
        onTooltip={onTooltip}
      />,
    );
    const personName = container.querySelector(".tl-col-person-name")!;
    expect(personName).toBeTruthy();

    fireEvent.mouseEnter(personName);
    expect(onTooltip).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        lines: [{ text: "Alice", bold: true }],
      }),
    );

    onTooltip.mockClear();
    fireEvent.mouseLeave(personName);
    expect(onTooltip).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it("renders partner lines between partners", () => {
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
    const { container } = render(
      <TimelineAgeContent
        {...makeBaseProps()}
        persons={
          new Map([
            ["p1", p1],
            ["p2", p2],
          ])
        }
        relationships={
          new Map<string, DecryptedRelationship>([
            [
              "r1",
              {
                id: "r1",
                type: RelationshipType.Partner,
                source_person_id: "p1",
                target_person_id: "p2",
                periods: [{ start_year: 1985, end_year: null, status: PartnerStatus.Married }],
                active_period: null,
              },
            ],
          ])
        }
      />,
    );
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it("calls onClickPartnerLine when partner line hit area is clicked", () => {
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const p2 = makePerson("p2", { name: "Bob", birth_year: 1958 });
    const onClickPartnerLine = vi.fn();
    const { container } = render(
      <TimelineAgeContent
        {...makeBaseProps()}
        persons={
          new Map([
            ["p1", p1],
            ["p2", p2],
          ])
        }
        relationships={
          new Map<string, DecryptedRelationship>([
            [
              "r1",
              {
                id: "r1",
                type: RelationshipType.Partner,
                source_person_id: "p1",
                target_person_id: "p2",
                periods: [{ start_year: 1985, end_year: null, status: PartnerStatus.Married }],
                active_period: null,
              },
            ],
          ])
        }
        onClickPartnerLine={onClickPartnerLine}
      />,
    );
    // The clickable hit area is a transparent-stroke line with cursor pointer
    const hitArea = container.querySelector('line[stroke="transparent"]');
    expect(hitArea).toBeTruthy();
    fireEvent.click(hitArea!);
    expect(onClickPartnerLine).toHaveBeenCalledWith("r1");
  });

  it("calls onSelectPerson when person name label is clicked", () => {
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const onSelectPerson = vi.fn();
    const { container } = render(
      <TimelineAgeContent
        {...makeBaseProps()}
        persons={new Map([["p1", p1]])}
        onSelectPerson={onSelectPerson}
      />,
    );
    const personName = container.querySelector(".tl-col-person-name")!;
    fireEvent.click(personName);
    expect(onSelectPerson).toHaveBeenCalledWith("p1");
  });

  it("deselects person when clicking already selected person name", () => {
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const onSelectPerson = vi.fn();
    const { container } = render(
      <TimelineAgeContent
        {...makeBaseProps()}
        persons={new Map([["p1", p1]])}
        selectedPersonId="p1"
        onSelectPerson={onSelectPerson}
      />,
    );
    const personName = container.querySelector(".tl-col-person-name")!;
    fireEvent.click(personName);
    expect(onSelectPerson).toHaveBeenCalledWith(null);
  });

  it("calls onSelectPerson(null) when background rect is clicked", () => {
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const onSelectPerson = vi.fn();
    const { container } = render(
      <TimelineAgeContent
        {...makeBaseProps()}
        persons={new Map([["p1", p1]])}
        onSelectPerson={onSelectPerson}
      />,
    );
    const bgRects = container.querySelectorAll('rect[fill="transparent"]');
    const bgRect = Array.from(bgRects).find((r) => !r.classList.contains("tl-lane-hitarea"));
    expect(bgRect).toBeTruthy();
    fireEvent.click(bgRect!);
    expect(onSelectPerson).toHaveBeenCalledWith(null);
  });

  it("renders horizontal gridlines when showGridlines is true", () => {
    const p1 = makePerson("p1", { name: "Alice", birth_year: 1960 });
    const { container } = render(
      <TimelineAgeContent {...makeBaseProps()} persons={new Map([["p1", p1]])} showGridlines />,
    );
    const bgGroup = container.querySelector(".tl-bg");
    const gridLines = bgGroup?.querySelectorAll("line");
    expect(gridLines!.length).toBeGreaterThanOrEqual(1);
  });
});
