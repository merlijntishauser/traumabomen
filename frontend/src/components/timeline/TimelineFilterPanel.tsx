import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineFilterActions, TimelineFilterState } from "../../hooks/useTimelineFilters";
import type { DecryptedPattern, DecryptedPerson } from "../../hooks/useTreeData";
import { DSM_CATEGORIES } from "../../lib/dsmCategories";
import { getPatternColor } from "../../lib/patternColors";
import type { FilterGroup, SmartFilterGroups } from "../../lib/smartFilterGroups";
import { LifeEventCategory, TraumaCategory } from "../../types/domain";
import "./TimelineFilterPanel.css";

const ALL_TRAUMA = Object.values(TraumaCategory);
const ALL_LIFE_EVENTS = Object.values(LifeEventCategory);

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
  onToggle: (groupKey: string, personIds: Set<string>) => void;
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
            onClick={() => onToggle(g.key, g.personIds)}
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
  usedTraumaCategories?: Set<string>;
  usedLifeEventCategories?: Set<string>;
  usedClassifications?: Map<string, Set<string>>;
  onClose: () => void;
}

function isFilterActive<T>(value: T, set: Set<T> | null): boolean {
  return set === null || set.has(value);
}

function parseYearInput(
  value: string,
  setRange: (range: { min: number; max: number } | null) => void,
  buildRange: (num: number) => { min: number; max: number },
): void {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) {
    setRange(null);
    return;
  }
  setRange(buildRange(num));
}

function computeUsedCategories(
  usedTrauma?: Set<string>,
  usedLife?: Set<string>,
  usedCls?: Map<string, Set<string>>,
) {
  const traumaCats = usedTrauma ? ALL_TRAUMA.filter((c) => usedTrauma.has(c)) : ALL_TRAUMA;
  const lifeEventCats = usedLife ? ALL_LIFE_EVENTS.filter((c) => usedLife.has(c)) : ALL_LIFE_EVENTS;
  const classificationCats = usedCls ? DSM_CATEGORIES.filter((c) => usedCls.has(c.key)) : [];
  return { traumaCats, lifeEventCats, classificationCats };
}

function computeModeToggle(filterMode: string, t: (key: string) => string) {
  const isHide = filterMode === "hide";
  return {
    modeToggleClass: isHide
      ? "tl-filter-panel__mode-toggle tl-filter-panel__mode-toggle--active"
      : "tl-filter-panel__mode-toggle",
    modeToggleLabel: t(isHide ? "timeline.filterDim" : "timeline.filterHide"),
    nextMode: (isHide ? "dim" : "hide") as "dim" | "hide",
  };
}

