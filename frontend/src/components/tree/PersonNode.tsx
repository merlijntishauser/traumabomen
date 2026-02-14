import { Handle, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { PersonNodeData } from "../../hooks/useTreeLayout";
import { getLifeEventColor } from "../../lib/lifeEventColors";
import { getTraumaColor } from "../../lib/traumaColors";
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
      {/* Interactive handles */}
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      {/* Auxiliary handles for reverse edge attachment */}
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className="person-node__handle--aux"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="person-node__handle--aux"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="person-node__handle--aux"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="person-node__handle--aux"
      />

      <div className="person-node__name">{person.name}</div>
      <div className="person-node__years">
        {yearRange}
        {person.is_adopted && (
          <span className="person-node__adopted"> ({t("person.isAdopted").toLowerCase()})</span>
        )}
      </div>
      {(events.length > 0 || lifeEvents.length > 0) && (
        <div className="person-node__badges">
          {events.slice(0, MAX_VISIBLE_BADGES).map((event) => (
            <span key={event.id} className="person-node__badge-wrap">
              <span
                className="person-node__badge"
                style={{ backgroundColor: getTraumaColor(event.category) }}
              />
              <span className="person-node__tooltip">
                <span className="person-node__tooltip-title">
                  <span
                    className="person-node__tooltip-dot"
                    style={{ backgroundColor: getTraumaColor(event.category) }}
                  />
                  {event.title}
                </span>
                {(event.approximate_date || event.severity) && (
                  <span className="person-node__tooltip-meta">
                    {event.approximate_date && <span>{event.approximate_date}</span>}
                    {event.severity && (
                      <span>
                        {t("trauma.severity")}: {event.severity}/10
                      </span>
                    )}
                  </span>
                )}
              </span>
            </span>
          ))}
          {lifeEvents.slice(0, Math.max(0, MAX_VISIBLE_BADGES - events.length)).map((event) => (
            <span key={event.id} className="person-node__badge-wrap">
              <span
                className="person-node__badge person-node__badge--life"
                style={{ backgroundColor: getLifeEventColor(event.category) }}
              />
              <span className="person-node__tooltip">
                <span className="person-node__tooltip-title">
                  <span
                    className="person-node__tooltip-dot person-node__tooltip-dot--life"
                    style={{ backgroundColor: getLifeEventColor(event.category) }}
                  />
                  {event.title}
                </span>
                {(event.approximate_date || event.impact) && (
                  <span className="person-node__tooltip-meta">
                    {event.approximate_date && <span>{event.approximate_date}</span>}
                    {event.impact && (
                      <span>
                        {t("lifeEvent.impact")}: {event.impact}/10
                      </span>
                    )}
                  </span>
                )}
              </span>
            </span>
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
