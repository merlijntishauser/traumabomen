import { useTranslation } from "react-i18next";
import type { TimelineFilterActions, TimelineFilterState } from "../../hooks/useTimelineFilters";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import type { ClassificationStatus, LifeEventCategory, TraumaCategory } from "../../types/domain";
import "./TimelineChipBar.css";

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

function buildPersonChips(
  visiblePersonIds: Set<string> | null,
  persons: Map<string, DecryptedPerson>,
  actions: TimelineFilterActions,
  t: (key: string) => string,
): Chip[] {
  if (visiblePersonIds === null) return [];

  const visibleCount = visiblePersonIds.size;
  const totalCount = persons.size;

  if (visibleCount === 0) {
    return [
      {
        key: "persons-none",
        label: `${t("timeline.filterPeople")}: 0/${totalCount}`,
        onRemove: () => actions.toggleAllPersons(true),
      },
    ];
  }

  const hiddenEntries = Array.from(persons.entries()).filter(([id]) => !visiblePersonIds.has(id));

  if (hiddenEntries.length <= 2) {
    return hiddenEntries.map(([id, p]) => ({
      key: `person-${id}`,
      label: p.name,
      onRemove: () => actions.togglePerson(id),
    }));
  }

  return [
    {
      key: "persons",
      label: `${t("timeline.filterPeople")}: ${visibleCount}/${totalCount}`,
      onRemove: () => actions.toggleAllPersons(true),
    },
  ];
}

function buildSetChips<T extends string>(
  filterSet: Set<T> | null,
  keyPrefix: string,
  labelFn: (item: T) => string,
  removeFn: (item: T) => void,
): Chip[] {
  if (filterSet === null) return [];
  return Array.from(filterSet).map((item) => ({
    key: `${keyPrefix}-${item}`,
    label: labelFn(item),
    onRemove: () => removeFn(item),
  }));
}

interface TimelineChipBarProps {
  filters: TimelineFilterState;
  actions: TimelineFilterActions;
  persons: Map<string, DecryptedPerson>;
}

export function TimelineChipBar({ filters, actions, persons }: TimelineChipBarProps) {
  const { t } = useTranslation();

  const chips: Chip[] = [
    ...buildPersonChips(filters.visiblePersonIds, persons, actions, t),
    ...buildSetChips(
      filters.traumaCategories,
      "trauma",
      (cat) => t(`trauma.category.${cat}`),
      (cat) => actions.toggleTraumaCategory(cat as TraumaCategory),
    ),
    ...buildSetChips(
      filters.lifeEventCategories,
      "life",
      (cat) => t(`lifeEvent.category.${cat}`),
      (cat) => actions.toggleLifeEventCategory(cat as LifeEventCategory),
    ),
    ...buildSetChips(
      filters.classificationCategories,
      "cls-cat",
      (cat) => t(`dsm.${cat}`),
      (cat) => actions.toggleClassificationCategory(cat),
    ),
    ...buildSetChips(
      filters.classificationStatus,
      "cls-status",
      (status) => t(`classification.status.${status}`),
      (status) => actions.toggleClassificationStatus(status as ClassificationStatus),
    ),
    ...(filters.timeRange
      ? [
          {
            key: "time-range",
            label: `${filters.timeRange.min} - ${filters.timeRange.max}`,
            onRemove: () => actions.setTimeRange(null),
          },
        ]
      : []),
  ];

  if (chips.length === 0) return null;

  return (
    <div className="tl-chip-bar">
      {chips.map((chip) => (
        <span key={chip.key} className="tl-chip">
          <span className="tl-chip__label">{chip.label}</span>
          <button
            type="button"
            className="tl-chip__remove"
            onClick={chip.onRemove}
            aria-label={`Remove ${chip.label}`}
          >
            &times;
          </button>
        </span>
      ))}
    </div>
  );
}
