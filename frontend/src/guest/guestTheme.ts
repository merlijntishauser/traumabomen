export type GuestTheme = "dark" | "light";

/** The main app's theme setting (hooks/useTheme.ts). Read only: the guest page never writes it. */
export const THEME_STORAGE_KEY = "traumabomen-theme";

/**
 * The theme to show: the visitor's choice in the main app if this browser has
 * one, else the main app's default (dark). Storage may be missing or throw.
 */
export function readStoredTheme(storage: Pick<Storage, "getItem"> | undefined): GuestTheme {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
