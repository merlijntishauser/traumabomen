import { useMemo } from "react";
import { chaikin, type FieldSpec, makeGrid, marchingSquares, toPath } from "./contourField";

const VIEWBOX_W = 1200;
const VIEWBOX_H = 800;
const TWO_PI = Math.PI * 2;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface ContourLine {
  id: string;
  d: string;
  strokeWidth: number;
  opacity: number;
}

/**
 * Generate a quiet elevation map: a main peak beyond a random corner, a
 * lower knoll further into the canvas, and gentle ripples, contoured as
 * level sets with marching squares. Level sets of one smooth field never
 * cross and merge organically around the saddle between the two hills.
 */
function buildFieldSpec(): FieldSpec {
  const corner = Math.floor(rand(0, 4));
  const inset = rand(60, 140);
  const corners: Record<number, { x: number; y: number }> = {
    0: { x: -inset, y: VIEWBOX_H + inset },
    1: { x: VIEWBOX_W + inset, y: VIEWBOX_H + inset },
    2: { x: -inset, y: -inset },
    3: { x: VIEWBOX_W + inset, y: -inset },
  };
  const main = corners[corner];

  // The knoll sits diagonally inward from the main peak
  const inwardX = main.x < 0 ? 1 : -1;
  const inwardY = main.y < 0 ? 1 : -1;
  const knollDist = rand(420, 620);
  const knollSkew = rand(-0.5, 0.5);

  return {
    peaks: [
      { x: main.x, y: main.y, amp: 1, sigma: rand(240, 320) },
      {
        x: main.x + inwardX * knollDist * (1 + knollSkew),
        y: main.y + inwardY * knollDist * (1 - knollSkew),
        amp: rand(0.32, 0.48),
        sigma: rand(130, 190),
      },
    ],
    ripples: Array.from({ length: 2 }, () => ({
      fx: rand(0.004, 0.008),
      fy: rand(0.004, 0.008),
      px: rand(0, TWO_PI),
      py: rand(0, TWO_PI),
      amp: rand(0.015, 0.03),
    })),
  };
}

/** Extract one elevation level as styled contour lines. */
function linesAtLevel(
  grid: ReturnType<typeof makeGrid>,
  threshold: number,
  level: number,
  falloff: number,
): ContourLine[] {
  const isIndex = level % 5 === 0;
  const lines: ContourLine[] = [];
  for (const [li, polyline] of marchingSquares(grid, threshold).entries()) {
    if (polyline.length < 6) continue;
    lines.push({
      id: `contour-${level}-${li}`,
      d: toPath(chaikin(polyline, 2)),
      strokeWidth: isIndex ? rand(1.2, 1.6) : rand(0.5, 0.8),
      opacity: (isIndex ? rand(0.5, 0.65) : rand(0.22, 0.34)) * falloff,
    });
  }
  return lines;
}

/**
 * Generate a quiet elevation map: a main peak beyond a random corner, a
 * lower knoll further into the canvas, and gentle ripples, contoured as
 * level sets with marching squares. Level sets of one smooth field never
 * cross and merge organically around the saddle between the two hills.
 */
function generateContours(): ContourLine[] {
  const spec = buildFieldSpec();
  const margin = 320;
  const grid = makeGrid(
    spec,
    { x0: -margin, y0: -margin, x1: VIEWBOX_W + margin, y1: VIEWBOX_H + margin },
    18,
  );

  let maxV = 0;
  for (const v of grid.values) if (v > maxV) maxV = v;

  const levelCount = Math.floor(rand(13, 17));
  const lines: ContourLine[] = [];
  for (let level = 0; level < levelCount; level++) {
    const t = (level + 1) / (levelCount + 1);
    // Contours fade as the terrain descends from the peak
    lines.push(...linesAtLevel(grid, maxV * (0.06 + t * 0.88), level, 0.45 + t * 0.55));
  }
  return lines;
}

export function BranchDecoration() {
  const contours = useMemo(generateContours, []);

  return (
    <svg
      className="branch-decoration"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {contours.map((line) => (
        <path
          key={line.id}
          d={line.d}
          stroke="var(--color-accent)"
          strokeWidth={line.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={line.opacity}
        />
      ))}
    </svg>
  );
}
