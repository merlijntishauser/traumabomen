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
  showReflectionPrompts: true,
  showParentEdges: true,
  showPartnerEdges: true,
  showSiblingEdges: true,
  showFriendEdges: true,
  autoLockMinutes: 15,
};

interface RenderOptions {
  overrides?: Partial<CanvasSettings>;
  onUpdate?: ReturnType<typeof vi.fn>;
  onExportEncrypted?: () => Promise<void>;
  onExportPlaintext?: () => Promise<void>;
}

function renderComponent(opts: RenderOptions = {}) {
  const { overrides = {}, onUpdate = vi.fn(), onExportEncrypted, onExportPlaintext } = opts;
  const settings = { ...DEFAULT_SETTINGS, ...overrides };
  render(
    <CanvasSettingsContent
      settings={settings}
      onUpdate={onUpdate}
      onExportEncrypted={onExportEncrypted}
      onExportPlaintext={onExportPlaintext}
    />,
  );
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
    const { onUpdate } = renderComponent({ overrides: { showParentEdges: true } });
    const checkbox = screen.getByRole("checkbox", { name: "canvas.showParentEdges" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showParentEdges: false });
  });

  it("calls onUpdate when showPartnerEdges is toggled", async () => {
    const { onUpdate } = renderComponent({ overrides: { showPartnerEdges: true } });
    const checkbox = screen.getByRole("checkbox", { name: "canvas.showPartnerEdges" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showPartnerEdges: false });
  });

  it("calls onUpdate when showSiblingEdges is toggled", async () => {
    const { onUpdate } = renderComponent({ overrides: { showSiblingEdges: true } });
    const checkbox = screen.getByRole("checkbox", { name: "canvas.showSiblingEdges" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showSiblingEdges: false });
  });

  it("calls onUpdate when showFriendEdges is toggled", async () => {
    const { onUpdate } = renderComponent({ overrides: { showFriendEdges: true } });
    const checkbox = screen.getByRole("checkbox", { name: "canvas.showFriendEdges" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showFriendEdges: false });
  });

  it("renders showReflectionPrompts toggle checked by default", () => {
    renderComponent();
    expect(screen.getByRole("checkbox", { name: "canvas.showReflectionPrompts" })).toBeChecked();
  });

  it("calls onUpdate when showReflectionPrompts is toggled", async () => {
    const { onUpdate } = renderComponent({ overrides: { showReflectionPrompts: true } });
    const checkbox = screen.getByRole("checkbox", {
      name: "canvas.showReflectionPrompts",
    });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showReflectionPrompts: false });
  });

  it("reflects unchecked state when visibility is off", () => {
    renderComponent({ overrides: { showParentEdges: false, showFriendEdges: false } });
    expect(screen.getByRole("checkbox", { name: "canvas.showParentEdges" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "canvas.showFriendEdges" })).not.toBeChecked();
  });

  it("does not render export section when no export callbacks provided", () => {
    renderComponent();
    expect(screen.queryByText("export.title")).toBeNull();
  });

  it("renders export section when onExportEncrypted is provided", () => {
    renderComponent({ onExportEncrypted: vi.fn() });
    expect(screen.getByText("export.title")).toBeTruthy();
    expect(screen.getByText("export.downloadBackup")).toBeTruthy();
  });

  it("renders export section when onExportPlaintext is provided", () => {
    renderComponent({ onExportPlaintext: vi.fn() });
    expect(screen.getByText("export.title")).toBeTruthy();
    expect(screen.getByText("export.downloadPlaintext")).toBeTruthy();
  });

  it("shows plaintext confirmation dialog on click", async () => {
    renderComponent({ onExportPlaintext: vi.fn() });
    await userEvent.click(screen.getByText("export.downloadPlaintext"));
    expect(screen.getByText("export.plaintextWarning")).toBeTruthy();
    expect(screen.getByText("export.confirmDownload")).toBeTruthy();
  });

  it("calls onExportEncrypted when encrypted button clicked", async () => {
    const onExportEncrypted = vi.fn().mockResolvedValue(undefined);
    renderComponent({ onExportEncrypted });
    await userEvent.click(screen.getByText("export.downloadBackup"));
    expect(onExportEncrypted).toHaveBeenCalled();
  });

  it("calls onExportPlaintext after confirmation", async () => {
    const onExportPlaintext = vi.fn().mockResolvedValue(undefined);
    renderComponent({ onExportPlaintext });
    await userEvent.click(screen.getByText("export.downloadPlaintext"));
    await userEvent.click(screen.getByText("export.confirmDownload"));
    expect(onExportPlaintext).toHaveBeenCalled();
  });
});
