import { BaseEdge, EdgeLabelRenderer, type EdgeProps, useStore, useViewport } from "@xyflow/react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RelationshipEdgeData } from "../../hooks/useTreeLayout";
import {
  buildForkSelector,
  computeEdgeFlags,
  computeEdgePath,
  computeEdgeStroke,
  computeTooltipContent,
  MARKER_CLIP,
} from "./relationshipEdgeHelpers";
import "./RelationshipEdge.css";

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
  const { x: vx, y: vy, zoom } = useViewport();
  const [mouseFlowPos, setMouseFlowPos] = useState({ x: 0, y: 0 });

  const toFlowPos = useCallback(
    (e: React.MouseEvent) => ({
      x: (e.clientX - vx) / zoom,
      y: (e.clientY - vy) / zoom,
    }),
    [vx, vy, zoom],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => setMouseFlowPos(toFlowPos(e)),
    [toFlowPos],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      setMouseFlowPos(toFlowPos(e));
      setHovered(true);
    },
    [toFlowPos],
  );

  const rel = data.relationship;
  const relType = rel?.type;
  const inferredType = data.inferredType;
  const flags = computeEdgeFlags(data);

  const sOff = data.sourceOffset ?? { x: 0, y: 0 };
  const tOff = data.targetOffset ?? { x: 0, y: 0 };
  const sx = sourceX + sOff.x;
  const sy = sourceY + sOff.y;
  const tx = targetX + tOff.x;
  const ty = targetY + tOff.y;

  const forkParentIds = data.junctionFork?.parentIds;
  const forkChildIds = data.junctionFork?.childIds;
  const forkSelector = useMemo(
    () => buildForkSelector(forkParentIds, forkChildIds),
    [forkParentIds, forkChildIds],
  );
  const forkPositions = useStore(forkSelector);

  const isForkPrimary = !!data.junctionFork;
  const isForkHidden = !!data.junctionHidden;

  const { edgePath, hitPath } = computeEdgePath({
    isForkPrimary,
    isForkHidden,
    forkPositions,
    sx,
    sy,
    tx,
    ty,
    sourcePosition,
    targetPosition,
    edgeStyle: data.edgeStyle,
  });

  const { stroke, strokeWidth, strokeDasharray } = computeEdgeStroke(
    flags,
    inferredType,
    data.coupleColor,
  );
  const { typeLabel, periodLine } = computeTooltipContent(rel, relType, inferredType, flags, t);

  const markerShape = data.markerShape;

  if (isForkHidden) {
    return <path d="M 0,0" fill="none" stroke="none" />;
  }

  return (
    <>
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
      <path
        d={hitPath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(false)}
      />
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
                transform: `translate(-50%, -100%) translate(${mouseFlowPos.x}px, ${mouseFlowPos.y - 10}px)`,
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
