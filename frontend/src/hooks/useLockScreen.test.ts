import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLockScreen } from "./useLockScreen";

describe("useLockScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initial lockLevel is 'none'", () => {
    const onFullLock = vi.fn();
    const { result } = renderHook(() => useLockScreen({ enabled: true, onFullLock }));
    expect(result.current.lockLevel).toBe("none");
  });

  it("lock() sets lockLevel to 'blur'", () => {
    const onFullLock = vi.fn();
    const { result } = renderHook(() => useLockScreen({ enabled: true, onFullLock }));

    act(() => {
      result.current.lock();
    });

    expect(result.current.lockLevel).toBe("blur");
  });

  it("unlock() sets lockLevel back to 'none' and resets wrongAttempts", () => {
    const onFullLock = vi.fn();
    const { result } = renderHook(() => useLockScreen({ enabled: true, onFullLock }));

    // Lock first, add a failed attempt, then unlock
    act(() => {
      result.current.lock();
    });
    act(() => {
      result.current.failedAttempt();
    });
    expect(result.current.wrongAttempts).toBe(1);

    act(() => {
      result.current.unlock();
    });

    expect(result.current.lockLevel).toBe("none");
    expect(result.current.wrongAttempts).toBe(0);
  });

  it("failedAttempt increments wrongAttempts", () => {
    const onFullLock = vi.fn();
    const { result } = renderHook(() => useLockScreen({ enabled: true, onFullLock }));

    act(() => {
      result.current.failedAttempt();
    });
    expect(result.current.wrongAttempts).toBe(1);

    act(() => {
      result.current.failedAttempt();
    });
    expect(result.current.wrongAttempts).toBe(2);

    act(() => {
      result.current.failedAttempt();
    });
    expect(result.current.wrongAttempts).toBe(3);
  });

  it("5 failed attempts triggers full lock", () => {
    const onFullLock = vi.fn();
    const { result } = renderHook(() => useLockScreen({ enabled: true, onFullLock }));

    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.failedAttempt();
      });
    }

    expect(onFullLock).toHaveBeenCalledTimes(1);
    expect(result.current.lockLevel).toBe("full");
  });

  // -------------------------------------------------------------------------
  // Double-Esc detection
  // -------------------------------------------------------------------------

  it("double-Esc triggers blur lock", () => {
    const onFullLock = vi.fn();
    const { result } = renderHook(() => useLockScreen({ enabled: true, onFullLock }));

    // First Esc
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(result.current.lockLevel).toBe("none");

    // Second Esc within 500ms window
    act(() => {
      vi.advanceTimersByTime(200);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(result.current.lockLevel).toBe("blur");
  });

  it("single Esc does not trigger lock", () => {
    const onFullLock = vi.fn();
    const { result } = renderHook(() => useLockScreen({ enabled: true, onFullLock }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(result.current.lockLevel).toBe("none");

    // Wait past the double-Esc window
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.lockLevel).toBe("none");
  });

  it("non-Escape keys do not trigger lock", () => {
    const onFullLock = vi.fn();
    const { result } = renderHook(() => useLockScreen({ enabled: true, onFullLock }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(result.current.lockLevel).toBe("none");
  });

  it("resets lock level when disabled (e.g. logout)", () => {
    const onFullLock = vi.fn();
    let enabled = true;
    const { result, rerender } = renderHook(() => useLockScreen({ enabled, onFullLock }));

    // Lock the screen
    act(() => {
      result.current.lock();
    });
    expect(result.current.lockLevel).toBe("blur");

    // Disable (simulates logout clearing the key)
    enabled = false;
    rerender();
    expect(result.current.lockLevel).toBe("none");
  });

  it("does not register Esc when disabled", () => {
    const onFullLock = vi.fn();
    const { result } = renderHook(() => useLockScreen({ enabled: false, onFullLock }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(result.current.lockLevel).toBe("none");
  });

  // -------------------------------------------------------------------------
  // Inactivity timers
  // -------------------------------------------------------------------------

  it("triggers blur lock after inactivity timeout", () => {
    const onFullLock = vi.fn();
    const blurMs = 2000;
    const fullMs = 5000;
    const { result } = renderHook(() =>
      useLockScreen({ enabled: true, onFullLock, blurTimeoutMs: blurMs, fullTimeoutMs: fullMs }),
    );

    act(() => {
      vi.advanceTimersByTime(blurMs + 100);
    });

    expect(result.current.lockLevel).toBe("blur");
  });

  it("triggers full lock after full inactivity timeout", () => {
    const onFullLock = vi.fn();
    const blurMs = 2000;
    const fullMs = 5000;
    renderHook(() =>
      useLockScreen({ enabled: true, onFullLock, blurTimeoutMs: blurMs, fullTimeoutMs: fullMs }),
    );

    act(() => {
      vi.advanceTimersByTime(fullMs + 100);
    });

    expect(onFullLock).toHaveBeenCalledTimes(1);
  });

  it("activity resets inactivity timers", () => {
    const onFullLock = vi.fn();
    const blurMs = 5000;
    const fullMs = 20000;
    const { result } = renderHook(() =>
      useLockScreen({ enabled: true, onFullLock, blurTimeoutMs: blurMs, fullTimeoutMs: fullMs }),
    );

    // Advance 2s (past the 1s activity debounce threshold)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.lockLevel).toBe("none");

    // Simulate activity -- this triggers debounced timer reset
    act(() => {
      document.dispatchEvent(new Event("mousemove"));
    });

    // Advance past the debounce delay (1000ms) so resetTimers runs
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Now advance 3s more -- total since reset is ~3s, less than 5s blur
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.lockLevel).toBe("none");

    // Advance another 2s to exceed the blur timeout since reset
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.lockLevel).toBe("blur");
  });

  // -------------------------------------------------------------------------
  // Tab visibility
  // -------------------------------------------------------------------------

  it("triggers blur lock when tab hidden longer than blur timeout", () => {
    const onFullLock = vi.fn();
    const blurMs = 2000;
    const fullMs = 10000;
    const { result } = renderHook(() =>
      useLockScreen({ enabled: true, onFullLock, blurTimeoutMs: blurMs, fullTimeoutMs: fullMs }),
    );

    // Simulate tab hidden
    act(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Advance time past blur threshold
    act(() => {
      vi.advanceTimersByTime(blurMs + 500);
    });

    // Simulate tab visible again
    act(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.lockLevel).toBe("blur");
  });

  it("triggers full lock when tab hidden longer than full timeout", () => {
    const onFullLock = vi.fn();
    const blurMs = 2000;
    const fullMs = 5000;
    renderHook(() =>
      useLockScreen({ enabled: true, onFullLock, blurTimeoutMs: blurMs, fullTimeoutMs: fullMs }),
    );

    // Simulate tab hidden
    act(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Advance time past full threshold
    act(() => {
      vi.advanceTimersByTime(fullMs + 500);
    });

    // Simulate tab visible again
    act(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onFullLock).toHaveBeenCalled();
  });

  it("does not trigger lock when tab hidden for short period", () => {
    const onFullLock = vi.fn();
    const blurMs = 5000;
    const fullMs = 10000;
    const { result } = renderHook(() =>
      useLockScreen({ enabled: true, onFullLock, blurTimeoutMs: blurMs, fullTimeoutMs: fullMs }),
    );

    // Simulate tab hidden briefly
    act(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    act(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.lockLevel).toBe("none");
    expect(onFullLock).not.toHaveBeenCalled();
  });
});