function ClassificationsBody({
  classificationCats,
  usedClassifications,
  filters,
  actions,
  t,
}: {
  classificationCats: typeof DSM_CATEGORIES;
  usedClassifications?: Map<string, Set<string>>;
  filters: TimelineFilterState;
  actions: TimelineFilterActions;
  t: (key: string) => string;
}) {
  return (
    <div className="detail-panel__section-body">
      <div className="tl-filter-panel__sub-group">
        <span className="tl-filter-panel__sub-label">
          {t("timeline.filterClassificationStatus")}
        </span>
        <label className="tl-filter-panel__checkbox">
          <input
            type="checkbox"
            checked={isFilterActive("suspected" as const, filters.classificationStatus)}
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
            checked={isFilterActive("diagnosed" as const, filters.classificationStatus)}
            onChange={() => actions.toggleClassificationStatus("diagnosed")}
          />
          <span
            className="tl-filter-panel__color-dot"
            style={{ background: "var(--color-classification-diagnosed)" }}
          />
          <span>{t("classification.status.diagnosed")}</span>
        </label>
      </div>
      {classificationCats.map((dsmCat) => {
        const usedSubs = usedClassifications?.get(dsmCat.key);
        const subs = dsmCat.subcategories?.filter((s) => usedSubs?.has(s.key)) ?? [];
        return (
          <div key={dsmCat.key}>
            <label className="tl-filter-panel__checkbox">
              <input
                type="checkbox"
                checked={isFilterActive(dsmCat.key, filters.classificationCategories)}
                onChange={() => actions.toggleClassificationCategory(dsmCat.key)}
              />
              <span>{t(`dsm.${dsmCat.key}`)}</span>
            </label>
            {subs.map((sub) => (
              <label
                key={sub.key}
                className="tl-filter-panel__checkbox tl-filter-panel__checkbox--sub"
              >
                <input
                  type="checkbox"
                  checked={isFilterActive(sub.key, filters.classificationSubcategories)}
                  onChange={() => actions.toggleClassificationSubcategory(sub.key)}
                />
                <span>{t(`dsm.sub.${sub.key}`)}</span>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* -- Filter section sub-components ----------------------------------------- */

interface CollapsibleSectionProps {
  title: string;
  badge?: string | null;
  badgeDot?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  badge,
  badgeDot,
  open,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <section className="detail-panel__section">
      <button type="button" className="detail-panel__section-toggle" onClick={onToggle}>
        {open ? "\u25BC" : "\u25B6"} {title}
        {badge && <span className="tl-filter-panel__badge">{badge}</span>}
        {badgeDot && <span className="tl-filter-panel__badge tl-filter-panel__badge--dot" />}
      </button>
      {open && children}
    </section>
  );
}

interface PeopleSectionBodyProps {
  persons: Map<string, DecryptedPerson>;
  filters: TimelineFilterState;
  actions: TimelineFilterActions;
  groups?: SmartFilterGroups;
  pillClass: (g: FilterGroup) => string;
}

function PeopleSectionBody({
  persons,
  filters,
  actions,
  groups,
  pillClass,
}: PeopleSectionBodyProps) {
  const { t } = useTranslation();
  const [peopleListOpen, setPeopleListOpen] = useState(false);

  const allPersonIds = Array.from(persons.keys());
  const allVisible =
    filters.visiblePersonIds === null || filters.visiblePersonIds.size === allPersonIds.length;

  const hasGroups =
    groups !== undefined &&
    (groups.demographic.length > 0 || groups.roles.length > 0 || groups.generations.length > 0);

  return (
    <div className="detail-panel__section-body">
      {hasGroups && (
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
                checked={isFilterActive(id, filters.visiblePersonIds)}
                onChange={() => actions.togglePerson(id)}
              />
              <span>{person.name}</span>
            </label>
          ))}
        </>
      )}
    </div>
  );
}

interface CategoryChecklistBodyProps {
  categories: string[];
  activeSet: Set<string> | null;
  onToggle: (cat: string) => void;
  colorPrefix: string;
  labelPrefix: string;
}

function CategoryChecklistBody({
  categories,
  activeSet,
  onToggle,
  colorPrefix,
  labelPrefix,
}: CategoryChecklistBodyProps) {
  const { t } = useTranslation();
  return (
    <div className="detail-panel__section-body">
      {categories.map((cat) => (
        <label key={cat} className="tl-filter-panel__checkbox">
          <input
            type="checkbox"
            checked={isFilterActive(cat, activeSet)}
            onChange={() => onToggle(cat)}
          />
          <span
            className="tl-filter-panel__color-dot"
            data-category={cat}
            style={{ background: `var(--color-${colorPrefix}-${cat})` }}
          />
          <span>{t(`${labelPrefix}.${cat}`)}</span>
        </label>
      ))}
    </div>
  );
}

interface PatternsSectionBodyProps {
  patterns: Map<string, DecryptedPattern>;
  visiblePatterns: Set<string> | null;
  onToggle: (id: string) => void;
}

function PatternsSectionBody({ patterns, visiblePatterns, onToggle }: PatternsSectionBodyProps) {
  return (
    <div className="detail-panel__section-body">
      {Array.from(patterns.entries()).map(([id, pattern]) => {
        const isActive = visiblePatterns === null || visiblePatterns.has(id);
        return (
          <label key={id} className="tl-filter-panel__checkbox">
            <input type="checkbox" checked={isActive} onChange={() => onToggle(id)} />
            <span
              className="tl-filter-panel__color-dot"
              style={{ background: getPatternColor(pattern.color) }}
            />
            <span>{pattern.name}</span>
          </label>
        );
      })}
    </div>
  );
}

interface TimeRangeSectionBodyProps {
  localMin: number;
  localMax: number;
  setTimeRange: (range: { min: number; max: number } | null) => void;
}

function TimeRangeSectionBody({ localMin, localMax, setTimeRange }: TimeRangeSectionBodyProps) {
  const { t } = useTranslation();
  return (
    <div className="detail-panel__section-body">
      <p className="tl-filter-panel__hint">{t("timeline.timeRangeHint")}</p>
      <div className="tl-filter-panel__time-range">
        <label className="tl-filter-panel__time-field">
          <span>{t("timeline.minYear")}</span>
          <input
            type="number"
            value={localMin}
            onChange={(e) =>
              parseYearInput(e.target.value, setTimeRange, (num) => ({
                min: num,
                max: localMax,
              }))
            }
            className="detail-panel__input"
          />
        </label>
        <label className="tl-filter-panel__time-field">
          <span>{t("timeline.maxYear")}</span>
          <input
            type="number"
            value={localMax}
            onChange={(e) =>
              parseYearInput(e.target.value, setTimeRange, (num) => ({
                min: localMin,
                max: num,
              }))
            }
            className="detail-panel__input"
          />
        </label>
      </div>
    </div>
  );
}

/* -- Main component -------------------------------------------------------- */

export function TimelineFilterPanel({
  persons,
  filters,
  actions,
  timeDomain,
  patterns,
  groups,
  usedTraumaCategories,
  usedLifeEventCategories,
  usedClassifications,
  onClose,
}: TimelineFilterPanelProps) {
  const { t } = useTranslation();

  const [openSections, setOpenSections] = useState({
    people: true,
    trauma: false,
    lifeEvents: false,
    classifications: false,
    patterns: false,
    timeRange: false,
  });
  const toggleSection = (section: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));

  const localMin = filters.timeRange?.min ?? timeDomain.minYear;
  const localMax = filters.timeRange?.max ?? timeDomain.maxYear;

  function pillClass(group: FilterGroup): string {
    const active = filters.activeGroupKeys.size === 0 || filters.activeGroupKeys.has(group.key);
    return active ? PILL_ACTIVE : PILL_BASE;
  }

  const isQuickTraumaActive = isQuickPresetActive(filters, "trauma");
  const isQuickLifeEventsActive = isQuickPresetActive(filters, "lifeEvents");
  const isQuickClassificationsActive = isQuickPresetActive(filters, "classifications");

  const { traumaCats, lifeEventCats, classificationCats } = computeUsedCategories(
    usedTraumaCategories,
    usedLifeEventCategories,
    usedClassifications,
  );

  const peopleBadge = computeBadge(filters.visiblePersonIds, persons.size, t);
  const traumaBadge = computeBadge(filters.traumaCategories, traumaCats.length, t);
  const lifeEventBadge = computeBadge(filters.lifeEventCategories, lifeEventCats.length, t);
  const classificationsBadgeActive =
    filters.classificationCategories !== null || filters.classificationStatus !== null;
  const patternsBadge = patterns ? computeBadge(filters.visiblePatterns, patterns.size, t) : null;
  const timeRangeBadge =
    filters.timeRange !== null ? `${filters.timeRange.min} - ${filters.timeRange.max}` : null;

  const { modeToggleClass, modeToggleLabel, nextMode } = computeModeToggle(filters.filterMode, t);

  return (
    <div className="panel-overlay detail-panel tl-filter-panel">
      <div className="panel-header">
        <h2>{t("timeline.filters")}</h2>
        <div className="tl-filter-panel__header-actions">
          {actions.activeFilterCount > 0 && (
            <button type="button" className="tl-filter-panel__reset" onClick={actions.resetAll}>
              {t("timeline.resetFilters")}
            </button>
          )}
          <button
            type="button"
            className={modeToggleClass}
            onClick={() => actions.setFilterMode(nextMode)}
          >
            {modeToggleLabel}
          </button>
          <button type="button" className="panel-close" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>

      <div className="detail-panel__content">
        <div className="tl-filter-panel__quick-filters">
          <span className="tl-filter-panel__quick-label">{t("timeline.quickFilterLabel")}</span>
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

        <CollapsibleSection
          title={t("timeline.filterPeople")}
          badge={peopleBadge}
          open={openSections.people}
          onToggle={() => toggleSection("people")}
        >
          <PeopleSectionBody
            persons={persons}
            filters={filters}
            actions={actions}
            groups={groups}
            pillClass={pillClass}
          />
        </CollapsibleSection>

        {traumaCats.length > 0 && (
          <CollapsibleSection
            title={t("timeline.filterTrauma")}
            badge={traumaBadge}
            open={openSections.trauma}
            onToggle={() => toggleSection("trauma")}
          >
            <CategoryChecklistBody
              categories={traumaCats}
              activeSet={filters.traumaCategories}
              onToggle={actions.toggleTraumaCategory as (cat: string) => void}
              colorPrefix="trauma"
              labelPrefix="trauma.category"
            />
          </CollapsibleSection>
        )}

        {lifeEventCats.length > 0 && (
          <CollapsibleSection
            title={t("timeline.filterLifeEvents")}
            badge={lifeEventBadge}
            open={openSections.lifeEvents}
            onToggle={() => toggleSection("lifeEvents")}
          >
            <CategoryChecklistBody
              categories={lifeEventCats}
              activeSet={filters.lifeEventCategories}
              onToggle={actions.toggleLifeEventCategory as (cat: string) => void}
              colorPrefix="life"
              labelPrefix="lifeEvent.category"
            />
          </CollapsibleSection>
        )}

        {classificationCats.length > 0 && (
          <CollapsibleSection
            title={t("timeline.filterClassifications")}
            badgeDot={classificationsBadgeActive}
            open={openSections.classifications}
            onToggle={() => toggleSection("classifications")}
          >
            <ClassificationsBody
              classificationCats={classificationCats}
              usedClassifications={usedClassifications}
              filters={filters}
              actions={actions}
              t={t}
            />
          </CollapsibleSection>
        )}

        {patterns && patterns.size > 0 && (
          <CollapsibleSection
            title={t("timeline.filterPatterns")}
            badge={patternsBadge}
            open={openSections.patterns}
            onToggle={() => toggleSection("patterns")}
          >
            <PatternsSectionBody
              patterns={patterns}
              visiblePatterns={filters.visiblePatterns}
              onToggle={actions.togglePatternFilter}
            />
          </CollapsibleSection>
        )}

        <CollapsibleSection
          title={t("timeline.filterTimeRange")}
          badge={timeRangeBadge}
          open={openSections.timeRange}
          onToggle={() => toggleSection("timeRange")}
        >
          <TimeRangeSectionBody
            localMin={localMin}
            localMax={localMax}
            setTimeRange={actions.setTimeRange}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}
