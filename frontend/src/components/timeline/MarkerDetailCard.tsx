import { X } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import type { MarkerClickInfo } from "./PersonLane";

interface MarkerDetailCardProps {
  info: MarkerClickInfo;
  persons: Map<string, DecryptedPerson>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  classifications: Map<string, DecryptedClassification>;
  onClose: () => void;
}

export const MarkerDetailCard = React.memo(function MarkerDetailCard({
  info,
  persons,
  events,
  lifeEvents,
  classifications,
  onClose,
}: MarkerDetailCardProps) {
  const { t } = useTranslation();

  const personName = persons.get(info.personId)?.name ?? "";

  if (info.entityType === "trauma_event") {
    const event = events.get(info.entityId);
    if (!event) return null;
    return (
      <div className="tl-summary-card">
        <div className="tl-summary-card__header">
          <span className="tl-summary-card__name">{event.title}</span>
          <button
            type="button"
            className="tl-summary-card__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X size={14} />
          </button>
        </div>
        <div className="tl-summary-card__years">{t(`trauma.category.${event.category}`)}</div>
        <div className="tl-summary-card__detail">{event.approximate_date}</div>
        {event.severity > 0 && (
          <div className="tl-summary-card__detail">
            {t("timeline.severity", { value: event.severity })}
          </div>
        )}
        <div className="tl-summary-card__person">{personName}</div>
      </div>
    );
  }

  if (info.entityType === "life_event") {
    const le = lifeEvents.get(info.entityId);
    if (!le) return null;
    return (
      <div className="tl-summary-card">
        <div className="tl-summary-card__header">
          <span className="tl-summary-card__name">{le.title}</span>
          <button
            type="button"
            className="tl-summary-card__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X size={14} />
          </button>
        </div>
        <div className="tl-summary-card__years">{t(`lifeEvent.category.${le.category}`)}</div>
        <div className="tl-summary-card__detail">{le.approximate_date}</div>
        {le.impact != null && le.impact > 0 && (
          <div className="tl-summary-card__detail">
            {t("timeline.impact", { value: le.impact })}
          </div>
        )}
        <div className="tl-summary-card__person">{personName}</div>
      </div>
    );
  }

  // classification
  const cls = classifications.get(info.entityId);
  if (!cls) return null;
  const catLabel = t(`dsm.${cls.dsm_category}`);
  const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
  const statusLabel = t(`classification.status.${cls.status}`);
  return (
    <div className="tl-summary-card">
      <div className="tl-summary-card__header">
        <span className="tl-summary-card__name">
          {subLabel ? `${catLabel}: ${subLabel}` : catLabel}
        </span>
        <button
          type="button"
          className="tl-summary-card__close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X size={14} />
        </button>
      </div>
      <div className="tl-summary-card__years">{statusLabel}</div>
      {cls.diagnosis_year && (
        <div className="tl-summary-card__detail">{String(cls.diagnosis_year)}</div>
      )}
      <div className="tl-summary-card__person">{personName}</div>
    </div>
  );
});
