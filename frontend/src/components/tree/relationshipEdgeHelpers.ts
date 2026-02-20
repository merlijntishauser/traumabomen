import { getBezierPath, getSmoothStepPath, getStraightPath, type Position } from "@xyflow/react";
import type { EdgeStyle } from "../../hooks/useCanvasSettings";
import type { DecryptedRelationship } from "../../hooks/useTreeData";
import type { MarkerShape, RelationshipEdgeData } from "../../hooks/useTreeLayout";
import { NODE_HEIGHT, NODE_WIDTH } from "../../hooks/useTreeLayout";
import { RelationshipType } from "../../types/domain";

// ---- Constants ----

export const MARKER_CLIP: Record<MarkerShape, string> = {
  circle: "",
  square: "",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
};

export const BAR_Y_OFFSET = 50;

// ---- Types ----

export interface ForkPositions {
  parents: { cx: number; bottom: number }[];
  children: { cx: number; top: number }[];
  barY: number;
}

export interface EdgeStyleResult {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

export interface EdgePathResult {
  edgePath: string;
  hitPath: string;
  labelX: number;
  labelY: number;
}

export interface TooltipResult {
  typeLabel?: string;
  periodLine?: string;
}

export interface EdgeFlags {
  isPartner: boolean;
  isExPartner: boolean;
  isHalfSibling: boolean;
  isFriend: boolean;
  isDashed: boolean;
}

// ---- Fork path helpers ----

interface ChildSegmentResult {
  segments: string[];
  barLeft: number;
  barRight: number;
}

function buildChildSegments(
  fp: ForkPositions,
  barMid: number,
  initialLeft: number,
  initialRight: number,
): ChildSegmentResult {
  const R = 16;
  let barLeft = initialLeft;
  let barRight = initialRight;
  const segments: string[] = [];

  for (const c of fp.children) {
    const cr = Math.min(R, Math.abs(c.top - fp.barY) / 2);
    const nearParent = fp.parents.some((p) => Math.abs(c.cx - p.cx) <= R);
    const dir = nearParent ? 0 : c.cx < barMid ? 1 : c.cx > barMid ? -1 : 0;
    if (dir !== 0) {
      const barConn = c.cx + dir * cr;
      barLeft = Math.min(barLeft, barConn);
      barRight = Math.max(barRight, barConn);
      let seg = `M ${barConn},${fp.barY} `;
      seg += `Q ${c.cx},${fp.barY} ${c.cx},${fp.barY + cr} `;
      seg += `L ${c.cx},${c.top} `;
      segments.push(seg);
    } else {
      barLeft = Math.min(barLeft, c.cx);
      barRight = Math.max(barRight, c.cx);
      segments.push(`M ${c.cx},${fp.barY} L ${c.cx},${c.top} `);
    }
  }

  return { segments, barLeft, barRight };
}

export function buildCurvedForkPath(fp: ForkPositions): string {
  const R = 16;
  const [lp, rp] = [...fp.parents].sort((a, b) => a.cx - b.cx);
  const lr = Math.min(R, Math.abs(fp.barY - lp.bottom) / 2);
  const rr = Math.min(R, Math.abs(fp.barY - rp.bottom) / 2);

  let path = `M ${lp.cx},${lp.bottom} L ${lp.cx},${fp.barY - lr} `;
  path += `Q ${lp.cx},${fp.barY} ${lp.cx + lr},${fp.barY} `;
  path += `L ${rp.cx - rr},${fp.barY} `;
  path += `Q ${rp.cx},${fp.barY} ${rp.cx},${fp.barY - rr} `;
  path += `L ${rp.cx},${rp.bottom} `;

  const barMid = (lp.cx + rp.cx) / 2;
  const { segments, barLeft, barRight } = buildChildSegments(fp, barMid, lp.cx, rp.cx);

  if (barLeft < lp.cx) {
    path += `M ${barLeft},${fp.barY} L ${lp.cx},${fp.barY} `;
  }
  if (barRight > rp.cx) {
    path += `M ${rp.cx},${fp.barY} L ${barRight},${fp.barY} `;
  }

  for (const seg of segments) {
    path += seg;
  }
  return path;
}

export function buildStraightForkPath(fp: ForkPositions): string {
  const allX = [...fp.parents.map((p) => p.cx), ...fp.children.map((c) => c.cx)];
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);

