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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface PatternArea {
  patternId: string;
  color: string;
  name: string;
  path: string;
  centroid: Point;
}

// -- Metaball field parameters --
const GRID_SIZE = 8;
const BLOB_RADIUS = 50;
const BRIDGE_RADIUS = 35;
const FIELD_THRESHOLD = 0.5;
const BRIDGE_SPACING = 50;
const FIELD_MARGIN = 80;
const REPEL_RADIUS = 45;
const REPEL_STRENGTH = 1.5;

// ── Field helpers ──────────────────────────────────────────────

/** Minimum distance from a point to a rectangle boundary. 0 if inside. */
function distToRect(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.sqrt(dx * dx + dy * dy);
}

/** Find the shortest edge between a tree node and a non-tree node. */
function findNearestEdge(
  cx: number[],
  cy: number[],
  inTree: Uint8Array,
  n: number,
): [number, number] {
  let bestD = Infinity;
  let bestI = 0;
  let bestJ = 0;
  for (let i = 0; i < n; i++) {
    if (!inTree[i]) continue;
    for (let j = 0; j < n; j++) {
      if (inTree[j]) continue;
      const d = (cx[i] - cx[j]) ** 2 + (cy[i] - cy[j]) ** 2;
      if (d < bestD) {
        bestD = d;
        bestI = i;
        bestJ = j;
      }
    }
  }
  return [bestI, bestJ];
}

/** Minimum spanning tree of rects by center-to-center distance (Prim's). */
function computeMST(rects: Rect[]): [number, number][] {
  const n = rects.length;
  if (n <= 1) return [];

  const cx = rects.map((r) => r.x + r.w / 2);
  const cy = rects.map((r) => r.y + r.h / 2);
  const inTree = new Uint8Array(n);
  inTree[0] = 1;
  const edges: [number, number][] = [];

  for (let added = 1; added < n; added++) {
    const [bestI, bestJ] = findNearestEdge(cx, cy, inTree, n);
    edges.push([bestI, bestJ]);
    inTree[bestJ] = 1;
  }
  return edges;
}

/** Place bridge field sources along MST edges to connect distant nodes. */
function generateBridges(rects: Rect[], mst: [number, number][]): Point[] {
  const out: Point[] = [];
  for (const [i, j] of mst) {
    const ax = rects[i].x + rects[i].w / 2;
    const ay = rects[i].y + rects[i].h / 2;
    const bx = rects[j].x + rects[j].w / 2;
    const by = rects[j].y + rects[j].h / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(dist / BRIDGE_SPACING));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const px = ax + dx * t;
      const py = ay + dy * t;
      // Skip points that are inside a member rect (field already strong there)
      if (!rects.some((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)) {
        out.push({ x: px, y: py });
      }
    }
  }
  return out;
}

// ── Marching squares ───────────────────────────────────────────

/** Compute padded bounding box around all field sources. */
function computeFieldBounds(
  memberRects: Rect[],
  bridges: Point[],
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of memberRects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  for (const b of bridges) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x);
    maxY = Math.max(maxY, b.y);
  }
  return {
    minX: minX - FIELD_MARGIN,
    minY: minY - FIELD_MARGIN,
    maxX: maxX + FIELD_MARGIN,
    maxY: maxY + FIELD_MARGIN,
  };
}

/** Sample metaball field values on a regular grid. */
function sampleField(
  memberRects: Rect[],
  bridges: Point[],
  repelRects: Rect[],
  minX: number,
  minY: number,
  cols: number,
  rows: number,
): Float64Array {
  const invBlob = 1 / (2 * BLOB_RADIUS * BLOB_RADIUS);
  const invBridge = 1 / (2 * BRIDGE_RADIUS * BRIDGE_RADIUS);
  const invRepel = 1 / (2 * REPEL_RADIUS * REPEL_RADIUS);
  const vals = new Float64Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    const py = minY + row * GRID_SIZE;
    for (let col = 0; col < cols; col++) {
      const px = minX + col * GRID_SIZE;
      let sum = 0;
      for (const r of memberRects) {
        const d = distToRect(px, py, r);
        sum += Math.exp(-(d * d) * invBlob);
      }
      for (const b of bridges) {
        const dx = px - b.x;
        const dy = py - b.y;
        sum += Math.exp(-(dx * dx + dy * dy) * invBridge);
      }
      for (const r of repelRects) {
        const d = distToRect(px, py, r);
        sum -= REPEL_STRENGTH * Math.exp(-(d * d) * invRepel);
      }
      vals[row * cols + col] = sum;
    }
  }
  return vals;
}

