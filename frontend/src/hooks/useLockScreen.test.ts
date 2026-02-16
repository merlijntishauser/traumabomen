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
});
