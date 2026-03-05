import { useCallback, useSyncExternalStore } from "react";
import type { Theme } from "./useAvailableThemes";

const STORAGE_KEY = "traumabomen-theme";

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
  return localStorage.getItem(STORAGE_KEY);
}

export function useTheme(availableThemes: Theme[] = ["dark", "light"]) {
  const stored = useSyncExternalStore(subscribe, getSnapshot);

  const theme: Theme =
    stored && availableThemes.includes(stored as Theme) ? (stored as Theme) : "dark";

  // Keep DOM in sync
  document.documentElement.setAttribute("data-theme", theme);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      if (!availableThemes.includes(newTheme)) return;
      localStorage.setItem(STORAGE_KEY, newTheme);
      emitChange();
    },
    [availableThemes],
  );

  const toggle = useCallback(() => {
    const currentIndex = availableThemes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % availableThemes.length;
    setTheme(availableThemes[nextIndex]);
  }, [availableThemes, theme, setTheme]);

  return { theme, setTheme, toggle, availableThemes } as const;
}
