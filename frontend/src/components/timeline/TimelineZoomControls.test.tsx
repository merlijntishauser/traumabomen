import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimelineZoomActions } from "../../hooks/useTimelineZoom";
import { TimelineZoomControls } from "./TimelineZoomControls";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

describe("TimelineZoomControls", () => {
  function makeActions(): TimelineZoomActions {
    return { zoomIn: vi.fn(), zoomOut: vi.fn(), resetZoom: vi.fn() };
  }

  it("renders three buttons", () => {
    const actions = makeActions();
    render(<TimelineZoomControls actions={actions} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
  });

  it("calls zoomIn when zoom in button is clicked", () => {
    const actions = makeActions();
    render(<TimelineZoomControls actions={actions} />);
    fireEvent.click(screen.getByLabelText("timeline.zoomIn"));
    expect(actions.zoomIn).toHaveBeenCalledTimes(1);
  });

  it("calls zoomOut when zoom out button is clicked", () => {
    const actions = makeActions();
    render(<TimelineZoomControls actions={actions} />);
    fireEvent.click(screen.getByLabelText("timeline.zoomOut"));
    expect(actions.zoomOut).toHaveBeenCalledTimes(1);
  });

  it("calls resetZoom when fit to view button is clicked", () => {
    const actions = makeActions();
    render(<TimelineZoomControls actions={actions} />);
    fireEvent.click(screen.getByLabelText("timeline.fitToView"));
    expect(actions.resetZoom).toHaveBeenCalledTimes(1);
  });
});
