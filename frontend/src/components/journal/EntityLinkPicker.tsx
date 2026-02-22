import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import type { JournalLinkedRef } from "../../types/domain";

interface EntityLinkPickerProps {
  persons: Map<string, DecryptedPerson>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  patterns: Map<string, DecryptedPattern>;
  onSelect: (ref: JournalLinkedRef) => void;
  onClose: () => void;
}

interface EntityGroup {
  labelKey: string;
  items: { id: string; label: string; entityType: JournalLinkedRef["entity_type"] }[];
}

function buildGroups(
  t: (key: string) => string,
  persons: Map<string, DecryptedPerson>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  turningPoints: Map<string, DecryptedTurningPoint>,
  classifications: Map<string, DecryptedClassification>,
  patterns: Map<string, DecryptedPattern>,
): EntityGroup[] {
  const groups: EntityGroup[] = [];

  if (persons.size > 0) {
    groups.push({
      labelKey: "journal.entityType.person",
      items: [...persons.values()].map((p) => ({
        id: p.id,
        label: p.name,
        entityType: "person" as const,
      })),
    });
  }

  if (events.size > 0) {
    groups.push({
      labelKey: "journal.entityType.traumaEvent",
      items: [...events.values()].map((e) => ({
        id: e.id,
        label: e.title,
        entityType: "trauma_event" as const,
      })),
    });
  }

  if (lifeEvents.size > 0) {
    groups.push({
      labelKey: "journal.entityType.lifeEvent",
      items: [...lifeEvents.values()].map((le) => ({
        id: le.id,
        label: le.title,
        entityType: "life_event" as const,
      })),
    });
  }

  if (turningPoints.size > 0) {
    groups.push({
      labelKey: "journal.entityType.turningPoint",
      items: [...turningPoints.values()].map((tp) => ({
        id: tp.id,
        label: tp.title,
        entityType: "turning_point" as const,
      })),
    });
  }

  if (classifications.size > 0) {
    groups.push({
      labelKey: "journal.entityType.classification",
      items: [...classifications.values()].map((c) => ({
        id: c.id,
        label: c.dsm_subcategory ? t(`dsm.sub.${c.dsm_subcategory}`) : t(`dsm.${c.dsm_category}`),
        entityType: "classification" as const,
      })),
    });
  }

  if (patterns.size > 0) {
    groups.push({
      labelKey: "journal.entityType.pattern",
      items: [...patterns.values()].map((p) => ({
        id: p.id,
        label: p.name,
        entityType: "pattern" as const,
      })),
    });
  }

  return groups;
}

export function EntityLinkPicker({
  persons,
  events,
  lifeEvents,
  turningPoints,
  classifications,
  patterns,
  onSelect,
  onClose,
}: EntityLinkPickerProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const groups = buildGroups(
    t,
    persons,
    events,
    lifeEvents,
    turningPoints,
    classifications,
    patterns,
  );

  if (groups.length === 0) {
    return (
      <div className="journal-entity-picker" ref={ref} data-testid="entity-link-picker">
        <p className="journal-entity-picker__empty">{t("journal.noEntities")}</p>
      </div>
    );
  }

  return (
    <div className="journal-entity-picker" ref={ref} data-testid="entity-link-picker">
      {groups.map((group) => (
        <div key={group.labelKey} className="journal-entity-picker__group">
          <div className="journal-entity-picker__group-header">{t(group.labelKey)}</div>
          {group.items.map((item) => (
            <button
              key={`${item.entityType}-${item.id}`}
              type="button"
              className="journal-entity-picker__item"
              onClick={() => {
                onSelect({ entity_type: item.entityType, entity_id: item.id });
                onClose();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
