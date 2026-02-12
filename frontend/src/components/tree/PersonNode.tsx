import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { getTraumaColor } from "../../lib/traumaColors";
import { getLifeEventColor } from "../../lib/lifeEventColors";
import type { PersonNodeData } from "../../hooks/useTreeLayout";
import "./PersonNode.css";

const MAX_VISIBLE_BADGES = 8;

function PersonNodeComponent({ data, selected }: NodeProps & { data: PersonNodeData }) {
  const { t } = useTranslation();
  const { person, events, lifeEvents } = data;

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
      {(events.length > 0 || lifeEvents.length > 0) && (
        <div className="person-node__badges">
          {events.slice(0, MAX_VISIBLE_BADGES).map((event) => (
            <span
              key={event.id}
              className="person-node__badge"
              style={{ backgroundColor: getTraumaColor(event.category) }}
              title={event.title}
            />
          ))}
          {lifeEvents.slice(0, Math.max(0, MAX_VISIBLE_BADGES - events.length)).map((event) => (
            <span
              key={event.id}
              className="person-node__badge person-node__badge--life"
              style={{ backgroundColor: getLifeEventColor(event.category) }}
              title={event.title}
            />
          ))}
          {events.length + lifeEvents.length > MAX_VISIBLE_BADGES && (
            <span className="person-node__badge-overflow">
              +{events.length + lifeEvents.length - MAX_VISIBLE_BADGES}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
