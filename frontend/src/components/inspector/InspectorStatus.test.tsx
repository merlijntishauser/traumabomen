import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorSaveWhisper, useInspectorStatus } from "./InspectorStatus";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("useInspectorStatus", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useInspectorStatus());
    expect(result.current.status).toBe("idle");
  });

  it("saved fades back to idle after a moment", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useInspectorStatus());
    act(() => result.current.report("saved"));
    expect(result.current.status).toBe("saved");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.status).toBe("idle");
  });

  it("error persists until the next save", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useInspectorStatus());
    act(() => result.current.report("error"));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.status).toBe("error");
    act(() => result.current.report("saved"));
    expect(result.current.status).toBe("saved");
  });
});

describe("InspectorSaveWhisper", () => {
  it("renders the saved text invisibly when idle", () => {
    render(<InspectorSaveWhisper status="idle" />);
    const whisper = screen.getByText("inspector.saved").closest(".inspector-whisper");
    expect(whisper).not.toHaveClass("inspector-whisper--visible");
  });

  it("shows saved with aria-live when saved", () => {
    render(<InspectorSaveWhisper status="saved" />);
    const whisper = screen.getByText("inspector.saved").closest(".inspector-whisper");
    expect(whisper).toHaveClass("inspector-whisper--visible");
    expect(whisper).toHaveAttribute("aria-live", "polite");
  });

  it("shows a persistent error message on error", () => {
    render(<InspectorSaveWhisper status="error" />);
    const whisper = screen.getByText("inspector.saveFailed").closest(".inspector-whisper");
    expect(whisper).toHaveClass("inspector-whisper--visible");
    expect(whisper).toHaveClass("inspector-whisper--error");
  });
});
