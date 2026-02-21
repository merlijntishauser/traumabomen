import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TimelineSettings } from "../../hooks/useTimelineSettings";
import { TimelineSettingsContent } from "./TimelineSettingsContent";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("./ThemeLanguageSettings", () => ({
  ThemeLanguageSettings: () => <div data-testid="theme-language" />,
}));

const DEFAULT_SETTINGS: TimelineSettings = {
  showPartnerLines: true,
  showPartnerLabels: true,
  showClassifications: true,
  showGridlines: false,
  showMarkerLabels: true,
};

function renderComponent(overrides: Partial<TimelineSettings> = {}, onUpdate = vi.fn()) {
  const settings = { ...DEFAULT_SETTINGS, ...overrides };
  render(<TimelineSettingsContent settings={settings} onUpdate={onUpdate} />);
  return { onUpdate };
}

describe("TimelineSettingsContent", () => {
  it("renders all five toggle checkboxes with correct initial state", () => {
    renderComponent({
      showPartnerLines: true,
      showPartnerLabels: false,
      showClassifications: false,
      showGridlines: true,
      showMarkerLabels: false,
    });

    const partnerLines = screen.getByRole("checkbox", { name: "timeline.showPartnerLines" });
    const partnerLabels = screen.getByRole("checkbox", { name: "timeline.showPartnerLabels" });
    const classifications = screen.getByRole("checkbox", { name: "timeline.showClassifications" });
    const gridlines = screen.getByRole("checkbox", { name: "timeline.showGridlines" });
    const markerLabels = screen.getByRole("checkbox", { name: "timeline.showMarkerLabels" });

    expect(partnerLines).toBeChecked();
    expect(partnerLabels).not.toBeChecked();
    expect(classifications).not.toBeChecked();
    expect(gridlines).toBeChecked();
    expect(markerLabels).not.toBeChecked();
  });

  it("calls onUpdate when showPartnerLines is toggled", async () => {
    const { onUpdate } = renderComponent({ showPartnerLines: true });
    const checkbox = screen.getByRole("checkbox", { name: "timeline.showPartnerLines" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showPartnerLines: false });
  });

  it("calls onUpdate when showPartnerLabels is toggled", async () => {
    const { onUpdate } = renderComponent({ showPartnerLabels: true });
    const checkbox = screen.getByRole("checkbox", { name: "timeline.showPartnerLabels" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showPartnerLabels: false });
  });

  it("disables showPartnerLabels when showPartnerLines is off", () => {
    renderComponent({ showPartnerLines: false });
    const checkbox = screen.getByRole("checkbox", { name: "timeline.showPartnerLabels" });
    expect(checkbox).toBeDisabled();
  });

  it("enables showPartnerLabels when showPartnerLines is on", () => {
    renderComponent({ showPartnerLines: true });
    const checkbox = screen.getByRole("checkbox", { name: "timeline.showPartnerLabels" });
    expect(checkbox).toBeEnabled();
  });

  it("calls onUpdate when showClassifications is toggled", async () => {
    const { onUpdate } = renderComponent({ showClassifications: false });
    const checkbox = screen.getByRole("checkbox", { name: "timeline.showClassifications" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showClassifications: true });
  });

  it("calls onUpdate when showGridlines is toggled", async () => {
    const { onUpdate } = renderComponent({ showGridlines: false });
    const checkbox = screen.getByRole("checkbox", { name: "timeline.showGridlines" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showGridlines: true });
  });

  it("calls onUpdate when showMarkerLabels is toggled", async () => {
    const { onUpdate } = renderComponent({ showMarkerLabels: true });
    const checkbox = screen.getByRole("checkbox", { name: "timeline.showMarkerLabels" });
    await userEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({ showMarkerLabels: false });
  });

  it("renders ThemeLanguageSettings", () => {
    renderComponent();
    expect(screen.getByTestId("theme-language")).toBeTruthy();
  });
});
