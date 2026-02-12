import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { RelationshipType } from "../../types/domain";
import type { RelationshipEdgeData } from "../../hooks/useTreeLayout";
import "./RelationshipEdge.css";

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

const PARENT_TYPES = new Set([
  RelationshipType.BiologicalParent,
  RelationshipType.StepParent,
  RelationshipType.AdoptiveParent,
]);

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
  const isExPartner = isPartner
    && rel != null
    && rel.periods.length > 0
    && rel.periods.every((p) => p.end_year != null);
  const isSibling =
    relType === RelationshipType.BiologicalSibling ||
    relType === RelationshipType.StepSibling ||
    relType === RelationshipType.HalfSibling;
  const isHalfSibling = relType === RelationshipType.HalfSibling;
  const isDashed =
    relType === RelationshipType.StepParent ||
    relType === RelationshipType.AdoptiveParent ||
    relType === RelationshipType.StepSibling;

  const pathParams = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };

  const useBezier = isPartner || isSibling || inferredType != null;
  const [edgePath, labelX, labelY] = useBezier
    ? getBezierPath(pathParams)
    : getSmoothStepPath(pathParams);

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

  return (
    <>
      <BaseEdge
        {...rest}
        path={edgePath}
        style={{ stroke, strokeWidth, strokeDasharray }}
        interactionWidth={20}
      />
      {/* Invisible wider hit area for hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && typeLabel && (
        <EdgeLabelRenderer>
          <div
            className="edge-tooltip"
            style={{
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 10}px)`,
            }}
          >
            <span className="edge-tooltip__type">{typeLabel}</span>
            <span className="edge-tooltip__names">
              {data.sourceName ?? "?"} &mdash; {data.targetName ?? "?"}
            </span>
            {periodLine && (
              <span className="edge-tooltip__period">{periodLine}</span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
