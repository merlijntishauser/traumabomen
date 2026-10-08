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

  it("renders a labeled indigo dropdown trigger when a label is given", () => {
    render(
      <PatternFocusMenu
        patterns={patterns}
        focusedPatternId={null}
        onFocus={vi.fn()}
        label="Patterns"
      />,
    );
    const trigger = screen.getByRole("button", { name: "pattern.focus.menu" });
    expect(trigger).toHaveTextContent("Patterns");
    expect(trigger.className).toContain("btn--primary");
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

  it("uses the toolbar trigger and opens below by default", () => {
    const { container } = render(
      <PatternFocusMenu patterns={patterns} focusedPatternId="p1" onFocus={vi.fn()} />,
    );
    const trigger = screen.getByRole("button", { name: "pattern.focus.menu" });
    expect(trigger.className).toBe("tree-toolbar__icon-btn tree-toolbar__icon-btn--active");
    expect(container.querySelector(".pattern-focus-menu--side")).toBeNull();
  });

  it("takes a custom trigger class and opens to the side", () => {
    const { container } = render(
      <PatternFocusMenu
        patterns={patterns}
        focusedPatternId={null}
        onFocus={vi.fn()}
        triggerClassName="rail-btn"
        placement="side"
      />,
    );
    const trigger = screen.getByRole("button", { name: "pattern.focus.menu" });
    expect(trigger.className).toBe("rail-btn");
    const root = container.querySelector(".pattern-focus-menu--side");
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("data-open", "false");
    openMenu();
    expect(root).toHaveAttribute("data-open", "true");
  });

  it("offers a new pattern, also when there are none yet", () => {
    const onCreate = vi.fn();
    render(
      <PatternFocusMenu
        patterns={new Map()}
        focusedPatternId={null}
        onFocus={vi.fn()}
        onManage={vi.fn()}
        onCreate={onCreate}
      />,
    );
    openMenu();
    expect(screen.getByText("pattern.empty")).toBeInTheDocument();
    fireEvent.click(screen.getByText("pattern.newPattern"));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(screen.queryByText("pattern.newPattern")).not.toBeInTheDocument();
  });

  it("leaves out the new-pattern item where patterns cannot be managed", () => {
    render(<PatternFocusMenu patterns={patterns} focusedPatternId={null} onFocus={vi.fn()} />);
    openMenu();
    expect(screen.queryByText("pattern.newPattern")).not.toBeInTheDocument();
  });
});
