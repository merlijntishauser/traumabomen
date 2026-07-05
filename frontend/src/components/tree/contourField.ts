/**
 * Scalar-field contour extraction for the background decoration: gaussian
 * hills plus gentle ripples, contoured with marching squares. Level sets of
 * a smooth field never cross, merge organically around saddles, and close
 * around peaks: real cartography rather than simulated cartography.
 */

export interface Peak {
  x: number;
  y: number;
  amp: number;
  sigma: number;
}

export interface Ripple {
  fx: number;
  fy: number;
  px: number;
  py: number;
  amp: number;
}

export interface FieldSpec {
  peaks: Peak[];
  ripples: Ripple[];
}

export interface Grid {
  values: Float64Array;
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
}

export interface Point {
  x: number;
  y: number;
}

export function sampleField(spec: FieldSpec, x: number, y: number): number {
  let v = 0;
  for (const p of spec.peaks) {
    const dx = x - p.x;
    const dy = y - p.y;
    v += p.amp * Math.exp(-(dx * dx + dy * dy) / (2 * p.sigma * p.sigma));
  }
  for (const r of spec.ripples) {
    v += r.amp * Math.sin(x * r.fx + r.px) * Math.sin(y * r.fy + r.py);
  }
  return v;
}

export function makeGrid(
  spec: FieldSpec,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  cell: number,
): Grid {
  const nx = Math.max(2, Math.ceil((bounds.x1 - bounds.x0) / cell) + 1);
  const ny = Math.max(2, Math.ceil((bounds.y1 - bounds.y0) / cell) + 1);
  const dx = (bounds.x1 - bounds.x0) / (nx - 1);
  const dy = (bounds.y1 - bounds.y0) / (ny - 1);
  const values = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      values[j * nx + i] = sampleField(spec, bounds.x0 + i * dx, bounds.y0 + j * dy);
    }
  }
  return { values, nx, ny, x0: bounds.x0, y0: bounds.y0, dx, dy };
}

/** Interpolated crossing point between two grid corners. */
function lerpPoint(
  ax: number,
  ay: number,
  av: number,
  bx: number,
  by: number,
  bv: number,
  t: number,
): Point {
  const f = (t - av) / (bv - av);
  return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f };
}

function key(p: Point): string {
  return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
}

/**
 * Marching squares: extract the level set at `threshold` as chained
 * polylines in world coordinates. Closed loops repeat their first point at
 * the end; open lines terminate at the grid border.
 */
type Edge = "top" | "right" | "bottom" | "left";

/** Segment topology per marching-squares case (saddles handled separately). */
const EDGE_TABLE: Record<number, [Edge, Edge][]> = {
  1: [["left", "bottom"]],
  2: [["bottom", "right"]],
  3: [["left", "right"]],
  4: [["top", "right"]],
  6: [["top", "bottom"]],
  7: [["left", "top"]],
  8: [["left", "top"]],
  9: [["top", "bottom"]],
  11: [["top", "right"]],
  12: [["left", "right"]],
  13: [["bottom", "right"]],
  14: [["left", "bottom"]],
};

/** Saddle cases pair edges by whether the cell centre is above the level. */
function segmentsForCell(idx: number, centreAbove: boolean): [Edge, Edge][] {
  if (idx === 5) {
    return centreAbove
      ? [
          ["left", "top"],
          ["bottom", "right"],
        ]
      : [
          ["left", "bottom"],
          ["top", "right"],
        ];
  }
  if (idx === 10) {
    return centreAbove
      ? [
          ["top", "right"],
          ["left", "bottom"],
        ]
      : [
          ["left", "top"],
          ["bottom", "right"],
        ];
  }
  return EDGE_TABLE[idx] ?? [];
}

