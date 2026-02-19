import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineFilterActions, TimelineFilterState } from "../../hooks/useTimelineFilters";
import type { DecryptedPattern, DecryptedPerson } from "../../hooks/useTreeData";
import { DSM_CATEGORIES } from "../../lib/dsmCategories";
import { getPatternColor } from "../../lib/patternColors";
import type { FilterGroup, SmartFilterGroups } from "../../lib/smartFilterGroups";
import { LifeEventCategory, TraumaCategory } from "../../types/domain";
import "./TimelineFilterPanel.css";

const TRAUMA_COUNT = Object.values(TraumaCategory).length;
const LIFE_EVENT_COUNT = Object.values(LifeEventCategory).length;
const DSM_KEYS = DSM_CATEGORIES.map((c) => c.key);

function isLayerEmpty(set: Set<unknown> | null): boolean {
  return set !== null && set.size === 0;
}

function isQuickPresetActive(
  filters: TimelineFilterState,
  preset: "trauma" | "lifeEvents" | "classifications",
): boolean {
  if (preset === "trauma") {
    return (
      filters.traumaCategories === null &&
      isLayerEmpty(filters.lifeEventCategories) &&
      isLayerEmpty(filters.classificationCategories)
    );
  }
  if (preset === "lifeEvents") {
    return (
      filters.lifeEventCategories === null &&
      isLayerEmpty(filters.traumaCategories) &&
      isLayerEmpty(filters.classificationCategories)
    );
  }
  return (
    filters.classificationCategories === null &&
    isLayerEmpty(filters.traumaCategories) &&
    isLayerEmpty(filters.lifeEventCategories)
  );
}

function computeBadge(
  set: Set<unknown> | null,
  total: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (set === null) return null;
  return t("timeline.filterBadge", { active: set.size, total });
}

const PILL_BASE = "tl-filter-panel__pill";
const PILL_ACTIVE = `${PILL_BASE} ${PILL_BASE}--active`;

function quickPillClass(active: boolean): string {
  return active ? PILL_ACTIVE : PILL_BASE;
}

function GroupRow({
  label,
  groups: rowGroups,
  pillClass: pillClassFn,
  onToggle,
  t,
}: {
  label: string;
  groups: FilterGroup[];
  pillClass: (g: FilterGroup) => string;
  onToggle: (personIds: Set<string>) => void;
  t: (key: string) => string;
}) {
  if (rowGroups.length === 0) return null;
  return (
    <div className="tl-filter-panel__group-row">
      <span className="tl-filter-panel__group-label">{label}</span>
      <div className="tl-filter-panel__pills">
        {rowGroups.map((g) => (
          <button
            key={g.key}
            type="button"
            className={pillClassFn(g)}
            onClick={() => onToggle(g.personIds)}
          >
            {g.labelKey.startsWith("Gen ") ? g.labelKey : t(g.labelKey)} ({g.personIds.size})
          </button>
        ))}
      </div>
    </div>
  );
}

interface TimelineFilterPanelProps {
  persons: Map<string, DecryptedPerson>;
  filters: TimelineFilterState;
  actions: TimelineFilterActions;
  timeDomain: { minYear: number; maxYear: number };
  patterns?: Map<string, DecryptedPattern>;
  groups?: SmartFilterGroups;
  onClose: () => void;
}

