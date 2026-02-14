import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useStore,
} from "@xyflow/react";
import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EdgeStyle } from "../../hooks/useCanvasSettings";
import type { MarkerShape, RelationshipEdgeData } from "../../hooks/useTreeLayout";
import { NODE_HEIGHT, NODE_WIDTH } from "../../hooks/useTreeLayout";
import { RelationshipType } from "../../types/domain";
import "./RelationshipEdge.css";

const MARKER_CLIP: Record<MarkerShape, string> = {
  circle: "",
  square: "",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
};

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const PARENT_TYPES = new Set([
  RelationshipType.BiologicalParent,
  RelationshipType.StepParent,
  RelationshipType.AdoptiveParent,
]);

const BAR_Y_OFFSET = 50;

interface ForkPositions {
  parents: { cx: number; bottom: number }[];
  children: { cx: number; top: number }[];
  barY: number;
}

function buildForkPath(fp: ForkPositions, edgeStyle: EdgeStyle = "curved"): string {
  const allX = [...fp.parents.map((p) => p.cx), ...fp.children.map((c) => c.cx)];
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);

  if (edgeStyle === "curved") {
    const R = 16;
    // Sort parents left-to-right to draw as one continuous sub-path
    const [lp, rp] = [...fp.parents].sort((a, b) => a.cx - b.cx);
    const lr = Math.min(R, Math.abs(fp.barY - lp.bottom) / 2);
    const rr = Math.min(R, Math.abs(fp.barY - rp.bottom) / 2);

    // Parents + bar: one continuous path (no M breaks at corners)
    let path = `M ${lp.cx},${lp.bottom} L ${lp.cx},${fp.barY - lr} `;
    path += `Q ${lp.cx},${fp.barY} ${lp.cx + lr},${fp.barY} `;
    path += `L ${rp.cx - rr},${fp.barY} `;
    path += `Q ${rp.cx},${fp.barY} ${rp.cx},${fp.barY - rr} `;
    path += `L ${rp.cx},${rp.bottom} `;

    // Extend bar if children fall outside parent range
    if (minX < lp.cx) {
      path += `M ${minX},${fp.barY} L ${lp.cx},${fp.barY} `;
    }
    if (maxX > rp.cx) {
      path += `M ${rp.cx},${fp.barY} L ${maxX},${fp.barY} `;
    }

    // Children: each branches off the bar
    const barMid = (lp.cx + rp.cx) / 2;
    for (const c of fp.children) {
      const cr = Math.min(R, Math.abs(c.top - fp.barY) / 2);
      const dir = c.cx < barMid ? -1 : c.cx > barMid ? 1 : 0;
      if (dir !== 0) {
        path += `M ${c.cx + dir * cr},${fp.barY} `;
        path += `Q ${c.cx},${fp.barY} ${c.cx},${fp.barY + cr} `;
        path += `L ${c.cx},${c.top} `;
      } else {
        path += `M ${c.cx},${fp.barY} L ${c.cx},${c.top} `;
      }
    }
    return path;
  }

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

function RelationshipEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  ...rest
}: EdgeProps & { data: RelationshipEdgeData }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);

  const rel = data.relationship;
  const relType = rel?.type;
  const inferredType = data.inferredType;
  const isPartner = relType === RelationshipType.Partner;
  const isExPartner =
    isPartner &&
    rel != null &&
    rel.periods.length > 0 &&
    rel.periods.every((p) => p.end_year != null);
  const isHalfSibling = relType === RelationshipType.HalfSibling;
  const isDashed =
    relType === RelationshipType.StepParent ||
    relType === RelationshipType.AdoptiveParent ||
    relType === RelationshipType.StepSibling;

  const sOff = data.sourceOffset ?? { x: 0, y: 0 };
  const tOff = data.targetOffset ?? { x: 0, y: 0 };
  const sx = sourceX + sOff.x;
  const sy = sourceY + sOff.y;
  const tx = targetX + tOff.x;
  const ty = targetY + tOff.y;

  // Fork primary: get reactive positions from store
  const forkParentIds = data.junctionFork?.parentIds;
  const forkChildIds = data.junctionFork?.childIds;
  const forkSelector = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any): ForkPositions | null => {
      if (!forkParentIds || !forkChildIds) return null;
      const lookup = state.nodeLookup as Map<string, any>;
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
    },
    [forkParentIds, forkChildIds],
  );
  const forkPositions = useStore(forkSelector);

  const isForkPrimary = !!data.junctionFork;
  const isForkHidden = !!data.junctionHidden;

  let edgePath: string;
  let hitPath: string;
  let labelX: number;
  let labelY: number;

  if (isForkPrimary && forkPositions) {
    edgePath = buildForkPath(forkPositions, data.edgeStyle);
    // Hit path covers entire fork for combined tooltip
    hitPath = edgePath;
    labelX = (forkPositions.parents[0].cx + forkPositions.parents[1].cx) / 2;
    labelY = forkPositions.barY;
  } else if (isForkHidden) {
    // Hidden fork edge: compute hit path from reactive handle positions
    const barY = sy + BAR_Y_OFFSET;
    hitPath = `M ${sx},${sy} L ${sx},${barY} L ${tx},${barY} L ${tx},${ty}`;
    edgePath = hitPath;
    labelX = (sx + tx) / 2;
    labelY = barY;
  } else {
    const pathParams = {
      sourceX: sx,
      sourceY: sy,
      targetX: tx,
      targetY: ty,
      sourcePosition,
      targetPosition,
    };

    const edgeStyle = data.edgeStyle ?? "curved";
    if (edgeStyle === "straight") {
      [edgePath, labelX, labelY] = getStraightPath(pathParams);
    } else if (edgeStyle === "elbows") {
      [edgePath, labelX, labelY] = getSmoothStepPath(pathParams);
    } else {
      [edgePath, labelX, labelY] = getBezierPath(pathParams);
    }
    hitPath = edgePath;
  }

  let stroke = getCssVar("--color-edge-default");
  let strokeWidth = 1.5;
  let strokeDasharray: string | undefined;

  if (isHalfSibling) {
    stroke = getCssVar("--color-edge-half-sibling");
    strokeDasharray = "4 4";
  } else if (inferredType === "half_sibling") {
    stroke = getCssVar("--color-edge-half-sibling");
    strokeDasharray = "4 4";
  } else if (inferredType === "full_sibling") {
    stroke = getCssVar("--color-edge-default");
    strokeDasharray = "4 4";
  } else if (isExPartner) {
    stroke = getCssVar("--color-edge-partner");
    strokeWidth = 1.5;
    strokeDasharray = "6 3";
  } else if (isPartner) {
    stroke = getCssVar("--color-edge-partner");
    strokeWidth = 2.5;
  } else if (isDashed) {
    stroke = getCssVar("--color-edge-step");
    strokeDasharray = "6 3";
  }

  // Couple color overrides stroke for biological parent edges
  if (data.coupleColor) {
    stroke = data.coupleColor;
  }

  // Compute tooltip content
  let typeLabel: string | undefined;
  let periodLine: string | undefined;

  if (relType) {
    if (isExPartner) {
      typeLabel = t("relationship.type.exPartner");
    } else if (PARENT_TYPES.has(relType)) {
      typeLabel = t(`relationship.type.${relType}`);
    } else {
      typeLabel = t(`relationship.type.${relType}`);
    }
  } else if (inferredType) {
    typeLabel = t(`relationship.type.${inferredType}`);
  }

  if (isPartner && rel && rel.periods.length > 0) {
    const latest = rel.periods[rel.periods.length - 1];
    periodLine = `${t(`relationship.status.${latest.status}`)} ${latest.start_year}${latest.end_year ? ` - ${latest.end_year}` : " -"}`;
  }

  const markerShape = data.markerShape;

  // Hidden fork edges: primary edge handles all visual + interaction
  if (isForkHidden) {
    return <path d="M 0,0" fill="none" stroke="none" />;
  }

  return (
    <>
      {/* Visible edge */}
      {isForkPrimary ? (
        <path
          d={edgePath}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <BaseEdge
          {...rest}
          path={edgePath}
          style={{ stroke, strokeWidth, strokeDasharray }}
          interactionWidth={20}
        />
      )}
      {/* Invisible wider hit area for hover */}
      <path
        d={hitPath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {/* Shape markers + tooltip rendered via EdgeLabelRenderer (above nodes) */}
      {((!isForkPrimary && markerShape) || (hovered && typeLabel)) && (
        <EdgeLabelRenderer>
          {!isForkPrimary && markerShape && (
            <>
              <div
                className={`edge-marker edge-marker--${markerShape}`}
                style={{
                  transform: `translate(-50%, -50%) translate(${sx}px, ${sy}px)`,
                  backgroundColor: stroke,
                  clipPath: MARKER_CLIP[markerShape] || undefined,
                }}
              />
              <div
                className={`edge-marker edge-marker--${markerShape}`}
                style={{
                  transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px)`,
                  backgroundColor: stroke,
                  clipPath: MARKER_CLIP[markerShape] || undefined,
                }}
              />
            </>
          )}
          {hovered && typeLabel && (
            <div
              className="edge-tooltip"
              style={{
                transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 10}px)`,
              }}
            >
              <span className="edge-tooltip__type">{typeLabel}</span>
              {isForkPrimary && data.junctionFork ? (
                <span className="edge-tooltip__names">
                  {data.junctionFork.parentNames.join(" & ")} &rarr;{" "}
                  {data.junctionFork.childNames.join(", ")}
                </span>
              ) : (
                <span className="edge-tooltip__names">
                  {data.sourceName ?? "?"} &mdash; {data.targetName ?? "?"}
                </span>
              )}
              {periodLine && <span className="edge-tooltip__period">{periodLine}</span>}
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
