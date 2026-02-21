import { Handle, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { PersonNodeData } from "../../hooks/useTreeLayout";
import { formatAge } from "../../lib/age";
import { getClassificationColor } from "../../lib/classificationColors";
import { getLifeEventColor } from "../../lib/lifeEventColors";
import { getTraumaColor } from "../../lib/traumaColors";
import "./PersonNode.css";

const MAX_VISIBLE_BADGES = 8;

function badgeInitial(label: string): string {
  return label.charAt(0).toUpperCase();
}

function PersonNodeComponent({ data, selected }: NodeProps & { data: PersonNodeData }) {
  const { t } = useTranslation();
  const { person, events, lifeEvents = [], classifications = [], isFriendOnly } = data;
  const showTraumaInitials = events.length > 1;
  const showLifeInitials = lifeEvents.length > 1;
  const showClassInitials = classifications.length > 1;

  const birthStr = person.birth_year != null ? String(person.birth_year) : "?";
  const age = formatAge(
    person.birth_year,
    person.death_year,
    person.birth_month,
    person.birth_day,
    person.death_month,
    person.death_day,
  );
  const agePrefix = person.death_year ? "\u2020\u2009" : "";
  const ageStr = age != null ? ` (${agePrefix}${age})` : "";
  const yearRange = person.death_year
    ? `${birthStr} - ${person.death_year}${ageStr}`
    : `${birthStr} -${ageStr}`;

  const classNames = [
    "person-node",
    selected && "person-node--selected",
    isFriendOnly && "person-node--friend-only",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames}>
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
      {(events.length > 0 || lifeEvents.length > 0 || classifications.length > 0) && (
        <div className="person-node__badges">
          {events.slice(0, MAX_VISIBLE_BADGES).map((event) => (
            <span
              key={event.id}
              className="person-node__badge-wrap"
              data-badge-type="trauma_event"
              data-badge-id={event.id}
            >
              <span
                className={`person-node__badge${showTraumaInitials ? " person-node__badge--with-initial" : ""}`}
                style={{ backgroundColor: getTraumaColor(event.category) }}
              >
                {showTraumaInitials && badgeInitial(t(`trauma.category.${event.category}`))}
              </span>
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
            <span
              key={event.id}
              className="person-node__badge-wrap"
              data-badge-type="life_event"
              data-badge-id={event.id}
            >
              <span
                className={`person-node__badge person-node__badge--life${showLifeInitials ? " person-node__badge--with-initial" : ""}`}
                style={{ backgroundColor: getLifeEventColor(event.category) }}
              >
                {showLifeInitials && badgeInitial(t(`lifeEvent.category.${event.category}`))}
              </span>
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
          {classifications
            .slice(0, Math.max(0, MAX_VISIBLE_BADGES - events.length - lifeEvents.length))
            .map((cls) => (
              <span
                key={cls.id}
                className="person-node__badge-wrap"
                data-badge-type="classification"
                data-badge-id={cls.id}
              >
                <span
                  className={`person-node__badge person-node__badge--classification${showClassInitials ? " person-node__badge--with-initial" : ""}`}
                  style={{ backgroundColor: getClassificationColor(cls.status) }}
                >
                  {showClassInitials && badgeInitial(t(`classification.status.${cls.status}`))}
                </span>
                <span className="person-node__tooltip">
                  <span className="person-node__tooltip-title">
                    <span
                      className="person-node__tooltip-dot person-node__tooltip-dot--classification"
                      style={{ backgroundColor: getClassificationColor(cls.status) }}
                    />
                    {t(`dsm.${cls.dsm_category}`)}
                    {cls.dsm_subcategory && ` - ${t(`dsm.sub.${cls.dsm_subcategory}`)}`}
                  </span>
                  <span className="person-node__tooltip-meta">
                    <span>{t(`classification.status.${cls.status}`)}</span>
                    {cls.diagnosis_year && <span>{cls.diagnosis_year}</span>}
                  </span>
                </span>
              </span>
            ))}
          {events.length + lifeEvents.length + classifications.length > MAX_VISIBLE_BADGES && (
            <span className="person-node__badge-overflow">
              +{events.length + lifeEvents.length + classifications.length - MAX_VISIBLE_BADGES}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
