import type { ClassificationStatus } from "../types/domain";

const FALLBACKS: Record<ClassificationStatus, string> = {
  suspected: "#fbbf24",
  diagnosed: "#38bdf8",
};

export function getClassificationColor(status: ClassificationStatus): string {
  const varName = `--color-classification-${status}`;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || FALLBACKS[status];
}
