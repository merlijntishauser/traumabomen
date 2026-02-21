import { LifeEventCategory } from "../types/domain";

/** CSS variable names for each life event category, defined in theme.css */
const LIFE_EVENT_CSS_VARS: Record<LifeEventCategory, string> = {
  [LifeEventCategory.Family]: "--color-life-family",
  [LifeEventCategory.Education]: "--color-life-education",
  [LifeEventCategory.Career]: "--color-life-career",
  [LifeEventCategory.Relocation]: "--color-life-relocation",
  [LifeEventCategory.Health]: "--color-life-health",
  [LifeEventCategory.Medication]: "--color-life-medication",
  [LifeEventCategory.Other]: "--color-life-other",
};

/** Read the current computed life event color from CSS variables, with fallback. */
export function getLifeEventColor(category: LifeEventCategory): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(LIFE_EVENT_CSS_VARS[category])
    .trim();
  return value || LIFE_EVENT_COLORS[category];
}

/** Read all life event colors from CSS variables (call at render time). */
export function getLifeEventColors(): Record<LifeEventCategory, string> {
  const style = getComputedStyle(document.documentElement);
  const result = {} as Record<LifeEventCategory, string>;
  for (const [cat, varName] of Object.entries(LIFE_EVENT_CSS_VARS)) {
    const value = style.getPropertyValue(varName).trim();
    result[cat as LifeEventCategory] = value || LIFE_EVENT_COLORS[cat as LifeEventCategory];
  }
  return result;
}

/**
 * Static fallback map for contexts where getComputedStyle isn't available.
 * Matches dark theme defaults.
 */
export const LIFE_EVENT_COLORS: Record<LifeEventCategory, string> = {
  [LifeEventCategory.Family]: "#60a5fa",
  [LifeEventCategory.Education]: "#a78bfa",
  [LifeEventCategory.Career]: "#fbbf24",
  [LifeEventCategory.Relocation]: "#2dd4bf",
  [LifeEventCategory.Health]: "#f472b6",
  [LifeEventCategory.Medication]: "#22d3ee",
  [LifeEventCategory.Other]: "#94a3b8",
};
