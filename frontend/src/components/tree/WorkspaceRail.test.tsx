import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceRail } from "./WorkspaceRail";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("WorkspaceRail", () => {
  const defaultProps = {
    onAddPerson: vi.fn(),
    isAddingPerson: false,
    onAutoLayout: vi.fn(),
    hasLayout: true,
    onUndo: vi.fn(),
    canUndo: true,
    patterns: new Map(),
    focusedPatternId: null,
    onFocusPattern: vi.fn(),
    onManagePatterns: vi.fn(),
    journalPanelOpen: false,
    onToggleJournal: vi.fn(),
  };

  it("renders all toolbar buttons", () => {
    render(<WorkspaceRail {...defaultProps} />);
    expect(screen.getByRole("button", { name: "tree.addPerson" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tree.autoLayout" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tree.undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pattern.focus.menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "journal.tab" })).toBeInTheDocument();
  });

  it("disables add person button when isAddingPerson is true", () => {
    render(<WorkspaceRail {...defaultProps} isAddingPerson={true} />);
    expect(screen.getByRole("button", { name: "tree.addPerson" })).toBeDisabled();
  });

  it("disables auto layout button when hasLayout is false", () => {
    render(<WorkspaceRail {...defaultProps} hasLayout={false} />);
    expect(screen.getByRole("button", { name: "tree.autoLayout" })).toBeDisabled();
  });

  it("disables undo button when canUndo is false", () => {
    render(<WorkspaceRail {...defaultProps} canUndo={false} />);
    expect(screen.getByRole("button", { name: "tree.undo" })).toBeDisabled();
  });

  it("applies active class to the pattern menu when a pattern is focused", () => {
    render(<WorkspaceRail {...defaultProps} focusedPatternId="p1" />);
    const btn = screen.getByRole("button", { name: "pattern.focus.menu" });
    expect(btn.className).toContain("workspace-rail__btn--active");
  });

  it("marks the journal button pressed when the panel is open", () => {
    render(<WorkspaceRail {...defaultProps} journalPanelOpen={true} />);
    const btn = screen.getByRole("button", { name: "journal.tab" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("is a labelled navigation landmark", () => {
    render(<WorkspaceRail {...defaultProps} />);
    expect(screen.getByRole("navigation", { name: "tree.tools" })).toBeInTheDocument();
  });

  it("leaves the journal button unpressed when the panel is closed", () => {
    render(<WorkspaceRail {...defaultProps} />);
    expect(screen.getByRole("button", { name: "journal.tab" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls each tool's handler", async () => {
    const user = userEvent.setup();
    const props = {
      ...defaultProps,
      onAddPerson: vi.fn(),
      onAutoLayout: vi.fn(),
      onUndo: vi.fn(),
      onToggleJournal: vi.fn(),
    };
    render(<WorkspaceRail {...props} />);
    await user.click(screen.getByRole("button", { name: "tree.addPerson" }));
    await user.click(screen.getByRole("button", { name: "tree.autoLayout" }));
    await user.click(screen.getByRole("button", { name: "tree.undo" }));
    await user.click(screen.getByRole("button", { name: "journal.tab" }));
    expect(props.onAddPerson).toHaveBeenCalledOnce();
    expect(props.onAutoLayout).toHaveBeenCalledOnce();
    expect(props.onUndo).toHaveBeenCalledOnce();
    expect(props.onToggleJournal).toHaveBeenCalledOnce();
  });

  it("opens the pattern menu beside the rail", () => {
    const { container } = render(<WorkspaceRail {...defaultProps} />);
    expect(container.querySelector(".pattern-focus-menu--side")).not.toBeNull();
  });
});
