import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasToolbarButtons } from "./CanvasToolbarButtons";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("CanvasToolbarButtons", () => {
  const defaultProps = {
    onAddPerson: vi.fn(),
    isAddingPerson: false,
    onAutoLayout: vi.fn(),
    hasLayout: true,
    onUndo: vi.fn(),
    canUndo: true,
    patternPanelOpen: false,
    onTogglePatterns: vi.fn(),
    journalPanelOpen: false,
    onToggleJournal: vi.fn(),
  };

  it("renders all toolbar buttons", () => {
    render(<CanvasToolbarButtons {...defaultProps} />);
    expect(screen.getByRole("button", { name: "tree.addPerson" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tree.autoLayout" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tree.undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pattern.editPatterns" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "journal.tab" })).toBeInTheDocument();
  });

  it("disables add person button when isAddingPerson is true", () => {
    render(<CanvasToolbarButtons {...defaultProps} isAddingPerson={true} />);
    expect(screen.getByRole("button", { name: "tree.addPerson" })).toBeDisabled();
  });

  it("disables auto layout button when hasLayout is false", () => {
    render(<CanvasToolbarButtons {...defaultProps} hasLayout={false} />);
    expect(screen.getByRole("button", { name: "tree.autoLayout" })).toBeDisabled();
  });

  it("disables undo button when canUndo is false", () => {
    render(<CanvasToolbarButtons {...defaultProps} canUndo={false} />);
    expect(screen.getByRole("button", { name: "tree.undo" })).toBeDisabled();
  });

  it("applies active class to patterns button when panel is open", () => {
    render(<CanvasToolbarButtons {...defaultProps} patternPanelOpen={true} />);
    const btn = screen.getByRole("button", { name: "pattern.editPatterns" });
    expect(btn.className).toContain("tree-toolbar__icon-btn--active");
  });

  it("applies active class to journal button when panel is open", () => {
    render(<CanvasToolbarButtons {...defaultProps} journalPanelOpen={true} />);
    const btn = screen.getByRole("button", { name: "journal.tab" });
    expect(btn.className).toContain("tree-toolbar__icon-btn--active");
  });
});
