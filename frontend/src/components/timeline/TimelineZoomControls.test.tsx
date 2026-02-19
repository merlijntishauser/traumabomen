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

  it("renders scroll mode toggle when onToggleScrollMode is provided", () => {
    const actions = makeActions();
    const toggle = vi.fn();
    render(
      <TimelineZoomControls actions={actions} scrollMode={false} onToggleScrollMode={toggle} />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
  });

  it("does not render scroll mode toggle when onToggleScrollMode is omitted", () => {
    const actions = makeActions();
    render(<TimelineZoomControls actions={actions} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
  });

  it("calls onToggleScrollMode when toggle button is clicked", () => {
    const actions = makeActions();
    const toggle = vi.fn();
    render(
      <TimelineZoomControls actions={actions} scrollMode={false} onToggleScrollMode={toggle} />,
    );
    fireEvent.click(screen.getByLabelText("timeline.zoomMode"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("shows scroll mode label when scrollMode is true", () => {
    const actions = makeActions();
    const toggle = vi.fn();
    render(
      <TimelineZoomControls actions={actions} scrollMode={true} onToggleScrollMode={toggle} />,
    );
    expect(screen.getByLabelText("timeline.scrollMode")).toBeTruthy();
  });

  it("applies active class when scrollMode is true", () => {
    const actions = makeActions();
    const toggle = vi.fn();
    render(
      <TimelineZoomControls actions={actions} scrollMode={true} onToggleScrollMode={toggle} />,
    );
    const btn = screen.getByLabelText("timeline.scrollMode");
    expect(btn.className).toContain("tl-zoom-controls__btn--active");
  });

  it("does not apply active class when scrollMode is false", () => {
    const actions = makeActions();
    const toggle = vi.fn();
    render(
      <TimelineZoomControls actions={actions} scrollMode={false} onToggleScrollMode={toggle} />,
    );
    const btn = screen.getByLabelText("timeline.zoomMode");
    expect(btn.className).not.toContain("tl-zoom-controls__btn--active");
  });
});
