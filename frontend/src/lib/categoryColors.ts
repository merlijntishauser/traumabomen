/**
 * Factory for category-to-CSS-variable color modules.
 * Used by traumaColors, lifeEventColors, and turningPointColors.
 */
export function makeCategoryColors<T extends string>(
  cssVars: Record<T, string>,
  fallbacks: Record<T, string>,
) {
  return {
    getColor(category: T): string {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(cssVars[category])
        .trim();
      return value || fallbacks[category];
    },
    getColors(): Record<T, string> {
      const style = getComputedStyle(document.documentElement);
      const result = {} as Record<T, string>;
      for (const [cat, varName] of Object.entries(cssVars) as [T, string][]) {
        const value = style.getPropertyValue(varName).trim();
        result[cat] = value || fallbacks[cat];
      }
      return result;
    },
    COLORS: fallbacks,
  };
}
