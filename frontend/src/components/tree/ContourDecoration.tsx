import { useId, useMemo } from "react";
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

/** A hill's summit, tinted softly so the terrain reads as height, not lines on paper. */
interface Summit {
  id: string;
  x: number;
  y: number;
  r: number;
  strength: number;
}

interface Terrain {
  lines: ContourLine[];
  summits: Summit[];
}

const CORNER_COUNT = 4;

function cornerPoint(corner: number, inset: number): { x: number; y: number } {
  const left = corner === 0 || corner === 2;
  const bottom = corner === 0 || corner === 1;
  return {
    x: left ? -inset : VIEWBOX_W + inset,
    y: bottom ? VIEWBOX_H + inset : -inset,
  };
}

/**
 * Generate a quiet elevation map: a main peak beyond a random corner, a
 * lower knoll further into the canvas, a distant low hill toward the
 * opposite corner so the drawing spans the page, and gentle ripples,
 * contoured as level sets with marching squares. Level sets of one smooth
 * field never cross and merge organically around the saddles between hills.
 */
function buildFieldSpec(): FieldSpec {
  const corner = Math.floor(rand(0, CORNER_COUNT));
  const main = cornerPoint(corner, rand(60, 140));

  // The knoll sits diagonally inward from the main peak
  const inwardX = main.x < 0 ? 1 : -1;
  const inwardY = main.y < 0 ? 1 : -1;
  const knollDist = rand(420, 620);
  const knollSkew = rand(-0.5, 0.5);

  // The far hill rises near the diagonally opposite corner, inside the frame
  const far = cornerPoint(3 - corner, -rand(140, 260));

  return {
    peaks: [
      { x: main.x, y: main.y, amp: 1, sigma: rand(250, 330) },
      {
        x: main.x + inwardX * knollDist * (1 + knollSkew),
        y: main.y + inwardY * knollDist * (1 - knollSkew),
        amp: rand(0.34, 0.5),
        sigma: rand(130, 190),
      },
      { x: far.x, y: far.y, amp: rand(0.24, 0.34), sigma: rand(150, 210) },
    ],
    ripples: Array.from({ length: 3 }, () => ({
      fx: rand(0.004, 0.009),
      fy: rand(0.004, 0.009),
      px: rand(0, TWO_PI),
      py: rand(0, TWO_PI),
      amp: rand(0.018, 0.035),
    })),
  };
}

/** Rings smaller than this (viewBox units) read as a target, not terrain. */
const MIN_RING_EXTENT = 110;

/** The larger side of a polyline's bounding box. */
function extent(points: { x: number; y: number }[]): number {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.max(maxX - minX, maxY - minY);
}

/** Extract one elevation level as styled contour lines; every fifth is an index contour. */
function linesAtLevel(
  grid: ReturnType<typeof makeGrid>,
  threshold: number,
  level: number,
  falloff: number,
): ContourLine[] {
  const isIndex = level % 5 === 0;
  const lines: ContourLine[] = [];
  for (const [li, polyline] of marchingSquares(grid, threshold).entries()) {
    if (polyline.length < 6 || extent(polyline) < MIN_RING_EXTENT) continue;
    lines.push({
      id: `contour-${level}-${li}`,
      d: toPath(chaikin(polyline, 2)),
      strokeWidth: isIndex ? rand(1.5, 1.9) : rand(0.6, 0.85),
      opacity: (isIndex ? rand(0.78, 0.9) : rand(0.34, 0.46)) * falloff,
    });
  }
  return lines;
}

function generateTerrain(): Terrain {
  const spec = buildFieldSpec();
  const margin = 320;
  const grid = makeGrid(
    spec,
    { x0: -margin, y0: -margin, x1: VIEWBOX_W + margin, y1: VIEWBOX_H + margin },
    18,
  );

  let maxV = 0;
  for (const v of grid.values) if (v > maxV) maxV = v;

  const levelCount = Math.floor(rand(14, 18));
  const lines: ContourLine[] = [];
  for (let level = 0; level < levelCount; level++) {
    const t = (level + 1) / (levelCount + 1);
    // Contours fade as the terrain descends from the peak
    // Levels stop short of each summit, which the glow marks instead.
    lines.push(...linesAtLevel(grid, maxV * (0.05 + t * 0.78), level, 0.4 + t * 0.6));
  }

  const summits = spec.peaks.map((peak, i) => ({
    id: `summit-${i}`,
    x: peak.x,
    y: peak.y,
    r: peak.sigma * 1.9,
    strength: peak.amp,
  }));
  return { lines, summits };
}

export function ContourDecoration() {
  const { lines, summits } = useMemo(generateTerrain, []);
  // useId may contain characters that break url(#…) references.
  const glowId = `contour-glow-${useId().replace(/[^\w-]/g, "")}`;

  return (
    <svg
      className="contour-decoration"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="var(--color-contour-glow)" stopOpacity="0.55" />
          <stop offset="55%" stopColor="var(--color-contour-glow)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-contour-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {summits.map((summit) => (
        <circle
          key={summit.id}
          className="contour-decoration__summit"
          cx={summit.x}
          cy={summit.y}
          r={summit.r}
          fill={`url(#${glowId})`}
          opacity={summit.strength}
        />
      ))}
      {lines.map((line) => (
        <path
          key={line.id}
          d={line.d}
          stroke="var(--color-contour)"
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
