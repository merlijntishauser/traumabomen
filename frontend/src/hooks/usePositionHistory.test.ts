import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type PositionSnapshot, usePositionHistory } from "./usePositionHistory";

describe("usePositionHistory", () => {
  it("starts with canUndo false", () => {
    const { result } = renderHook(() => usePositionHistory());
    expect(result.current.canUndo).toBe(false);
  });

  it("canUndo becomes true after push", () => {
    const { result } = renderHook(() => usePositionHistory());
    const snapshot: PositionSnapshot = new Map([["a", { x: 1, y: 2 }]]);
    act(() => result.current.push(snapshot));
    expect(result.current.canUndo).toBe(true);
  });

  it("pop returns the most recently pushed snapshot", () => {
    const { result } = renderHook(() => usePositionHistory());
    const s1: PositionSnapshot = new Map([["a", { x: 1, y: 2 }]]);
    const s2: PositionSnapshot = new Map([["b", { x: 3, y: 4 }]]);
    act(() => result.current.push(s1));
    act(() => result.current.push(s2));

    let popped: PositionSnapshot | undefined;
    act(() => {
      popped = result.current.pop();
    });
    expect(popped).toEqual(s2);
    expect(result.current.canUndo).toBe(true);
  });

  it("canUndo becomes false after popping the last entry", () => {
    const { result } = renderHook(() => usePositionHistory());
    const snapshot: PositionSnapshot = new Map([["a", { x: 1, y: 2 }]]);
    act(() => result.current.push(snapshot));

    act(() => result.current.pop());
    expect(result.current.canUndo).toBe(false);
  });

  it("pop returns undefined when stack is empty", () => {
    const { result } = renderHook(() => usePositionHistory());
    let popped: PositionSnapshot | undefined;
    act(() => {
      popped = result.current.pop();
    });
    expect(popped).toBeUndefined();
  });

  it("caps the stack at 20 entries", () => {
    const { result } = renderHook(() => usePositionHistory());
    for (let i = 0; i < 25; i++) {
      act(() => result.current.push(new Map([["a", { x: i, y: i }]])));
    }

    // Pop all 20 entries
    let count = 0;
    let popped: PositionSnapshot | undefined;
    do {
      act(() => {
        popped = result.current.pop();
      });
      if (popped) count++;
    } while (popped);

    expect(count).toBe(20);
  });

  it("handles undefined positions in snapshots", () => {
    const { result } = renderHook(() => usePositionHistory());
    const snapshot: PositionSnapshot = new Map([
      ["a", { x: 1, y: 2 }],
      ["b", undefined],
    ]);
    act(() => result.current.push(snapshot));

    let popped: PositionSnapshot | undefined;
    act(() => {
      popped = result.current.pop();
    });
    expect(popped?.get("a")).toEqual({ x: 1, y: 2 });
    expect(popped?.get("b")).toBeUndefined();
  });
});