/** Emit the level-set segments crossing one grid cell. */
function emitCellSegments(
  grid: Grid,
  threshold: number,
  i: number,
  j: number,
  segments: [Point, Point][],
): void {
  const { values, nx, x0, y0, dx, dy } = grid;
  const xL = x0 + i * dx;
  const xR = xL + dx;
  const yT = y0 + j * dy;
  const yB = yT + dy;
  const tl = values[j * nx + i];
  const tr = values[j * nx + i + 1];
  const br = values[(j + 1) * nx + i + 1];
  const bl = values[(j + 1) * nx + i];

  const idx =
    (tl >= threshold ? 8 : 0) |
    (tr >= threshold ? 4 : 0) |
    (br >= threshold ? 2 : 0) |
    (bl >= threshold ? 1 : 0);
  if (idx === 0 || idx === 15) return;

  const edgePoint: Record<Edge, () => Point> = {
    top: () => lerpPoint(xL, yT, tl, xR, yT, tr, threshold),
    right: () => lerpPoint(xR, yT, tr, xR, yB, br, threshold),
    bottom: () => lerpPoint(xL, yB, bl, xR, yB, br, threshold),
    left: () => lerpPoint(xL, yT, tl, xL, yB, bl, threshold),
  };

  const centreAbove = (tl + tr + br + bl) / 4 >= threshold;
  for (const [a, b] of segmentsForCell(idx, centreAbove)) {
    segments.push([edgePoint[a](), edgePoint[b]()]);
  }
}

export function marchingSquares(grid: Grid, threshold: number): Point[][] {
  const segments: [Point, Point][] = [];
  for (let j = 0; j < grid.ny - 1; j++) {
    for (let i = 0; i < grid.nx - 1; i++) {
      emitCellSegments(grid, threshold, i, j, segments);
    }
  }
  return chainSegments(segments);
}

/** Extend a chain from one tip until no unused segment continues it. */
function extendChain(
  line: Point[],
  fromTail: boolean,
  segments: [Point, Point][],
  used: boolean[],
  byEnd: Map<string, number[]>,
): void {
  for (;;) {
    const tip = fromTail ? line[line.length - 1] : line[0];
    const candidates = byEnd.get(key(tip)) ?? [];
    let next = -1;
    for (const c of candidates) {
      if (!used[c]) {
        next = c;
        break;
      }
    }
    if (next === -1) return;
    used[next] = true;
    const [a, b] = segments[next];
    const joined = key(a) === key(tip) ? b : a;
    if (fromTail) line.push(joined);
    else line.unshift(joined);
  }
}

/** Chain loose segments into polylines by matching endpoints. */
function chainSegments(segments: [Point, Point][]): Point[][] {
  const byEnd = new Map<string, number[]>();
  segments.forEach(([a, b], i) => {
    for (const p of [a, b]) {
      const k = key(p);
      const list = byEnd.get(k) ?? [];
      list.push(i);
      byEnd.set(k, list);
    }
  });

  const used = new Array<boolean>(segments.length).fill(false);
  const lines: Point[][] = [];

  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue;
    used[s] = true;
    const line: Point[] = [segments[s][0], segments[s][1]];
    extendChain(line, true, segments, used, byEnd);
    extendChain(line, false, segments, used, byEnd);
    lines.push(line);
  }

  return lines;
}

/** Chaikin corner cutting: smooths marching-squares angularity. */
export function chaikin(points: Point[], iterations: number): Point[] {
  let pts = points;
  const closed = points.length > 2 && key(points[0]) === key(points[points.length - 1]);

  for (let it = 0; it < iterations; it++) {
    const src = closed ? pts.slice(0, -1) : pts;
    const out: Point[] = [];
    if (!closed) out.push(src[0]);
    const n = src.length;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = src[i];
      const b = src[(i + 1) % n];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    if (!closed) out.push(src[n - 1]);
    else out.push(out[0]);
    pts = out;
  }
  return pts;
}

/** Render a polyline as an SVG path. */
export function toPath(points: Point[]): string {
  if (points.length < 2) return "";
  const parts = [`M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`);
  }
  return parts.join("");
}
