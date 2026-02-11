import { memo } from "react";
import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { RelationshipType } from "../../types/domain";
import type { RelationshipEdgeData } from "../../hooks/useTreeLayout";

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
  const relType = data.relationship.type;
  const isPartner = relType === RelationshipType.Partner;
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

  let stroke = "#374151";
  let strokeWidth = 1.5;
  let strokeDasharray: string | undefined;

  if (isPartner) {
    stroke = "#ec4899";
    strokeWidth = 2.5;
  } else if (isDashed) {
    stroke = "#9ca3af";
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
