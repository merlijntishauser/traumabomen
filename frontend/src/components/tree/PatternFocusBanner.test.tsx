import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import type { EntityMaps } from "../../lib/patternEntities";
import { PatternFocusBanner } from "./PatternFocusBanner";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const pattern: DecryptedPattern = {
  id: "p1",
  name: "Cross-generational addiction",
  description: "Recurs across three generations",
  color: "#1f77b4",
  person_ids: ["a", "b", "c"],
  linked_entities: [],
};

const entityMaps: EntityMaps = {
  events: new Map(),
  lifeEvents: new Map(),
  turningPoints: new Map(),
  classifications: new Map(),
  persons: new Map(),
};

describe("PatternFocusBanner", () => {
  it("shows the pattern name and exits via the close control", () => {
    const onExit = vi.fn();
    render(
      <PatternFocusBanner
        pattern={pattern}
        color="#4f46e5"
        entityMaps={entityMaps}
        onExit={onExit}
      />,
    );
    expect(screen.getAllByText("Cross-generational addiction").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "pattern.focus.exit" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("opens the info modal on the info button", () => {
    const { container } = render(
      <PatternFocusBanner
        pattern={pattern}
        color="#4f46e5"
        entityMaps={entityMaps}
        onExit={vi.fn()}
      />,
    );
    const dialog = container.querySelector("dialog");
    expect(dialog).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "pattern.focus.info" }));
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByText("Recurs across three generations")).toBeInTheDocument();
    expect(screen.getByText("pattern.focus.people")).toBeInTheDocument();
  });
});
