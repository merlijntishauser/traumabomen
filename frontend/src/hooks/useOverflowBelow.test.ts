import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOverflowBelow } from "./useOverflowBelow";

function box(scrollHeight: number, clientHeight: number) {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => clientHeight });
  return el;
}

describe("useOverflowBelow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports content below the visible part until it is scrolled into view", () => {
    const el = box(1000, 600);
    const { result } = renderHook(() => useOverflowBelow<HTMLDivElement>());
    act(() => result.current[0](el));
    expect(result.current[1]).toBe(true);
    el.scrollTop = 400;
    act(() => result.current[2]());
    expect(result.current[1]).toBe(false);
  });

  it("re-measures when the content changes", async () => {
    let scrollHeight = 500;
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollHeight", { get: () => scrollHeight });
    Object.defineProperty(el, "clientHeight", { get: () => 600 });
    const { result } = renderHook(() => useOverflowBelow<HTMLDivElement>());
    act(() => result.current[0](el));
    expect(result.current[1]).toBe(false);
    scrollHeight = 900;
    await act(async () => {
      el.appendChild(document.createElement("p"));
      await Promise.resolve();
    });
    expect(result.current[1]).toBe(true);
  });

  it("measures once without observers, and ignores scroll before attaching", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("MutationObserver", undefined);
    const { result } = renderHook(() => useOverflowBelow<HTMLDivElement>());
    act(() => result.current[2]());
    expect(result.current[1]).toBe(false);
    act(() => result.current[0](box(800, 600)));
    expect(result.current[1]).toBe(true);
  });
});
