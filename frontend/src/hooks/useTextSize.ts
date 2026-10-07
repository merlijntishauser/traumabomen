import { useCallback, useEffect, useSyncExternalStore } from "react";

export type TextSize = "small" | "normal" | "large";

export const TEXT_SIZES: readonly TextSize[] = ["small", "normal", "large"];

const STORAGE_KEY = "traumabomen-text-size";

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): string | null {
  // Storage can be missing or throw (private browsing, blocked site data);
  // fall back to normal text.
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function parseTextSize(stored: string | null): TextSize {
  return TEXT_SIZES.includes(stored as TextSize) ? (stored as TextSize) : "normal";
}

/** Interface text size, persisted per browser and applied as `data-text-size` on <html>. */
export function useTextSize() {
  const textSize = parseTextSize(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot));

  useEffect(() => {
    if (textSize === "normal") {
      document.documentElement.removeAttribute("data-text-size");
    } else {
      document.documentElement.setAttribute("data-text-size", textSize);
    }
  }, [textSize]);

  const setTextSize = useCallback((size: TextSize) => {
    try {
      localStorage.setItem(STORAGE_KEY, size);
    } catch {
      return;
    }
    emitChange();
  }, []);

  return { textSize, setTextSize } as const;
}
