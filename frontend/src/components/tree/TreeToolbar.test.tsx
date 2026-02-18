import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TreeToolbar } from "./TreeToolbar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

const mockLogout = vi.fn();
vi.mock("../../hooks/useLogout", () => ({
  useLogout: () => mockLogout,
}));

vi.mock("./SettingsPanel", () => ({
  SettingsPanel: (props: { className?: string }) => (
    <button type="button" data-testid="settings-panel" className={props.className} />
  ),
}));

vi.mock("./ViewTabs", () => ({
  ViewTabs: (props: { activeView: string }) => (
    <nav data-testid="view-tabs" data-active={props.activeView} />
  ),
}));

const TREE_ID = "03f28958-029f-4663-82e3-4de766986d28";
const defaultSettings = {
  showGrid: false,
  snapToGrid: false,
  edgeStyle: "curved" as const,
  showMarkers: true,
  showMinimap: false,
};

function renderToolbar(overrides: Partial<Parameters<typeof TreeToolbar>[0]> = {}) {
  const onUpdateSettings = vi.fn();
  return {
    onUpdateSettings,
    ...render(
      <MemoryRouter>
        <TreeToolbar
          treeId={TREE_ID}
          treeName="My Tree"
          activeView="canvas"
          canvasSettings={defaultSettings}
          onUpdateSettings={onUpdateSettings}
          {...overrides}
        />
      </MemoryRouter>,
    ),
  };
}

describe("TreeToolbar", () => {
  it("renders the tree name", () => {
    renderToolbar();
    expect(screen.getByText("My Tree")).toBeTruthy();
  });

  it("renders untitled fallback when treeName is null", () => {
    renderToolbar({ treeName: null });
    expect(screen.getByText("tree.untitled")).toBeTruthy();
  });

  it("renders the ViewTabs component", () => {
    renderToolbar();
    expect(screen.getByTestId("view-tabs")).toBeTruthy();
  });

  it("renders home link", () => {
    renderToolbar();
    const homeLink = screen.getByLabelText("nav.trees");
    expect(homeLink.getAttribute("href")).toBe("/trees");
  });

  it("renders the settings panel", () => {
    renderToolbar();
    expect(screen.getByTestId("settings-panel")).toBeTruthy();
  });

  it("renders the logout button and calls logout on click", () => {
    renderToolbar();
    const logoutBtn = screen.getByLabelText("nav.logout");
    fireEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it("renders children when provided", () => {
    renderToolbar({ children: <button type="button">Custom</button> });
    expect(screen.getByText("Custom")).toBeTruthy();
  });

  it("does not render separator for children when none provided", () => {
    const { container } = renderToolbar();
    // There should be exactly one separator (before the right group)
    // not two (which would exist if children section rendered)
    const separators = container.querySelectorAll(".tree-toolbar__separator");
    expect(separators.length).toBe(1);
  });

  it("renders two separators when children are provided", () => {
    const { container } = renderToolbar({
      children: <button type="button">Extra</button>,
    });
    const separators = container.querySelectorAll(".tree-toolbar__separator");
    expect(separators.length).toBe(2);
  });
});
