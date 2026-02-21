import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTimelineSettings } from "./useTimelineSettings";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

const STORAGE_KEY = "traumabomen-timeline-settings";

describe("useTimelineSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("loads defaults when no localStorage entry exists", () => {
    const { result } = renderHook(() => useTimelineSettings());
    expect(result.current.settings).toEqual({
      showPartnerLines: true,
      showPartnerLabels: true,
      showClassifications: true,
      showGridlines: false,
      showMarkerLabels: true,
    });
  });

  it("loads saved settings from localStorage", () => {
    const saved = {
      showPartnerLines: false,
      showPartnerLabels: false,
      showClassifications: false,
      showGridlines: true,
      showMarkerLabels: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useTimelineSettings());
    expect(result.current.settings).toEqual(saved);
  });

  it("merges partial saved settings with defaults", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showGridlines: true }));

    const { result } = renderHook(() => useTimelineSettings());
    expect(result.current.settings.showGridlines).toBe(true);
    expect(result.current.settings.showPartnerLines).toBe(true);
    expect(result.current.settings.showPartnerLabels).toBe(true);
    expect(result.current.settings.showClassifications).toBe(true);
    expect(result.current.settings.showMarkerLabels).toBe(true);
  });

  it("update merges partial changes and persists to localStorage", () => {
    const { result } = renderHook(() => useTimelineSettings());

    act(() => {
      result.current.update({ showGridlines: true });
    });

    expect(result.current.settings.showGridlines).toBe(true);
    expect(result.current.settings.showPartnerLines).toBe(true);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.showGridlines).toBe(true);
    expect(persisted.showPartnerLines).toBe(true);
  });

  it("handles corrupt localStorage gracefully by returning defaults", () => {
    localStorage.setItem(STORAGE_KEY, "not valid json{{{");

    const { result } = renderHook(() => useTimelineSettings());
    expect(result.current.settings).toEqual({
      showPartnerLines: true,
      showPartnerLabels: true,
      showClassifications: true,
      showGridlines: false,
      showMarkerLabels: true,
    });
  });

  it("applies multiple sequential updates correctly", () => {
    const { result } = renderHook(() => useTimelineSettings());

    act(() => {
      result.current.update({ showPartnerLines: false });
    });
    act(() => {
      result.current.update({ showGridlines: true });
    });

    expect(result.current.settings.showPartnerLines).toBe(false);
    expect(result.current.settings.showGridlines).toBe(true);
  });
});
