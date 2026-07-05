import { useMemo } from "react";

const VIEWBOX_W = 1200;
const VIEWBOX_H = 800;
const TWO_PI = Math.PI * 2;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Smooth closed Catmull-Rom loop through points, converted to cubic Bezier.
 */
function catmullRomLoop(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n < 3) return "";

  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    const tension = 6;
    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;

    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return `${d}Z`;
}

interface ContourLine {
  id: string;
  d: string;
  strokeWidth: number;
  opacity: number;
}

/**
 * Generate true topographic contours: nested rings around a peak sitting
 * just outside a random corner, so calm elevation arcs sweep across it.
 * Every ring shares one low-frequency noise field, so neighbours stay
 * parallel and never cross; every 5th ring is an index contour (bolder),
 * and lines fade with distance from the peak.
 */
function generateContours(): ContourLine[] {
  const lines: ContourLine[] = [];

  // Peak sits off-canvas beyond one corner
  const corner = Math.floor(rand(0, 4));
  const inset = rand(80, 160);
  const centers: Record<number, { x: number; y: number }> = {
    0: { x: -inset, y: VIEWBOX_H + inset },
    1: { x: VIEWBOX_W + inset, y: VIEWBOX_H + inset },
    2: { x: -inset, y: -inset },
    3: { x: VIEWBOX_W + inset, y: -inset },
  };
  const center = centers[corner];

  // A shared angular noise field: a few low-frequency harmonics with fixed
  // random phases. Identical across rings, so contours nest like terrain.
  const harmonics = Array.from({ length: 3 }, (_, k) => ({
    freq: k + 2 + Math.floor(rand(0, 2)),
    phase: rand(0, TWO_PI),
    amp: rand(12, 26) / (k + 1),
  }));
  const wobble = (angle: number) =>
    harmonics.reduce((sum, h) => sum + h.amp * Math.sin(h.freq * angle + h.phase), 0);

  const ringCount = Math.floor(rand(14, 19));
  const spacing = rand(38, 48);
  const startRadius = rand(70, 130);
  const steps = 64;

  for (let i = 0; i < ringCount; i++) {
    const baseRadius = startRadius + i * spacing;
    // Terrain relaxes as it descends: outer rings wander slightly more
    const relax = 1 + i * 0.04;
    const points: { x: number; y: number }[] = [];

    for (let s = 0; s < steps; s++) {
      const angle = (s / steps) * TWO_PI;
      const r = baseRadius + wobble(angle) * relax;
      points.push({
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
      });
    }

    // Index contour convention: every 5th line is bolder
    const isIndex = i % 5 === 0;
    // Elevation fades as it flows away from the peak
    const falloff = 1 - (i / ringCount) * 0.55;

    lines.push({
      id: `contour-${i}`,
      d: catmullRomLoop(points),
      strokeWidth: isIndex ? rand(1.2, 1.6) : rand(0.5, 0.8),
      opacity: (isIndex ? rand(0.5, 0.65) : rand(0.2, 0.32)) * falloff,
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
      {contours.map((line) => (
        <path
          key={line.id}
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
