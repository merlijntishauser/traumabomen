import { TraumaCategory } from "../types/domain";

export const TRAUMA_COLORS: Record<TraumaCategory, string> = {
  [TraumaCategory.Loss]: "#6366f1",
  [TraumaCategory.Abuse]: "#ef4444",
  [TraumaCategory.Addiction]: "#f97316",
  [TraumaCategory.War]: "#78716c",
  [TraumaCategory.Displacement]: "#eab308",
  [TraumaCategory.Illness]: "#22c55e",
  [TraumaCategory.Poverty]: "#8b5cf6",
};
