import { useNodes, useViewport } from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import type { PersonNodeType } from "../../hooks/useTreeLayout";
import { NODE_HEIGHT, NODE_WIDTH } from "../../hooks/useTreeLayout";

interface PatternConnectorsProps {
  patterns: Map<string, DecryptedPattern>;
  visiblePatternIds: Set<string>;
  onPatternClick?: (patternId: string) => void;
}

interface Point {
  x: number;
  y: number;
}

interface PatternArea {
  patternId: string;
  color: string;
  name: string;
  path: string;
  centroid: Point;
}

const HULL_PADDING = 10;

/** Cross product of vectors OA and OB. Positive = counter-clockwise. */
function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Convex hull via Andrew's monotone chain (returns CCW order). */
function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 1) return pts;

  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last point of each half because it's repeated
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Expand hull outward by offsetting each edge and computing new intersections. */
function expandHull(hull: Point[], padding: number): Point[] {
  const n = hull.length;
  if (n === 0) return [];
  if (n === 1) {
    // Single point -> square around it
    const p = hull[0];
    return [
      { x: p.x - padding, y: p.y - padding },
      { x: p.x + padding, y: p.y - padding },
      { x: p.x + padding, y: p.y + padding },
      { x: p.x - padding, y: p.y + padding },
    ];
  }
  if (n === 2) {
    // Two points -> rectangle with padding
    const [a, b] = hull;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / len) * padding;
    const ny = (dx / len) * padding;
    const ex = (dx / len) * padding;
    const ey = (dy / len) * padding;
    return [
      { x: a.x + nx - ex, y: a.y + ny - ey },
      { x: b.x + nx + ex, y: b.y + ny + ey },
      { x: b.x - nx + ex, y: b.y - ny + ey },
      { x: a.x - nx - ex, y: a.y - ny - ey },
    ];
  }

  // For 3+ points, offset each edge outward
  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    const curr = hull[i];
    const next = hull[(i + 1) % n];

    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Outward normal (hull is CCW)
    const nx = (-dy / len) * padding;
    const ny = (dx / len) * padding;

    result.push({ x: curr.x + nx, y: curr.y + ny });
    result.push({ x: next.x + nx, y: next.y + ny });
  }
  // Re-hull the expanded points to clean up
  return convexHull(result);
}

/** Resample a closed polygon into N evenly-spaced points along its perimeter. */
function resampleHull(hull: Point[], count: number): Point[] {
  const n = hull.length;
  if (n <= 2) return hull;

  // Compute cumulative edge lengths
  const lengths: number[] = [0];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];
    total += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    lengths.push(total);
  }

  const step = total / count;
  const result: Point[] = [];
  for (let i = 0; i < count; i++) {
    const target = i * step;
    // Find which edge this distance falls on
    let edgeIdx = 0;
    while (edgeIdx < n - 1 && lengths[edgeIdx + 1] < target) edgeIdx++;
    const edgeStart = lengths[edgeIdx];
    const edgeLen = lengths[edgeIdx + 1] - edgeStart;
    const frac = edgeLen > 0 ? (target - edgeStart) / edgeLen : 0;
    const a = hull[edgeIdx];
    const b = hull[(edgeIdx + 1) % n];
    result.push({ x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac });
  }
  return result;
}

/** Closed Catmull-Rom spline -> SVG cubic bezier path. */
function smoothClosedPath(points: Point[]): string {
  // Resample into evenly-spaced points for organic curves
  const resampled = points.length >= 3 ? resampleHull(points, Math.max(points.length, 24)) : points;
  const n = resampled.length;
  if (n < 3) {
    return `M ${resampled.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;
  }

  const tension = 0.5;
  const parts: string[] = [`M ${resampled[0].x} ${resampled[0].y}`];

  for (let i = 0; i < n; i++) {
    const p0 = resampled[(i - 1 + n) % n];
    const p1 = resampled[i];
    const p2 = resampled[(i + 1) % n];
    const p3 = resampled[(i + 2) % n];

    const cp1x = p1.x + (p2.x - p0.x) * tension * (1 / 3);
    const cp1y = p1.y + (p2.y - p0.y) * tension * (1 / 3);
    const cp2x = p2.x - (p3.x - p1.x) * tension * (1 / 3);
    const cp2y = p2.y - (p3.y - p1.y) * tension * (1 / 3);

    parts.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return parts.join(" ");
}

function centroid(points: Point[]): Point {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x: cx, y: cy };
}

export function PatternConnectors({
  patterns,
  visiblePatternIds,
  onPatternClick,
}: PatternConnectorsProps) {
  const nodes = useNodes<PersonNodeType>();
  const { x: vx, y: vy, zoom } = useViewport();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nodeRects = useMemo(() => {
    const map = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const node of nodes) {
      map.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        w: NODE_WIDTH,
        h: NODE_HEIGHT,
      });
    }
    return map;
  }, [nodes]);

  const areas = useMemo(() => {
    const result: PatternArea[] = [];

    for (const pattern of patterns.values()) {
      if (!visiblePatternIds.has(pattern.id)) continue;

      const personIds = Array.from(new Set(pattern.person_ids)).filter((pid) => nodeRects.has(pid));
      if (personIds.length === 0) continue;

      // Collect node corner points so the hull tightly wraps each rectangle
      const cornerPoints: Point[] = [];
      for (const pid of personIds) {
        const r = nodeRects.get(pid)!;
        cornerPoints.push(
          { x: r.x, y: r.y },
          { x: r.x + r.w, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h },
        );
      }

      const hull = convexHull(cornerPoints);
      // Small visual breathing room beyond node edges
      const expanded = expandHull(hull, HULL_PADDING);
      const path = smoothClosedPath(expanded);
      const center = centroid(expanded);

      result.push({
        patternId: pattern.id,
        color: pattern.color,
        name: pattern.name,
        path,
        centroid: center,
      });
    }
    return result;
  }, [patterns, visiblePatternIds, nodeRects]);

  const handleMouseEnter = useCallback((id: string) => setHoveredId(id), []);
  const handleMouseLeave = useCallback(() => setHoveredId(null), []);

  if (areas.length === 0) return null;

  return (
    <svg
      data-testid="pattern-connectors"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <g transform={`translate(${vx}, ${vy}) scale(${zoom})`}>
        {areas.map((area) => {
          const isHovered = hoveredId === area.patternId;
          return (
            <g
              key={area.patternId}
              style={{ pointerEvents: "all", cursor: "pointer" }}
              onMouseEnter={() => handleMouseEnter(area.patternId)}
              onMouseLeave={handleMouseLeave}
              onClick={() => onPatternClick?.(area.patternId)}
              data-testid="pattern-area"
            >
              <path
                d={area.path}
                fill={area.color}
                fillOpacity={isHovered ? 0.18 : 0.08}
                stroke={area.color}
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={isHovered ? 0.8 : 0.4}
                style={{ transition: "fill-opacity 0.15s ease, stroke-opacity 0.15s ease" }}
              />
              <text
                x={area.centroid.x}
                y={area.centroid.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={500}
                fill={area.color}
                opacity={isHovered ? 1 : 0}
                paintOrder="stroke fill"
                stroke="var(--color-bg-primary)"
                strokeWidth={4}
                strokeLinejoin="round"
                style={{ transition: "opacity 0.15s ease", pointerEvents: "none" }}
              >
                {area.name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
