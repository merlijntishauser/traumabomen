import { LifeEventCategory } from "../types/domain";
import { makeCategoryColors } from "./categoryColors";

const CSS_VARS: Record<LifeEventCategory, string> = {
  [LifeEventCategory.Family]: "--color-life-family",
  [LifeEventCategory.Education]: "--color-life-education",
  [LifeEventCategory.Career]: "--color-life-career",
  [LifeEventCategory.Relocation]: "--color-life-relocation",
  [LifeEventCategory.Health]: "--color-life-health",
  [LifeEventCategory.Medication]: "--color-life-medication",
  [LifeEventCategory.Other]: "--color-life-other",
};

const FALLBACKS: Record<LifeEventCategory, string> = {
  [LifeEventCategory.Family]: "#60a5fa",
  [LifeEventCategory.Education]: "#a78bfa",
  [LifeEventCategory.Career]: "#fbbf24",
  [LifeEventCategory.Relocation]: "#2dd4bf",
  [LifeEventCategory.Health]: "#f472b6",
  [LifeEventCategory.Medication]: "#22d3ee",
  [LifeEventCategory.Other]: "#94a3b8",
};

const { getColor, getColors, COLORS } = makeCategoryColors(CSS_VARS, FALLBACKS);

export const getLifeEventColor = getColor;
export const getLifeEventColors = getColors;
export const LIFE_EVENT_COLORS = COLORS;
