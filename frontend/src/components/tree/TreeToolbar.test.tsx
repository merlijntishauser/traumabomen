import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
  ViewTabs: (props: { activeView: string; readOnly?: boolean }) => (
    <nav
      data-testid="view-tabs"
      data-active={props.activeView}
      data-read-only={String(Boolean(props.readOnly))}
    />
  ),
}));

let mockAccess = { readOnly: false, ownerLabel: null as string | null };
vi.mock("../../hooks/useTreeAccess", () => ({ useTreeAccess: () => mockAccess }));

const TREE_ID = "03f28958-029f-4663-82e3-4de766986d28";
const defaultViewTab = {
  label: "Canvas",
  content: <div data-testid="view-tab-content">Canvas settings</div>,
};

function renderToolbar(overrides: Partial<Parameters<typeof TreeToolbar>[0]> = {}) {
  return render(
    <MemoryRouter>
      <TreeToolbar
        treeId={TREE_ID}
        treeName="My Tree"
        activeView="canvas"
        viewTab={defaultViewTab}
        {...overrides}
      />
    </MemoryRouter>,
  );
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

  it("renders no separator without children", () => {
    const { container } = renderToolbar();
    expect(container.querySelectorAll(".tree-toolbar__separator")).toHaveLength(0);
  });

  it("separates children from the rest of the header", () => {
    const { container } = renderToolbar({
      children: <button type="button">Extra</button>,
    });
    expect(container.querySelectorAll(".tree-toolbar__separator")).toHaveLength(1);
  });

  it("says a shared tree is view only, and who shared it", () => {
    mockAccess = { readOnly: true, ownerLabel: "Anna" };
    try {
      renderToolbar();
      expect(screen.getByText("share.viewOnly")).toBeInTheDocument();
      expect(screen.getByTestId("view-tabs").dataset.readOnly).toBe("true");
    } finally {
      mockAccess = { readOnly: false, ownerLabel: null };
    }
  });

  it("shows no view-only note for an own tree", () => {
    renderToolbar();
    expect(screen.queryByText("share.viewOnly")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-tabs").dataset.readOnly).toBe("false");
  });

  it("notes that the tree is encrypted on this device", () => {
    renderToolbar();
    expect(screen.getByText("tree.encryptedHere")).toBeInTheDocument();
  });
});
