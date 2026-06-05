export interface Point {
  x: number;
  y: number;
}

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Emit marching-squares segments for one cell given its case index. */
export function emitCellSegments(
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
