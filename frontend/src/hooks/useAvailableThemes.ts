export type Theme = "dark" | "light";

export function useAvailableThemes(): Theme[] {
  return ["dark", "light"];
}
