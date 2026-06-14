import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import { PatternFocusMenu } from "./PatternFocusMenu";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function makePattern(id: string, name: string): DecryptedPattern {
  return { id, name, description: "", color: "#1f77b4", person_ids: [], linked_entities: [] };
}

const patterns = new Map<string, DecryptedPattern>([
  ["p1", makePattern("p1", "Addiction")],
  ["p2", makePattern("p2", "Loss")],
]);

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "pattern.focus.menu" }));
}

describe("PatternFocusMenu", () => {
  it("lists patterns, show-all, and manage when opened", () => {
    render(
      <PatternFocusMenu
        patterns={patterns}
        focusedPatternId={null}
        onFocus={vi.fn()}
        onManage={vi.fn()}
      />,
    );
    openMenu();
    expect(screen.getByText("pattern.focus.showAll")).toBeInTheDocument();
    expect(screen.getByText("Addiction")).toBeInTheDocument();
    expect(screen.getByText("Loss")).toBeInTheDocument();
    expect(screen.getByText("pattern.focus.manage")).toBeInTheDocument();
  });

  it("focuses a pattern when one is selected", () => {
    const onFocus = vi.fn();
    render(
      <PatternFocusMenu
        patterns={patterns}
        focusedPatternId={null}
        onFocus={onFocus}
        onManage={vi.fn()}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByText("Addiction"));
    expect(onFocus).toHaveBeenCalledWith("p1");
  });

  it("clears focus when the already-focused pattern is reselected", () => {
    const onFocus = vi.fn();
    render(
      <PatternFocusMenu
        patterns={patterns}
        focusedPatternId="p1"
        onFocus={onFocus}
        onManage={vi.fn()}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByText("Addiction"));
    expect(onFocus).toHaveBeenCalledWith(null);
  });

  it("calls onManage from the manage entry", () => {
    const onManage = vi.fn();
    render(
      <PatternFocusMenu
        patterns={patterns}
        focusedPatternId={null}
        onFocus={vi.fn()}
        onManage={onManage}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByText("pattern.focus.manage"));
    expect(onManage).toHaveBeenCalled();
  });

  it("hides the manage entry when onManage is omitted (read-only)", () => {
    render(<PatternFocusMenu patterns={patterns} focusedPatternId={null} onFocus={vi.fn()} />);
    openMenu();
    expect(screen.getByText("pattern.focus.showAll")).toBeInTheDocument();
    expect(screen.queryByText("pattern.focus.manage")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no patterns", () => {
    render(
      <PatternFocusMenu
        patterns={new Map()}
        focusedPatternId={null}
        onFocus={vi.fn()}
        onManage={vi.fn()}
      />,
    );
    openMenu();
    expect(screen.getByText("pattern.empty")).toBeInTheDocument();
  });
});
