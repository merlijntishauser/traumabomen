import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CanvasSettings } from "../../hooks/useCanvasSettings";
import { CanvasSettingsContent } from "./CanvasSettingsContent";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("./ThemeLanguageSettings", () => ({
  ThemeLanguageSettings: () => <div data-testid="theme-language" />,
}));

const DEFAULT_SETTINGS: CanvasSettings = {
  showGrid: false,
  snapToGrid: false,
  edgeStyle: "curved",
  showMarkers: true,
  showMinimap: false,
  promptRelationship: true,
  showParentEdges: true,
  showPartnerEdges: true,
  showSiblingEdges: true,
  showFriendEdges: true,
};

function renderComponent(overrides: Partial<CanvasSettings> = {}, onUpdate = vi.fn()) {
  const settings = { ...DEFAULT_SETTINGS, ...overrides };
  render(<CanvasSettingsContent settings={settings} onUpdate={onUpdate} />);
  return { onUpdate };
}

describe("CanvasSettingsContent", () => {
  it("renders the relationship visibility group label", () => {
    renderComponent();
    expect(screen.getByText("canvas.relationshipVisibility")).toBeTruthy();
  });

  it("renders all four relationship visibility toggles", () => {
    renderComponent();
    expect(screen.getByRole("checkbox", { name: "canvas.showParentEdges" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "canvas.showPartnerEdges" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "canvas.showSiblingEdges" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "canvas.showFriendEdges" })).toBeChecked();
  });

  it("calls onUpdate when showParentEdges is toggled", async () => {
    const { onUpdate } = renderComponent({ showParentEdges: true });
    const checkbox = screen.getByRole("checkbox", { name: "canvas.showParentEdges" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showParentEdges: false });
  });

  it("calls onUpdate when showPartnerEdges is toggled", async () => {
    const { onUpdate } = renderComponent({ showPartnerEdges: true });
    const checkbox = screen.getByRole("checkbox", { name: "canvas.showPartnerEdges" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showPartnerEdges: false });
  });

  it("calls onUpdate when showSiblingEdges is toggled", async () => {
    const { onUpdate } = renderComponent({ showSiblingEdges: true });
    const checkbox = screen.getByRole("checkbox", { name: "canvas.showSiblingEdges" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showSiblingEdges: false });
  });

  it("calls onUpdate when showFriendEdges is toggled", async () => {
    const { onUpdate } = renderComponent({ showFriendEdges: true });
    const checkbox = screen.getByRole("checkbox", { name: "canvas.showFriendEdges" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showFriendEdges: false });
  });

  it("reflects unchecked state when visibility is off", () => {
    renderComponent({ showParentEdges: false, showFriendEdges: false });
    expect(screen.getByRole("checkbox", { name: "canvas.showParentEdges" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "canvas.showFriendEdges" })).not.toBeChecked();
  });
});
