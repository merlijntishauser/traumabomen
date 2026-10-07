import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTextSize } from "./useTextSize";

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
vi.stubGlobal("localStorage", localStorageMock);

const STORAGE_KEY = "traumabomen-text-size";

describe("useTextSize", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-text-size");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-text-size");
  });

  it("defaults to normal without an attribute on <html>", () => {
    const { result } = renderHook(() => useTextSize());
    expect(result.current.textSize).toBe("normal");
    expect(document.documentElement.hasAttribute("data-text-size")).toBe(false);
  });

  it("reads the stored size and applies it to <html>", () => {
    localStorage.setItem(STORAGE_KEY, "large");
    const { result } = renderHook(() => useTextSize());
    expect(result.current.textSize).toBe("large");
    expect(document.documentElement.getAttribute("data-text-size")).toBe("large");
  });

  it("falls back to normal when storage throws", () => {
    const spy = vi.spyOn(localStorageMock, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { result } = renderHook(() => useTextSize());
    expect(result.current.textSize).toBe("normal");
    spy.mockRestore();
  });

  it("persists a new size and syncs other hook instances", () => {
    const first = renderHook(() => useTextSize());
    const second = renderHook(() => useTextSize());

    act(() => first.result.current.setTextSize("small"));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("small");
    expect(second.result.current.textSize).toBe("small");
    expect(document.documentElement.getAttribute("data-text-size")).toBe("small");
  });

  it("removes the attribute when going back to normal", () => {
    localStorage.setItem(STORAGE_KEY, "large");
    const { result } = renderHook(() => useTextSize());

    act(() => result.current.setTextSize("normal"));

    expect(document.documentElement.hasAttribute("data-text-size")).toBe(false);
  });

  it("keeps the current size when storage refuses the write", () => {
    const spy = vi.spyOn(localStorageMock, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { result } = renderHook(() => useTextSize());

    act(() => result.current.setTextSize("large"));

    expect(result.current.textSize).toBe("normal");
    spy.mockRestore();
  });
});
