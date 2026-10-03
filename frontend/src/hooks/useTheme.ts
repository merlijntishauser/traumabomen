import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Theme } from "./useAvailableThemes";

const STORAGE_KEY = "traumabomen-theme";
const DEFAULT_THEMES: Theme[] = ["dark", "light"];

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
  // Storage can be missing or throw (private browsing, blocked site data,
  // some test environments); fall back to the default theme.
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Prerendering has no stored choice: render the default (dark) theme. */
function getServerSnapshot(): string | null {
  return null;
}

export function useTheme(availableThemes: Theme[] = DEFAULT_THEMES) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const theme: Theme =
    stored && availableThemes.includes(stored as Theme) ? (stored as Theme) : "dark";

  // Keep DOM in sync
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

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
