import { TraumaCategory } from "../types/domain";

/** CSS variable names for each trauma category, defined in theme.css */
const TRAUMA_CSS_VARS: Record<TraumaCategory, string> = {
  [TraumaCategory.Loss]: "--color-trauma-loss",
  [TraumaCategory.Abuse]: "--color-trauma-abuse",
  [TraumaCategory.Addiction]: "--color-trauma-addiction",
  [TraumaCategory.War]: "--color-trauma-war",
  [TraumaCategory.Displacement]: "--color-trauma-displacement",
  [TraumaCategory.Illness]: "--color-trauma-illness",
  [TraumaCategory.Poverty]: "--color-trauma-poverty",
};

/** Read the current computed trauma color from CSS variables, with fallback. */
export function getTraumaColor(category: TraumaCategory): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(TRAUMA_CSS_VARS[category])
    .trim();
  return value || TRAUMA_COLORS[category];
}

/** Read all trauma colors from CSS variables (call at render time). */
export function getTraumaColors(): Record<TraumaCategory, string> {
  const style = getComputedStyle(document.documentElement);
  const result = {} as Record<TraumaCategory, string>;
  for (const [cat, varName] of Object.entries(TRAUMA_CSS_VARS)) {
    const value = style.getPropertyValue(varName).trim();
    result[cat as TraumaCategory] = value || TRAUMA_COLORS[cat as TraumaCategory];
  }
  return result;
}

/**
 * Static fallback map for contexts where getComputedStyle isn't available.
 * Matches dark theme defaults.
 */
export const TRAUMA_COLORS: Record<TraumaCategory, string> = {
  [TraumaCategory.Loss]: "#818cf8",
  [TraumaCategory.Abuse]: "#f87171",
  [TraumaCategory.Addiction]: "#fb923c",
  [TraumaCategory.War]: "#a8a29e",
  [TraumaCategory.Displacement]: "#facc15",
  [TraumaCategory.Illness]: "#4ade80",
  [TraumaCategory.Poverty]: "#a78bfa",
};
