import { X } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import { formatAge } from "../../lib/age";

interface PersonSummaryCardProps {
  person: DecryptedPerson;
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  classifications: DecryptedClassification[];
  onClose: () => void;
}

export const PersonSummaryCard = React.memo(function PersonSummaryCard({
  person,
  events,
  lifeEvents,
  classifications,
  onClose,
}: PersonSummaryCardProps) {
  const { t } = useTranslation();

  const age = formatAge(
    person.birth_year,
    person.death_year,
    person.birth_month,
    person.birth_day,
    person.death_month,
    person.death_day,
  );

  const yearRange = [
    person.birth_year ? String(person.birth_year) : "?",
    person.death_year != null ? String(person.death_year) : t("timeline.summaryPresent"),
  ].join(" \u2013 ");

  return (
    <div className="tl-summary-card">
      <div className="tl-summary-card__header">
        <span className="tl-summary-card__name">{person.name}</span>
        <button
          type="button"
          className="tl-summary-card__close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X size={14} />
        </button>
      </div>
      <div className="tl-summary-card__years">{yearRange}</div>
      {age && <div className="tl-summary-card__age">{t("person.age", { age })}</div>}
      {(events.length > 0 || lifeEvents.length > 0 || classifications.length > 0) && (
        <div className="tl-summary-card__counts">
          {events.length > 0 && (
            <span className="tl-summary-card__count tl-summary-card__count--trauma">
              {events.length}
            </span>
          )}
          {lifeEvents.length > 0 && (
            <span className="tl-summary-card__count tl-summary-card__count--life">
              {lifeEvents.length}
            </span>
          )}
          {classifications.length > 0 && (
            <span className="tl-summary-card__count tl-summary-card__count--class">
              {classifications.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
