import { TraumaCategory } from "../types/domain";
import { makeCategoryColors } from "./categoryColors";

const CSS_VARS: Record<TraumaCategory, string> = {
  [TraumaCategory.Loss]: "--color-trauma-loss",
  [TraumaCategory.Abuse]: "--color-trauma-abuse",
  [TraumaCategory.Addiction]: "--color-trauma-addiction",
  [TraumaCategory.War]: "--color-trauma-war",
  [TraumaCategory.Displacement]: "--color-trauma-displacement",
  [TraumaCategory.Illness]: "--color-trauma-illness",
  [TraumaCategory.Poverty]: "--color-trauma-poverty",
};

const FALLBACKS: Record<TraumaCategory, string> = {
  [TraumaCategory.Loss]: "#818cf8",
  [TraumaCategory.Abuse]: "#f87171",
  [TraumaCategory.Addiction]: "#fbbf24",
  [TraumaCategory.War]: "#a8a29e",
  [TraumaCategory.Displacement]: "#e879f9",
  [TraumaCategory.Illness]: "#22d3ee",
  [TraumaCategory.Poverty]: "#a78bfa",
};

const { getColor, getColors, COLORS } = makeCategoryColors(CSS_VARS, FALLBACKS);

export const getTraumaColor = getColor;
export const getTraumaColors = getColors;
export const TRAUMA_COLORS = COLORS;