/** Emit marching-squares segments for one cell given its case index. */
function emitCellSegments(
  ci: number,
  top: Point,
  right: Point,
  bottom: Point,
  left: Point,
  out: Seg[],
): void {
  switch (ci) {
    case 1:
    case 14:
      out.push({ x1: left.x, y1: left.y, x2: bottom.x, y2: bottom.y });
      break;
    case 2:
    case 13:
      out.push({ x1: bottom.x, y1: bottom.y, x2: right.x, y2: right.y });
      break;
    case 3:
    case 12:
      out.push({ x1: left.x, y1: left.y, x2: right.x, y2: right.y });
      break;
    case 4:
    case 11:
      out.push({ x1: top.x, y1: top.y, x2: right.x, y2: right.y });
      break;
    case 5:
      out.push({ x1: left.x, y1: left.y, x2: top.x, y2: top.y });
      out.push({ x1: bottom.x, y1: bottom.y, x2: right.x, y2: right.y });
      break;
    case 6:
    case 9:
      out.push({ x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y });
      break;
    case 7:
    case 8:
      out.push({ x1: top.x, y1: top.y, x2: left.x, y2: left.y });
      break;
    case 10:
      out.push({ x1: top.x, y1: top.y, x2: right.x, y2: right.y });
      out.push({ x1: left.x, y1: left.y, x2: bottom.x, y2: bottom.y });
      break;
  }
}

/** Classify a marching-squares cell from its four corner values. 0 or 15 = no contour. */
function classifyCell(tl: number, tr: number, br: number, bl: number): number {
  let ci = 0;
  if (tl >= FIELD_THRESHOLD) ci |= 8;
  if (tr >= FIELD_THRESHOLD) ci |= 4;
  if (br >= FIELD_THRESHOLD) ci |= 2;
  if (bl >= FIELD_THRESHOLD) ci |= 1;
  return ci;
}

/** Extract marching-squares segments from a sampled field grid. */
function extractSegments(
  vals: Float64Array,
  cols: number,
  rows: number,
  minX: number,
  minY: number,
): Seg[] {
  const segments: Seg[] = [];
  const v = (c: number, r: number) => vals[r * cols + c];
  const frac = (a: number, b: number) => (b === a ? 0.5 : (FIELD_THRESHOLD - a) / (b - a));

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const tl = v(col, row);
      const tr = v(col + 1, row);
      const br = v(col + 1, row + 1);
      const bl = v(col, row + 1);

      const ci = classifyCell(tl, tr, br, bl);
      if (ci === 0 || ci === 15) continue;

      const x = minX + col * GRID_SIZE;
      const y = minY + row * GRID_SIZE;
      const s = GRID_SIZE;

      emitCellSegments(
        ci,
        { x: x + frac(tl, tr) * s, y },
        { x: x + s, y: y + frac(tr, br) * s },
        { x: x + frac(bl, br) * s, y: y + s },
        { x, y: y + frac(tl, bl) * s },
        segments,
      );
    }
  }
  return segments;
}

/** Sample metaball field on a grid and extract isoline contours. */
function computeContours(memberRects: Rect[], bridges: Point[], repelRects: Rect[]): Point[][] {
  if (memberRects.length === 0) return [];

  const { minX, minY, maxX, maxY } = computeFieldBounds(memberRects, bridges);
  const cols = Math.ceil((maxX - minX) / GRID_SIZE) + 2;
  const rows = Math.ceil((maxY - minY) / GRID_SIZE) + 2;

  const vals = sampleField(memberRects, bridges, repelRects, minX, minY, cols, rows);
  const segments = extractSegments(vals, cols, rows, minX, minY);

  return chainSegments(segments);
}

const roundCoord = (n: number) => Math.round(n * 10) / 10;
const coordKey = (x: number, y: number) => `${roundCoord(x)},${roundCoord(y)}`;

type AdjEntry = { x: number; y: number; idx: number };

