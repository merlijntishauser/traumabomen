import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Theme } from "./useAvailableThemes";
import { useTheme } from "./useTheme";

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

const STORAGE_KEY = "traumabomen-theme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to dark when no stored theme exists", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });

  it("reads stored theme from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });

  it("ignores invalid stored theme and defaults to dark", () => {
    localStorage.setItem(STORAGE_KEY, "neon");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });

  it("toggle switches dark to light", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe("light");
  });

  it("toggle switches light to dark", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe("dark");
  });

  it("sets data-theme attribute on document.documentElement", () => {
    const { result } = renderHook(() => useTheme());

    // After initial render with dark theme
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    act(() => {
      result.current.toggle();
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("persists theme to localStorage on change", () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggle();
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("reads stored watercolor theme when in available list", () => {
    localStorage.setItem(STORAGE_KEY, "watercolor");
    const themes: Theme[] = ["dark", "light", "watercolor"];
    const { result } = renderHook(() => useTheme(themes));
    expect(result.current.theme).toBe("watercolor");
  });

  it("ignores stored watercolor when not in available list and defaults to dark", () => {
    localStorage.setItem(STORAGE_KEY, "watercolor");
    const themes: Theme[] = ["dark", "light"];
    const { result } = renderHook(() => useTheme(themes));
    expect(result.current.theme).toBe("dark");
  });

  it("toggle cycles through 3 themes: dark -> light -> watercolor -> dark", () => {
    const themes: Theme[] = ["dark", "light", "watercolor"];
    const { result } = renderHook(() => useTheme(themes));
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe("watercolor");

    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe("dark");
  });

  it("setTheme sets a specific theme directly", () => {
    const themes: Theme[] = ["dark", "light", "watercolor"];
    const { result } = renderHook(() => useTheme(themes));
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.setTheme("watercolor");
    });
    expect(result.current.theme).toBe("watercolor");
    expect(document.documentElement.getAttribute("data-theme")).toBe("watercolor");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("watercolor");
  });

  it("falls back to dark when current theme removed from available list", () => {
    localStorage.setItem(STORAGE_KEY, "watercolor");
    const allThemes: Theme[] = ["dark", "light", "watercolor"];
    const twoThemes: Theme[] = ["dark", "light"];

    const { result, rerender } = renderHook(({ themes }) => useTheme(themes), {
      initialProps: { themes: allThemes },
    });
    expect(result.current.theme).toBe("watercolor");

    rerender({ themes: twoThemes });
    expect(result.current.theme).toBe("dark");
  });

  it("setTheme ignores themes not in available list", () => {
    const themes: Theme[] = ["dark", "light"];
    const { result } = renderHook(() => useTheme(themes));
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.setTheme("watercolor");
    });
    expect(result.current.theme).toBe("dark");
  });

  it("returns availableThemes in the result", () => {
    const themes: Theme[] = ["dark", "light", "watercolor"];
    const { result } = renderHook(() => useTheme(themes));
    expect(result.current.availableThemes).toEqual(themes);
  });
});
