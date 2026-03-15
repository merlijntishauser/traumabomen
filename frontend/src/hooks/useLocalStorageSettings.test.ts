import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalStorageSettings } from "./useLocalStorageSettings";

let store: Record<string, string> = {};
const localStorageMock = {
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
vi.stubGlobal("localStorage", localStorageMock);

const KEY = "test-settings";
const DEFAULTS = { enabled: false, count: 5, label: "default" };

describe("useLocalStorageSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns defaults when no localStorage entry exists", () => {
    const { result } = renderHook(() => useLocalStorageSettings(KEY, DEFAULTS));
    expect(result.current.settings).toEqual(DEFAULTS);
  });

  it("loads saved settings from localStorage", () => {
    const saved = { enabled: true, count: 10, label: "saved" };
    localStorage.setItem(KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useLocalStorageSettings(KEY, DEFAULTS));
    expect(result.current.settings).toEqual(saved);
  });

  it("merges partial saved settings with defaults", () => {
    localStorage.setItem(KEY, JSON.stringify({ enabled: true }));

    const { result } = renderHook(() => useLocalStorageSettings(KEY, DEFAULTS));
    expect(result.current.settings).toEqual({ enabled: true, count: 5, label: "default" });
  });

  it("update merges partial changes and persists to localStorage", () => {
    const { result } = renderHook(() => useLocalStorageSettings(KEY, DEFAULTS));

    act(() => {
      result.current.update({ enabled: true });
    });

    expect(result.current.settings.enabled).toBe(true);
    expect(result.current.settings.count).toBe(5);

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect(persisted.enabled).toBe(true);
    expect(persisted.count).toBe(5);
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem(KEY, "not valid json{{{");

    const { result } = renderHook(() => useLocalStorageSettings(KEY, DEFAULTS));
    expect(result.current.settings).toEqual(DEFAULTS);
  });

  it("applies multiple sequential updates correctly", () => {
    const { result } = renderHook(() => useLocalStorageSettings(KEY, DEFAULTS));

    act(() => {
      result.current.update({ enabled: true });
    });
    act(() => {
      result.current.update({ count: 42 });
    });

    expect(result.current.settings.enabled).toBe(true);
    expect(result.current.settings.count).toBe(42);
    expect(result.current.settings.label).toBe("default");
  });
});