/** Build an adjacency map from segment endpoints to their neighbors. */
function buildAdjacency(segments: Seg[]): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const k1 = coordKey(s.x1, s.y1);
    const k2 = coordKey(s.x2, s.y2);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1)!.push({ x: s.x2, y: s.y2, idx: i });
    adj.get(k2)!.push({ x: s.x1, y: s.y1, idx: i });
  }
  return adj;
}

/** Trace a single contour starting from a segment, consuming connected unused segments. */
function traceContour(
  start: Seg,
  startIdx: number,
  adj: Map<string, AdjEntry[]>,
  used: Set<number>,
): Point[] {
  used.add(startIdx);
  const contour: Point[] = [
    { x: start.x1, y: start.y1 },
    { x: start.x2, y: start.y2 },
  ];

  let extending = true;
  while (extending) {
    extending = false;
    const last = contour[contour.length - 1];
    const neighbors = adj.get(coordKey(last.x, last.y));
    if (!neighbors) continue;
    for (const n of neighbors) {
      if (used.has(n.idx)) continue;
      contour.push({ x: n.x, y: n.y });
      used.add(n.idx);
      extending = true;
      break;
    }
  }
  return contour;
}

/** Chain marching-squares segments into ordered closed contours. */
function chainSegments(segments: Seg[]): Point[][] {
  if (segments.length === 0) return [];

  const adj = buildAdjacency(segments);
  const used = new Set<number>();
  const contours: Point[][] = [];

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    const contour = traceContour(segments[i], i, adj, used);
    if (contour.length >= 6) contours.push(contour);
  }

  return contours;
}

// ── Smoothing ──────────────────────────────────────────────────

/** Resample a closed polygon into N evenly-spaced points. */
function resample(poly: Point[], count: number): Point[] {
  const n = poly.length;
  if (n <= 2) return poly;

  const lengths: number[] = [0];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    total += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    lengths.push(total);
  }

  const step = total / count;
  const result: Point[] = [];
  for (let i = 0; i < count; i++) {
    const target = i * step;
    let ei = 0;
    while (ei < n - 1 && lengths[ei + 1] < target) ei++;
    const t = lengths[ei + 1] - lengths[ei];
    const f = t > 0 ? (target - lengths[ei]) / t : 0;
    const a = poly[ei];
    const b = poly[(ei + 1) % n];
    result.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return result;
}

/** Closed Catmull-Rom spline -> SVG cubic bezier path. */
function smoothPath(points: Point[]): string {
  const count = Math.min(Math.max(48, Math.ceil(points.length / 3)), 80);
  const pts = points.length >= 3 ? resample(points, count) : points;
  const n = pts.length;
  if (n < 3) return `M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;

  const tension = 0.35;
  const parts: string[] = [`M ${pts[0].x} ${pts[0].y}`];

  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];

    const cp1x = p1.x + (p2.x - p0.x) * tension * (1 / 3);
    const cp1y = p1.y + (p2.y - p0.y) * tension * (1 / 3);
    const cp2x = p2.x - (p3.x - p1.x) * tension * (1 / 3);
    const cp2y = p2.y - (p3.y - p1.y) * tension * (1 / 3);

    parts.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return parts.join(" ");
}

// ── Helpers ────────────────────────────────────────────────────

function centroid(points: Point[]): Point {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x: cx, y: cy };
}

// ── Component ──────────────────────────────────────────────────

export function PatternConnectors({
  patterns,
  visiblePatternIds,
  onPatternClick,
}: PatternConnectorsProps) {
  const nodes = useNodes<PersonNodeType>();
  const { x: vx, y: vy, zoom } = useViewport();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nodeRects = useMemo(() => {
    const map = new Map<string, Rect>();
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

      const memberRects = personIds.map((pid) => nodeRects.get(pid)!);

      // Collect non-member node rects for repulsion
      const memberSet = new Set(personIds);
      const repelRects: Rect[] = [];
      for (const [nodeId, rect] of nodeRects) {
        if (!memberSet.has(nodeId)) repelRects.push(rect);
      }

      // Build MST + bridge sources for connectivity
      const mst = computeMST(memberRects);
      const bridges = generateBridges(memberRects, mst);

      // Compute metaball contours with repulsion from non-member nodes
      const contours = computeContours(memberRects, bridges, repelRects);
      if (contours.length === 0) continue;

      // Use the longest contour as the primary shape
      const contour = contours.reduce((a, b) => (a.length > b.length ? a : b));
      const path = smoothPath(contour);
      const center = centroid(contour);

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
