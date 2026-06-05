import type { TooltipLine } from "./timelineHelpers";

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  lines: TooltipLine[];
}

export const INITIAL_TOOLTIP: TooltipState = {
  visible: false,
  x: 0,
  y: 0,
  lines: [],
};
