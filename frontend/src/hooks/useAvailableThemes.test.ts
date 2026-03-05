import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAvailableThemes } from "./useAvailableThemes";

const mockUseFeatureFlags = vi.fn();
vi.mock("./useFeatureFlags", () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}));

describe("useAvailableThemes", () => {
  it("returns only dark and light when feature flags are not loaded", () => {
    mockUseFeatureFlags.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useAvailableThemes());
    expect(result.current).toEqual(["dark", "light"]);
  });

  it("returns only dark and light when watercolor_theme flag is false", () => {
    mockUseFeatureFlags.mockReturnValue({ data: { watercolor_theme: false } });

    const { result } = renderHook(() => useAvailableThemes());
    expect(result.current).toEqual(["dark", "light"]);
  });

  it("includes watercolor when watercolor_theme flag is true", () => {
    mockUseFeatureFlags.mockReturnValue({ data: { watercolor_theme: true } });

    const { result } = renderHook(() => useAvailableThemes());
    expect(result.current).toEqual(["dark", "light", "watercolor"]);
  });

  it("returns only dark and light when flags object has no watercolor_theme key", () => {
    mockUseFeatureFlags.mockReturnValue({ data: {} });

    const { result } = renderHook(() => useAvailableThemes());
    expect(result.current).toEqual(["dark", "light"]);
  });
});