  let path = "";
  for (const p of fp.parents) {
    path += `M ${p.cx},${p.bottom} L ${p.cx},${fp.barY} `;
  }
  path += `M ${minX},${fp.barY} L ${maxX},${fp.barY} `;
  for (const c of fp.children) {
    path += `M ${c.cx},${fp.barY} L ${c.cx},${c.top} `;
  }
  return path;
}

export function buildForkPath(fp: ForkPositions, edgeStyle: EdgeStyle = "curved"): string {
  return edgeStyle === "curved" ? buildCurvedForkPath(fp) : buildStraightForkPath(fp);
}

// ---- Edge style computation ----

export function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function computeEdgeStroke(
  flags: EdgeFlags,
  inferredType: string | undefined,
  coupleColor: string | undefined,
): EdgeStyleResult {
  let stroke = getCssVar("--color-edge-default");
  let strokeWidth = 1.5;
  let strokeDasharray: string | undefined;

  if (flags.isHalfSibling || inferredType === "half_sibling") {
    stroke = getCssVar("--color-edge-half-sibling");
    strokeDasharray = "4 4";
  } else if (inferredType === "full_sibling") {
    stroke = getCssVar("--color-edge-default");
    strokeDasharray = "4 4";
  } else if (flags.isExPartner) {
    stroke = getCssVar("--color-edge-partner");
    strokeDasharray = "6 3";
  } else if (flags.isPartner) {
    stroke = getCssVar("--color-edge-partner");
    strokeWidth = 2.5;
  } else if (flags.isFriend) {
    stroke = getCssVar("--color-edge-friend");
    strokeDasharray = "2 4";
  } else if (flags.isDashed) {
    stroke = getCssVar("--color-edge-step");
    strokeDasharray = "6 3";
  }

  if (coupleColor) {
    stroke = coupleColor;
  }

  return { stroke, strokeWidth, strokeDasharray };
}

// ---- Edge path computation ----

export function computeEdgePath(params: {
  isForkPrimary: boolean;
  isForkHidden: boolean;
  forkPositions: ForkPositions | null;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePosition: Position;
  targetPosition: Position;
  edgeStyle?: EdgeStyle;
}): EdgePathResult {
  const { isForkPrimary, isForkHidden, forkPositions, sx, sy, tx, ty } = params;

  if (isForkPrimary && forkPositions) {
    const edgePath = buildForkPath(forkPositions, params.edgeStyle);
    return {
      edgePath,
      hitPath: edgePath,
      labelX: (forkPositions.parents[0].cx + forkPositions.parents[1].cx) / 2,
      labelY: forkPositions.barY,
    };
  }

  if (isForkHidden) {
    const barY = sy + BAR_Y_OFFSET;
    const hitPath = `M ${sx},${sy} L ${sx},${barY} L ${tx},${barY} L ${tx},${ty}`;
    return { edgePath: hitPath, hitPath, labelX: (sx + tx) / 2, labelY: barY };
  }

  const pathParams = {
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    sourcePosition: params.sourcePosition,
    targetPosition: params.targetPosition,
  };

  const edgeStyle = params.edgeStyle ?? "curved";
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (edgeStyle === "straight") {
    [edgePath, labelX, labelY] = getStraightPath(pathParams);
  } else if (edgeStyle === "elbows") {
    [edgePath, labelX, labelY] = getSmoothStepPath(pathParams);
  } else {
    [edgePath, labelX, labelY] = getBezierPath(pathParams);
  }

  return { edgePath, hitPath: edgePath, labelX, labelY };
}

