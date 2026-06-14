import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedEvent, DecryptedPattern, DecryptedPerson } from "../../hooks/useTreeData";
import type { EntityMaps } from "../../lib/patternEntities";
import { PatternFocusPanel } from "./PatternFocusPanel";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const pattern: DecryptedPattern = {
  id: "p1",
  name: "Cross-generational addiction",
  description: "Recurs across three generations",
  color: "#1f77b4",
  person_ids: ["a", "b"],
  linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
};

const entityMaps: EntityMaps = {
  events: new Map([
    ["e1", { id: "e1", person_ids: ["a"], title: "Bombing" } as unknown as DecryptedEvent],
  ]),
  lifeEvents: new Map(),
  turningPoints: new Map(),
  classifications: new Map(),
  persons: new Map([["a", { id: "a", name: "Dorothy" } as unknown as DecryptedPerson]]),
};

describe("PatternFocusPanel", () => {
  it("shows the name, description, meta, and the linked entity with its person", () => {
    render(
      <PatternFocusPanel
        pattern={pattern}
        color="#4f46e5"
        entityMaps={entityMaps}
        onEdit={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    expect(screen.getByText("Cross-generational addiction")).toBeInTheDocument();
    expect(screen.getByText("Recurs across three generations")).toBeInTheDocument();
    expect(screen.getByText("pattern.focus.people")).toBeInTheDocument();
    expect(screen.getByText("pattern.spansGenerations")).toBeInTheDocument();
    expect(screen.getByText("Bombing")).toBeInTheDocument();
    expect(screen.getByText("Dorothy")).toBeInTheDocument();
  });

  it("opens the edit panel via the edit control", () => {
    const onEdit = vi.fn();
    render(
      <PatternFocusPanel
        pattern={pattern}
        color="#4f46e5"
        entityMaps={entityMaps}
        onEdit={onEdit}
        onExit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "pattern.focus.edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("hides the edit control when onEdit is omitted (read-only)", () => {
    render(
      <PatternFocusPanel
        pattern={pattern}
        color="#4f46e5"
        entityMaps={entityMaps}
        onExit={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "pattern.focus.edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pattern.focus.exit" })).toBeInTheDocument();
  });

  it("exits via the close control", () => {
    const onExit = vi.fn();
    render(
      <PatternFocusPanel
        pattern={pattern}
        color="#4f46e5"
        entityMaps={entityMaps}
        onEdit={vi.fn()}
        onExit={onExit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "pattern.focus.exit" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
