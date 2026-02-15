import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCanvasSettings } from "./useCanvasSettings";

// Provide a simple in-memory localStorage mock for the test environment
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

const STORAGE_KEY = "traumabomen-canvas-settings";

describe("useCanvasSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("loads defaults when no localStorage entry exists", () => {
    const { result } = renderHook(() => useCanvasSettings());
    expect(result.current.settings).toEqual({
      showGrid: false,
      snapToGrid: false,
      edgeStyle: "curved",
      showMarkers: true,
      showMinimap: false,
    });
  });

  it("loads saved settings from localStorage", () => {
    const saved = {
      showGrid: true,
      snapToGrid: true,
      edgeStyle: "straight",
      showMarkers: false,
      showMinimap: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useCanvasSettings());
    expect(result.current.settings).toEqual(saved);
  });

  it("merges partial saved settings with defaults", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showGrid: true }));

    const { result } = renderHook(() => useCanvasSettings());
    expect(result.current.settings.showGrid).toBe(true);
    expect(result.current.settings.edgeStyle).toBe("curved");
    expect(result.current.settings.showMarkers).toBe(true);
  });

  it("update merges partial changes and persists to localStorage", () => {
    const { result } = renderHook(() => useCanvasSettings());

    act(() => {
      result.current.update({ showGrid: true });
    });

    expect(result.current.settings.showGrid).toBe(true);
    expect(result.current.settings.edgeStyle).toBe("curved");

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.showGrid).toBe(true);
    expect(persisted.edgeStyle).toBe("curved");
  });

  it("handles corrupt localStorage gracefully by returning defaults", () => {
    localStorage.setItem(STORAGE_KEY, "not valid json{{{");

    const { result } = renderHook(() => useCanvasSettings());
    expect(result.current.settings).toEqual({
      showGrid: false,
      snapToGrid: false,
      edgeStyle: "curved",
      showMarkers: true,
      showMinimap: false,
    });
  });

  it("applies multiple sequential updates correctly", () => {
    const { result } = renderHook(() => useCanvasSettings());

    act(() => {
      result.current.update({ showGrid: true });
    });
    act(() => {
      result.current.update({ edgeStyle: "elbows" });
    });

    expect(result.current.settings.showGrid).toBe(true);
    expect(result.current.settings.edgeStyle).toBe("elbows");
  });
});
