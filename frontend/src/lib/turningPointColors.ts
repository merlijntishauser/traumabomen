import { TurningPointCategory } from "../types/domain";

/** CSS variable names for each turning point category, defined in theme.css */
const TURNING_POINT_CSS_VARS: Record<TurningPointCategory, string> = {
  [TurningPointCategory.CycleBreaking]: "--color-tp-cycle-breaking",
  [TurningPointCategory.ProtectiveRelationship]: "--color-tp-protective-relationship",
  [TurningPointCategory.Recovery]: "--color-tp-recovery",
  [TurningPointCategory.Achievement]: "--color-tp-achievement",
  [TurningPointCategory.PositiveChange]: "--color-tp-positive-change",
};

/** Read the current computed turning point color from CSS variables, with fallback. */
export function getTurningPointColor(category: TurningPointCategory): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(TURNING_POINT_CSS_VARS[category])
    .trim();
  return value || TURNING_POINT_COLORS[category];
}

/** Read all turning point colors from CSS variables (call at render time). */
export function getTurningPointColors(): Record<TurningPointCategory, string> {
  const style = getComputedStyle(document.documentElement);
  const result = {} as Record<TurningPointCategory, string>;
  for (const [cat, varName] of Object.entries(TURNING_POINT_CSS_VARS)) {
    const value = style.getPropertyValue(varName).trim();
    result[cat as TurningPointCategory] =
      value || TURNING_POINT_COLORS[cat as TurningPointCategory];
  }
  return result;
}

/**
 * Static fallback map for contexts where getComputedStyle isn't available.
 * Matches dark theme defaults.
 */
export const TURNING_POINT_COLORS: Record<TurningPointCategory, string> = {
  [TurningPointCategory.CycleBreaking]: "#34d399",
  [TurningPointCategory.ProtectiveRelationship]: "#60a5fa",
  [TurningPointCategory.Recovery]: "#a78bfa",
  [TurningPointCategory.Achievement]: "#fbbf24",
  [TurningPointCategory.PositiveChange]: "#2dd4bf",
};
