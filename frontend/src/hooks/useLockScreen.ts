import { useCallback, useEffect, useRef, useState } from "react";

export type LockLevel = "none" | "blur" | "full";

const DOUBLE_ESC_WINDOW_MS = 500;
const ACTIVITY_DEBOUNCE_MS = 1000;
const DEFAULT_BLUR_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_FULL_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_WRONG_ATTEMPTS = 5;

interface UseLockScreenOptions {
  enabled: boolean;
  blurTimeoutMs?: number;
  fullTimeoutMs?: number;
  onFullLock: () => void;
}

interface UseLockScreenReturn {
  lockLevel: LockLevel;
  wrongAttempts: number;
  lock: () => void;
  unlock: () => void;
  failedAttempt: () => void;
}

export function useLockScreen({
  enabled,
  blurTimeoutMs = DEFAULT_BLUR_TIMEOUT_MS,
  fullTimeoutMs = DEFAULT_FULL_TIMEOUT_MS,
  onFullLock,
}: UseLockScreenOptions): UseLockScreenReturn {
  const [lockLevel, setLockLevel] = useState<LockLevel>("none");
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const lastEscRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fullTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hiddenAtRef = useRef<number | null>(null);

  const triggerFullLock = useCallback(() => {
    setLockLevel("full");
    setWrongAttempts(0);
    onFullLock();
  }, [onFullLock]);

  const lock = useCallback(() => {
    setLockLevel("blur");
  }, []);

  const unlock = useCallback(() => {
    setLockLevel("none");
    setWrongAttempts(0);
    lastActivityRef.current = Date.now();
  }, []);

  const failedAttempt = useCallback(() => {
    setWrongAttempts((prev) => {
      const next = prev + 1;
      if (next >= MAX_WRONG_ATTEMPTS) {
        triggerFullLock();
      }
      return next;
    });
  }, [triggerFullLock]);

  // Double-Esc detection (capturing phase)
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;

      const now = Date.now();
      if (now - lastEscRef.current < DOUBLE_ESC_WINDOW_MS) {
        // Second Esc within window -- trigger blur lock
        e.preventDefault();
        e.stopPropagation();
        lock();
        lastEscRef.current = 0;
      } else {
        // First Esc -- let it propagate normally
        lastEscRef.current = now;
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, lock]);

  // Inactivity timers
  useEffect(() => {
    if (!enabled || lockLevel !== "none") return;

    function resetTimers() {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      if (fullTimerRef.current) clearTimeout(fullTimerRef.current);

      blurTimerRef.current = setTimeout(() => {
        lock();
      }, blurTimeoutMs);

      fullTimerRef.current = setTimeout(() => {
        triggerFullLock();
      }, fullTimeoutMs);
    }

    let debounceTimer: ReturnType<typeof setTimeout>;

    function onActivity() {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_DEBOUNCE_MS) return;
      lastActivityRef.current = now;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(resetTimers, ACTIVITY_DEBOUNCE_MS);
    }

    const events = ["mousemove", "keydown", "touchstart", "scroll"] as const;
    for (const event of events) {
      document.addEventListener(event, onActivity, { passive: true });
    }

    resetTimers();

    return () => {
      for (const event of events) {
        document.removeEventListener(event, onActivity);
      }
      clearTimeout(debounceTimer);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      if (fullTimerRef.current) clearTimeout(fullTimerRef.current);
    };
  }, [enabled, lockLevel, blurTimeoutMs, fullTimeoutMs, lock, triggerFullLock]);

  // Tab visibility: check elapsed time on refocus
  useEffect(() => {
    if (!enabled) return;

    function handleVisibility() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current !== null) {
        const elapsed = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;

        if (elapsed >= fullTimeoutMs) {
          triggerFullLock();
        } else if (elapsed >= blurTimeoutMs && lockLevel === "none") {
          lock();
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, lockLevel, blurTimeoutMs, fullTimeoutMs, lock, triggerFullLock]);

  return { lockLevel, wrongAttempts, lock, unlock, failedAttempt };
}
