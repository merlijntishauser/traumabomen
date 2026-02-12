import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { getTraumaColor } from "../../lib/traumaColors";
import type { PersonNodeData } from "../../hooks/useTreeLayout";
import "./PersonNode.css";

function PersonNodeComponent({ data, selected }: NodeProps & { data: PersonNodeData }) {
  const { t } = useTranslation();
  const { person, events } = data;

  const yearRange = person.death_year
    ? `${person.birth_year} - ${person.death_year}`
    : `${person.birth_year} -`;

  return (
    <div className={`person-node ${selected ? "person-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />

      <div className="person-node__name">{person.name}</div>
      <div className="person-node__years">
        {yearRange}
        {person.is_adopted && (
          <span className="person-node__adopted">
            {" "}({t("person.isAdopted").toLowerCase()})
          </span>
        )}
      </div>
      {events.length > 0 && (
        <div className="person-node__badges">
          {events.map((event) => (
            <span
              key={event.id}
              className="person-node__badge"
              style={{ backgroundColor: getTraumaColor(event.category) }}
              title={event.title}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
