import { useFeatureFlags } from "./useFeatureFlags";

export type Theme = "dark" | "light" | "watercolor";

export function useAvailableThemes(): Theme[] {
  const { data } = useFeatureFlags();
  const themes: Theme[] = ["dark", "light"];
  if (data?.watercolor_theme) themes.push("watercolor");
  return themes;
}
