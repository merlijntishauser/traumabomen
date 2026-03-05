import { useCallback, useEffect, useState } from "react";
import type { Theme } from "./useAvailableThemes";

const STORAGE_KEY = "traumabomen-theme";

function getInitialTheme(availableThemes: Theme[]): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && availableThemes.includes(stored as Theme)) {
    return stored as Theme;
  }
  return "dark";
}

export function useTheme(availableThemes: Theme[] = ["dark", "light"]) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme(availableThemes));

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Fall back to "dark" if current theme is removed from available list
  useEffect(() => {
    if (!availableThemes.includes(theme)) {
      setThemeState("dark");
    }
  }, [availableThemes, theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const currentIndex = availableThemes.indexOf(prev);
      const nextIndex = (currentIndex + 1) % availableThemes.length;
      return availableThemes[nextIndex];
    });
  }, [availableThemes]);

  return { theme, setTheme, toggle, availableThemes } as const;
}
