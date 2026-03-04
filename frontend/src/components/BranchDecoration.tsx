import { useMemo } from "react";

const VIEWBOX_W = 1200;
const VIEWBOX_H = 800;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Smooth Catmull-Rom spline through points, converted to cubic Bezier.
 */
function catmullRomPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";

  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const tension = 6;
    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;

    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return d;
}

interface ContourLine {
  d: string;
  strokeWidth: number;
  opacity: number;
}

/**
 * Generate topographic-style contour lines flowing from one corner.
 * Dense, evenly-spaced lines like a real elevation map, with every
 * 5th line bolder (index contour convention).
 */
function generateContours(): ContourLine[] {
  const lines: ContourLine[] = [];

  // Pick one corner as the origin
  const corner = Math.floor(rand(0, 4));
  const origins: Record<number, { x: number; y: number; angle: number }> = {
    0: { x: -150, y: VIEWBOX_H + 150, angle: -0.45 },
    1: { x: VIEWBOX_W + 150, y: VIEWBOX_H + 150, angle: Math.PI + 0.45 },
    2: { x: -150, y: -150, angle: 0.45 },
    3: { x: VIEWBOX_W + 150, y: -150, angle: Math.PI - 0.45 },
  };

  const origin = origins[corner];
  const lineCount = Math.floor(rand(16, 24));

  for (let i = 0; i < lineCount; i++) {
    const t = i / (lineCount - 1);

    // Tight, even angular spread
    const angleOffset = (t - 0.5) * rand(0.7, 1.0);
    const lineAngle = origin.angle + angleOffset;

    const totalLength = rand(700, 1200);
    const pointCount = Math.floor(rand(7, 10));
    // Gentle shared drift so neighbouring lines stay coherent
    const drift = rand(-25, 25);
    const points: { x: number; y: number }[] = [];

    for (let p = 0; p <= pointCount; p++) {
      const pt = p / pointCount;
      const dist = pt * totalLength;

      let x = origin.x + Math.cos(lineAngle) * dist;
      let y = origin.y + Math.sin(lineAngle) * dist;

      const perpAngle = lineAngle + Math.PI / 2;
      const arcOffset = Math.sin(pt * Math.PI) * drift;
      x += Math.cos(perpAngle) * arcOffset;
      y += Math.sin(perpAngle) * arcOffset;

      x += rand(-2, 2);
      y += rand(-2, 2);

      points.push({ x, y });
    }

    // Index contour every 5th line (bolder), rest are fine
    const isIndex = i % 5 === 0;

    lines.push({
      d: catmullRomPath(points),
      strokeWidth: isIndex ? rand(1.2, 1.8) : rand(0.4, 0.8),
      opacity: isIndex ? rand(0.55, 0.75) : rand(0.2, 0.4),
    });
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
      {contours.map((line, i) => (
        <path
          key={`contour-${i}`}
          d={line.d}
          stroke="var(--color-accent)"
          strokeWidth={line.strokeWidth}
          strokeLinecap="round"
          fill="none"
          opacity={line.opacity}
        />
      ))}
    </svg>
  );
}