// ---- Tooltip content ----

const PARENT_TYPES = new Set([
  RelationshipType.BiologicalParent,
  RelationshipType.CoParent,
  RelationshipType.StepParent,
  RelationshipType.AdoptiveParent,
]);

export function computeTooltipContent(
  rel: DecryptedRelationship | undefined,
  relType: RelationshipType | undefined,
  inferredType: string | undefined,
  flags: Pick<EdgeFlags, "isPartner" | "isExPartner">,
  t: (key: string, opts?: Record<string, unknown>) => string,
): TooltipResult {
  let typeLabel: string | undefined;
  let periodLine: string | undefined;

  if (relType) {
    if (flags.isExPartner) {
      typeLabel = t("relationship.type.exPartner");
    } else if (PARENT_TYPES.has(relType)) {
      typeLabel = t(`relationship.type.${relType}`);
    } else {
      typeLabel = t(`relationship.type.${relType}`);
    }
  } else if (inferredType) {
    typeLabel = t(`relationship.type.${inferredType}`);
  }

  if (flags.isPartner && rel && rel.periods.length > 0) {
    const latest = rel.periods[rel.periods.length - 1];
    periodLine = `${t(`relationship.status.${latest.status}`)} ${latest.start_year}${latest.end_year ? ` - ${latest.end_year}` : " -"}`;
  }

  return { typeLabel, periodLine };
}

// ---- Fork selector ----

export function buildForkSelector(
  forkParentIds: [string, string] | undefined,
  forkChildIds: string[] | undefined,
): (state: {
  nodeLookup: Map<
    string,
    {
      position: { x: number; y: number };
      internals?: { positionAbsolute?: { x: number; y: number } };
      measured?: { width?: number; height?: number };
    }
  >;
}) => ForkPositions | null {
  return (state) => {
    if (!forkParentIds || !forkChildIds) return null;
    const lookup = state.nodeLookup;
    const parents: { cx: number; bottom: number }[] = [];
    const children: { cx: number; top: number }[] = [];

    for (const id of forkParentIds) {
      const n = lookup.get(id);
      if (!n) return null;
      const px = n.internals?.positionAbsolute?.x ?? n.position.x;
      const py = n.internals?.positionAbsolute?.y ?? n.position.y;
      const w = n.measured?.width ?? NODE_WIDTH;
      const h = n.measured?.height ?? NODE_HEIGHT;
      parents.push({ cx: px + w / 2, bottom: py + h });
    }

    for (const id of forkChildIds) {
      const n = lookup.get(id);
      if (!n) continue;
      const px = n.internals?.positionAbsolute?.x ?? n.position.x;
      const py = n.internals?.positionAbsolute?.y ?? n.position.y;
      const w = n.measured?.width ?? NODE_WIDTH;
      children.push({ cx: px + w / 2, top: py });
    }

    if (parents.length < 2 || children.length === 0) return null;
    const barY = Math.max(...parents.map((p) => p.bottom)) + BAR_Y_OFFSET;
    return { parents, children, barY };
  };
}

// ---- Edge flags ----

export function computeEdgeFlags(data: RelationshipEdgeData): EdgeFlags {
  const rel = data.relationship;
  const relType = rel?.type;
  const isPartner = relType === RelationshipType.Partner;
  const isExPartner =
    isPartner &&
    rel != null &&
    rel.periods.length > 0 &&
    rel.periods.every((p) => p.end_year != null);

  return {
    isPartner,
    isExPartner,
    isHalfSibling: relType === RelationshipType.HalfSibling,
    isFriend: relType === RelationshipType.Friend,
    isDashed:
      relType === RelationshipType.StepParent ||
      relType === RelationshipType.AdoptiveParent ||
      relType === RelationshipType.StepSibling,
  };
}
