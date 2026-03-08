import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import type { DecryptedSiblingGroup } from "../../hooks/useTreeData";
import "./SiblingGroupNode.css";

export interface SiblingGroupNodeData extends Record<string, unknown> {
  group: DecryptedSiblingGroup;
}

const MAX_NAMED_DISPLAY = 4;

export default function SiblingGroupNode({
  data,
  selected,
}: NodeProps & { data: SiblingGroupNodeData }) {
  const { t } = useTranslation();
  const { group } = data;
  const siblingCount = Math.max(0, group.person_ids.length - 1) + group.members.length;
  const namedMembers = group.members.filter((m) => m.name.trim() !== "");

  return (
    <div className={`sibling-group-node${selected ? " sibling-group-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="sibling-group-node__handle" />
      {namedMembers.length > 0 && namedMembers.length <= MAX_NAMED_DISPLAY ? (
        <div className="sibling-group-node__names">
          {namedMembers.map((m, i) => (
            <span key={i} className="sibling-group-node__name">
              {m.name}
            </span>
          ))}
        </div>
      ) : (
        <span className="sibling-group-node__label">
          {t("siblingGroup.label", { count: siblingCount })}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="sibling-group-node__handle" />
    </div>
  );
}
