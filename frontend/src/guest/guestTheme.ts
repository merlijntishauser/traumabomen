export type GuestTheme = "dark" | "light";

/** The main app's theme setting (hooks/useTheme.ts). Read only: the guest page never writes it. */
export const THEME_STORAGE_KEY = "traumabomen-theme";

/**
 * The theme to show: the visitor's choice in the main app if this browser has
 * one, else the main app's default (dark). Storage may be missing or throw.
 */
export function readStoredTheme(
  getStorage: () => Pick<Storage, "getItem"> | undefined,
): GuestTheme {
  // Reading window.localStorage itself throws a SecurityError when the browser
  // blocks site data, so the access happens inside the try.
  try {
    const stored = getStorage()?.getItem(THEME_STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
