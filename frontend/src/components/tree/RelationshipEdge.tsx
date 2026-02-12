import { memo } from "react";
import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { RelationshipType } from "../../types/domain";
import type { RelationshipEdgeData } from "../../hooks/useTreeLayout";

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
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
  const rel = data.relationship;
  const relType = rel?.type;
  const inferredType = data.inferredType;
  const isPartner = relType === RelationshipType.Partner;
  const isExPartner = isPartner
    && rel != null
    && rel.periods.length > 0
    && rel.periods.every((p) => p.end_year != null);
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

  const [edgePath] = isPartner
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

  return (
    <BaseEdge
      {...rest}
      path={edgePath}
      style={{ stroke, strokeWidth, strokeDasharray }}
    />
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
