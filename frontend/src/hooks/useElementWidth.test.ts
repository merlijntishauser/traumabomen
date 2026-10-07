import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useElementWidth } from "./useElementWidth";

describe("useElementWidth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("measures the element it is attached to and follows resizes", () => {
    let notify: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          notify = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const el = document.createElement("div");
    let width = 320;
    Object.defineProperty(el, "clientWidth", { get: () => width });

    const { result, unmount } = renderHook(() => useElementWidth<HTMLDivElement>());
    expect(result.current[2]).toBe(0);
    act(() => result.current[0](el));
    expect(result.current[1]).toBe(el);
    expect(result.current[2]).toBe(320);

    width = 500;
    act(() => notify());
    expect(result.current[2]).toBe(500);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("measures once when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 200 });
    const { result } = renderHook(() => useElementWidth<HTMLDivElement>());
    act(() => result.current[0](el));
    expect(result.current[2]).toBe(200);
  });
});