export function TimelineFilterPanel({
  persons,
  filters,
  actions,
  timeDomain,
  patterns,
  groups,
  onClose,
}: TimelineFilterPanelProps) {
  const { t } = useTranslation();

  const [peopleOpen, setPeopleOpen] = useState(true);
  const [peopleListOpen, setPeopleListOpen] = useState(false);
  const [traumaOpen, setTraumaOpen] = useState(false);
  const [lifeEventsOpen, setLifeEventsOpen] = useState(false);
  const [classificationsOpen, setClassificationsOpen] = useState(false);
  const [patternsOpen, setPatternsOpen] = useState(false);
  const [timeRangeOpen, setTimeRangeOpen] = useState(false);

  const allPersonIds = Array.from(persons.keys());
  const allVisible =
    filters.visiblePersonIds === null || filters.visiblePersonIds.size === allPersonIds.length;

  function isPersonVisible(personId: string): boolean {
    return filters.visiblePersonIds === null || filters.visiblePersonIds.has(personId);
  }

  function isTraumaCategoryActive(cat: TraumaCategory): boolean {
    return filters.traumaCategories === null || filters.traumaCategories.has(cat);
  }

  function isLifeEventCategoryActive(cat: LifeEventCategory): boolean {
    return filters.lifeEventCategories === null || filters.lifeEventCategories.has(cat);
  }

  function isClassificationCategoryActive(cat: string): boolean {
    return filters.classificationCategories === null || filters.classificationCategories.has(cat);
  }

  function isClassificationStatusActive(status: string): boolean {
    return (
      filters.classificationStatus === null ||
      filters.classificationStatus.has(status as "suspected" | "diagnosed")
    );
  }

  const localMin = filters.timeRange?.min ?? timeDomain.minYear;
  const localMax = filters.timeRange?.max ?? timeDomain.maxYear;

  function handleMinYearChange(value: string) {
    const num = Number.parseInt(value, 10);
    if (Number.isNaN(num)) {
      actions.setTimeRange(null);
      return;
    }
    actions.setTimeRange({ min: num, max: localMax });
  }

  function handleMaxYearChange(value: string) {
    const num = Number.parseInt(value, 10);
    if (Number.isNaN(num)) {
      actions.setTimeRange(null);
      return;
    }
    actions.setTimeRange({ min: localMin, max: num });
  }

  function pillClass(group: FilterGroup): string {
    const active =
      filters.visiblePersonIds === null ||
      [...group.personIds].every((id) => filters.visiblePersonIds!.has(id));
    return active ? PILL_ACTIVE : PILL_BASE;
  }

  // Quick filter active state
  const isQuickTraumaActive = isQuickPresetActive(filters, "trauma");
  const isQuickLifeEventsActive = isQuickPresetActive(filters, "lifeEvents");
  const isQuickClassificationsActive = isQuickPresetActive(filters, "classifications");

  // Section count badges
  const peopleBadge = computeBadge(filters.visiblePersonIds, persons.size, t);
  const traumaBadge = computeBadge(filters.traumaCategories, TRAUMA_COUNT, t);
  const lifeEventBadge = computeBadge(filters.lifeEventCategories, LIFE_EVENT_COUNT, t);
  const classificationsBadgeActive =
    filters.classificationCategories !== null || filters.classificationStatus !== null;
  const patternsBadge = patterns ? computeBadge(filters.visiblePatterns, patterns.size, t) : null;
  const timeRangeBadge =
    filters.timeRange !== null ? `${filters.timeRange.min} - ${filters.timeRange.max}` : null;

  return (
    <div className="detail-panel tl-filter-panel">
      <div className="detail-panel__header">
        <h2>{t("timeline.filters")}</h2>
        <div className="tl-filter-panel__header-actions">
          {actions.activeFilterCount > 0 && (
            <button type="button" className="tl-filter-panel__reset" onClick={actions.resetAll}>
              {t("timeline.resetFilters")}
            </button>
          )}
          <button
            type="button"
            className={`tl-filter-panel__mode-toggle${filters.filterMode === "hide" ? " tl-filter-panel__mode-toggle--active" : ""}`}
            onClick={() => actions.setFilterMode(filters.filterMode === "dim" ? "hide" : "dim")}
          >
            {filters.filterMode === "dim" ? t("timeline.filterHide") : t("timeline.filterDim")}
          </button>
          <button type="button" className="detail-panel__close" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>

      <div className="detail-panel__content">
        {/* Quick filter pills */}
        <div className="tl-filter-panel__quick-filters">
          <button
            type="button"
            className={quickPillClass(isQuickTraumaActive)}
            onClick={() => actions.applyQuickFilter("trauma")}
          >
            {t("timeline.quickTrauma")}
          </button>
          <button
            type="button"
            className={quickPillClass(isQuickLifeEventsActive)}
            onClick={() => actions.applyQuickFilter("lifeEvents")}
          >
            {t("timeline.quickLifeEvents")}
          </button>
          <button
            type="button"
            className={quickPillClass(isQuickClassificationsActive)}
            onClick={() => actions.applyQuickFilter("classifications")}
          >
            {t("timeline.quickClassifications")}
          </button>
        </div>

        {/* People section */}
        <section className="detail-panel__section">
          <button
            type="button"
            className="detail-panel__section-toggle"
            onClick={() => setPeopleOpen(!peopleOpen)}
          >
            {peopleOpen ? "\u25BC" : "\u25B6"} {t("timeline.filterPeople")}
            {peopleBadge && <span className="tl-filter-panel__badge">{peopleBadge}</span>}
          </button>
          {peopleOpen && (
            <div className="detail-panel__section-body">
              {groups &&
                (groups.demographic.length > 0 ||
                  groups.roles.length > 0 ||
                  groups.generations.length > 0) && (
                  <div className="tl-filter-panel__groups">
                    <GroupRow
                      label={t("timeline.groupDemographic")}
                      groups={groups.demographic}
                      pillClass={pillClass}
                      onToggle={actions.togglePersonGroup}
                      t={t}
                    />
                    <GroupRow
                      label={t("timeline.groupRoles")}
                      groups={groups.roles}
                      pillClass={pillClass}
                      onToggle={actions.togglePersonGroup}
                      t={t}
                    />
                    <GroupRow
                      label={t("timeline.groupGenerations")}
                      groups={groups.generations}
                      pillClass={pillClass}
                      onToggle={actions.togglePersonGroup}
                      t={t}
                    />
                  </div>
                )}
              <button
                type="button"
                className="tl-filter-panel__sub-toggle"
                onClick={() => setPeopleListOpen(!peopleListOpen)}
              >
                {peopleListOpen ? "\u25BC" : "\u25B6"} {t("timeline.individualPersons")}
              </button>
              {peopleListOpen && (
                <>
                  <div className="tl-filter-panel__toggle-all">
                    <button
                      type="button"
                      className="tl-filter-panel__toggle-btn"
                      onClick={() => actions.toggleAllPersons(!allVisible)}
                    >
                      {allVisible ? t("timeline.deselectAll") : t("timeline.selectAll")}
                    </button>
                  </div>
                  {Array.from(persons.entries()).map(([id, person]) => (
                    <label key={id} className="tl-filter-panel__checkbox">
                      <input
                        type="checkbox"
                        checked={isPersonVisible(id)}
                        onChange={() => actions.togglePerson(id)}
                      />
                      <span>{person.name}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        {/* Trauma categories section */}
        <section className="detail-panel__section">
          <button
            type="button"
            className="detail-panel__section-toggle"
            onClick={() => setTraumaOpen(!traumaOpen)}
          >
            {traumaOpen ? "\u25BC" : "\u25B6"} {t("timeline.filterTrauma")}
            {traumaBadge && <span className="tl-filter-panel__badge">{traumaBadge}</span>}
          </button>
          {traumaOpen && (
            <div className="detail-panel__section-body">
              {Object.values(TraumaCategory).map((cat) => (
                <label key={cat} className="tl-filter-panel__checkbox">
                  <input
                    type="checkbox"
                    checked={isTraumaCategoryActive(cat)}
                    onChange={() => actions.toggleTraumaCategory(cat)}
                  />
                  <span
                    className="tl-filter-panel__color-dot"
                    data-category={cat}
                    style={{ background: `var(--color-trauma-${cat})` }}
                  />
                  <span>{t(`trauma.category.${cat}`)}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Life event categories section */}
        <section className="detail-panel__section">
          <button
            type="button"
            className="detail-panel__section-toggle"
            onClick={() => setLifeEventsOpen(!lifeEventsOpen)}
          >
            {lifeEventsOpen ? "\u25BC" : "\u25B6"} {t("timeline.filterLifeEvents")}
            {lifeEventBadge && <span className="tl-filter-panel__badge">{lifeEventBadge}</span>}
          </button>
          {lifeEventsOpen && (
            <div className="detail-panel__section-body">
              {Object.values(LifeEventCategory).map((cat) => (
                <label key={cat} className="tl-filter-panel__checkbox">
                  <input
                    type="checkbox"
                    checked={isLifeEventCategoryActive(cat)}
                    onChange={() => actions.toggleLifeEventCategory(cat)}
                  />
                  <span
                    className="tl-filter-panel__color-dot"
                    data-category={cat}
                    style={{ background: `var(--color-life-${cat})` }}
                  />
                  <span>{t(`lifeEvent.category.${cat}`)}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Classifications section */}
        <section className="detail-panel__section">
          <button
            type="button"
            className="detail-panel__section-toggle"
            onClick={() => setClassificationsOpen(!classificationsOpen)}
          >
            {classificationsOpen ? "\u25BC" : "\u25B6"} {t("timeline.filterClassifications")}
            {classificationsBadgeActive && (
              <span className="tl-filter-panel__badge tl-filter-panel__badge--dot" />
            )}
          </button>
          {classificationsOpen && (
            <div className="detail-panel__section-body">
              <div className="tl-filter-panel__sub-group">
                <span className="tl-filter-panel__sub-label">
                  {t("timeline.filterClassificationStatus")}
                </span>
                <label className="tl-filter-panel__checkbox">
                  <input
                    type="checkbox"
                    checked={isClassificationStatusActive("suspected")}
                    onChange={() => actions.toggleClassificationStatus("suspected")}
                  />
                  <span
                    className="tl-filter-panel__color-dot"
                    style={{ background: "var(--color-classification-suspected)" }}
                  />
                  <span>{t("classification.status.suspected")}</span>
                </label>
                <label className="tl-filter-panel__checkbox">
                  <input
                    type="checkbox"
                    checked={isClassificationStatusActive("diagnosed")}
                    onChange={() => actions.toggleClassificationStatus("diagnosed")}
                  />
                  <span
                    className="tl-filter-panel__color-dot"
                    style={{ background: "var(--color-classification-diagnosed)" }}
                  />
                  <span>{t("classification.status.diagnosed")}</span>
                </label>
              </div>
              {DSM_KEYS.map((catKey) => (
                <label key={catKey} className="tl-filter-panel__checkbox">
                  <input
                    type="checkbox"
                    checked={isClassificationCategoryActive(catKey)}
                    onChange={() => actions.toggleClassificationCategory(catKey)}
                  />
                  <span>{t(`dsm.${catKey}`)}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Patterns section */}
        {patterns && patterns.size > 0 && (
          <section className="detail-panel__section">
            <button
              type="button"
              className="detail-panel__section-toggle"
              onClick={() => setPatternsOpen(!patternsOpen)}
            >
              {patternsOpen ? "\u25BC" : "\u25B6"} {t("timeline.filterPatterns")}
              {patternsBadge && <span className="tl-filter-panel__badge">{patternsBadge}</span>}
            </button>
            {patternsOpen && (
              <div className="detail-panel__section-body">
                {Array.from(patterns.entries()).map(([id, pattern]) => {
                  const isActive =
                    filters.visiblePatterns === null || filters.visiblePatterns.has(id);
                  return (
                    <label key={id} className="tl-filter-panel__checkbox">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => actions.togglePatternFilter(id)}
                      />
                      <span
                        className="tl-filter-panel__color-dot"
                        style={{ background: getPatternColor(pattern.color) }}
                      />
                      <span>{pattern.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Time range section */}
        <section className="detail-panel__section">
          <button
            type="button"
            className="detail-panel__section-toggle"
            onClick={() => setTimeRangeOpen(!timeRangeOpen)}
          >
            {timeRangeOpen ? "\u25BC" : "\u25B6"} {t("timeline.filterTimeRange")}
            {timeRangeBadge && <span className="tl-filter-panel__badge">{timeRangeBadge}</span>}
          </button>
          {timeRangeOpen && (
            <div className="detail-panel__section-body">
              <div className="tl-filter-panel__time-range">
                <label className="tl-filter-panel__time-field">
                  <span>{t("timeline.minYear")}</span>
                  <input
                    type="number"
                    value={localMin}
                    onChange={(e) => handleMinYearChange(e.target.value)}
                    className="detail-panel__input"
                  />
                </label>
                <label className="tl-filter-panel__time-field">
                  <span>{t("timeline.maxYear")}</span>
                  <input
                    type="number"
                    value={localMax}
                    onChange={(e) => handleMaxYearChange(e.target.value)}
                    className="detail-panel__input"
                  />
                </label>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
