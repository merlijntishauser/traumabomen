import type { StripeLayout, StripeRow } from "../../lib/familyStripes";

/** Field geometry in px: the ruler, a header per generation, one row per person. */
export const RULER_HEIGHT = 40;
export const GEN_HEIGHT = 30;
export const ROW_HEIGHT = 54;
export const BAND = ROW_HEIGHT - 26;
export const BAND_TOP = 9;

export interface RowGeometry {
  row: StripeRow;
  y: number;
}

/** Rows and generation separators in field coordinates. */
export function fieldGeometry(layout: StripeLayout): {
  rows: RowGeometry[];
  gens: number[];
  height: number;
} {
  const rows: RowGeometry[] = [];
  const gens: number[] = [];
  let y = RULER_HEIGHT;
  for (const group of layout.generations) {
    gens.push(y);
    y += GEN_HEIGHT;
    for (const row of group.rows) {
      rows.push({ row, y });
      y += ROW_HEIGHT;
    }
  }
  return { rows, gens, height: y + 8 };
}

/** Five-point star for turning points, centred on (cx, cy). */
export function starPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 ? r * 0.45 : r;
    points.push(
      `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`,
    );
  }
  return points.join(" ");
}

/** Where to scroll so a column at x stays in view, or null when it already is. */
export function revealScrollLeft(x: number, scrollLeft: number, viewWidth: number): number | null {
  const left = x - scrollLeft;
  if (left >= 24 && left <= viewWidth - 24) return null;
  return Math.max(0, x - viewWidth / 2);
}

/** Width kept for a ruler label: four digits at the larger text sizes. */
const RULER_LABEL_WIDTH = 40;
const LABEL_OFFSET = 4;
const FLAG_CLEARANCE = 6;

export interface RulerLabelPlacement {
  x: number;
  anchor: "start" | "end";
}

/**
 * Where a decade label goes: right of its tick, or, when the year flag covers
 * that spot, stepped aside to the flag's nearer edge. Null when stepping aside
 * would run into the neighbouring label, or when it would sit under the names
 * column (left of `visibleFrom`).
 */
export function rulerLabelPlacement(
  tickX: number,
  decadeWidth: number,
  flag: { left: number; right: number },
  visibleFrom = 0,
): RulerLabelPlacement | null {
  const start = tickX + LABEL_OFFSET;
  const end = start + RULER_LABEL_WIDTH;
  const blockedLeft = flag.left - FLAG_CLEARANCE;
  const blockedRight = flag.right + FLAG_CLEARANCE;
  if (end <= blockedLeft || start >= blockedRight) {
    return start < visibleFrom ? null : { x: start, anchor: "start" };
  }
  const stepLeft = start + RULER_LABEL_WIDTH / 2 < (flag.left + flag.right) / 2;
  const placement: RulerLabelPlacement = stepLeft
    ? { x: blockedLeft, anchor: "end" }
    : { x: blockedRight, anchor: "start" };
  const left = stepLeft ? blockedLeft - RULER_LABEL_WIDTH : blockedRight;
  const right = left + RULER_LABEL_WIDTH;
  // Neighbouring labels sit one decade away; stepping aside must not reach them.
  const previousEnd = tickX - decadeWidth + LABEL_OFFSET + RULER_LABEL_WIDTH;
  const nextStart = tickX + decadeWidth + LABEL_OFFSET;
  if (left < previousEnd + LABEL_OFFSET || right > nextStart - LABEL_OFFSET) return null;
  return left < visibleFrom ? null : placement;
}
