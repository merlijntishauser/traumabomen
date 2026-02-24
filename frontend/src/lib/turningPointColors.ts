import { TurningPointCategory } from "../types/domain";
import { makeCategoryColors } from "./categoryColors";

const CSS_VARS: Record<TurningPointCategory, string> = {
  [TurningPointCategory.CycleBreaking]: "--color-tp-cycle-breaking",
  [TurningPointCategory.ProtectiveRelationship]: "--color-tp-protective-relationship",
  [TurningPointCategory.Recovery]: "--color-tp-recovery",
  [TurningPointCategory.Achievement]: "--color-tp-achievement",
  [TurningPointCategory.PositiveChange]: "--color-tp-positive-change",
};

const FALLBACKS: Record<TurningPointCategory, string> = {
  [TurningPointCategory.CycleBreaking]: "#34d399",
  [TurningPointCategory.ProtectiveRelationship]: "#60a5fa",
  [TurningPointCategory.Recovery]: "#a78bfa",
  [TurningPointCategory.Achievement]: "#fbbf24",
  [TurningPointCategory.PositiveChange]: "#2dd4bf",
};

const { getColor, getColors, COLORS } = makeCategoryColors(CSS_VARS, FALLBACKS);

export const getTurningPointColor = getColor;
export const getTurningPointColors = getColors;
export const TURNING_POINT_COLORS = COLORS;
