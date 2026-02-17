export const PATTERN_COLORS = [
  "#818cf8",
  "#f472b6",
  "#fb923c",
  "#facc15",
  "#34d399",
  "#38bdf8",
  "#a78bfa",
  "#f87171",
];

const PATTERN_CSS_VARS = [
  "--color-pattern-0",
  "--color-pattern-1",
  "--color-pattern-2",
  "--color-pattern-3",
  "--color-pattern-4",
  "--color-pattern-5",
  "--color-pattern-6",
  "--color-pattern-7",
];

const HEX_TO_INDEX = new Map(PATTERN_COLORS.map((hex, i) => [hex.toLowerCase(), i]));

/**
 * Resolve a canonical pattern hex color to the current theme's value
 * via CSS custom properties. Falls back to the original hex if the
 * CSS variable is unavailable (e.g. in tests / SSR).
 */
export function getPatternColor(hex: string): string {
  const index = HEX_TO_INDEX.get(hex.toLowerCase());
  if (index === undefined) return hex;

  const cssVar = PATTERN_CSS_VARS[index];
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return resolved || hex;
}
