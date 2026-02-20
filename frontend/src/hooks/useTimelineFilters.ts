import { useCallback, useMemo, useState } from "react";
import { type ClassificationStatus, LifeEventCategory, TraumaCategory } from "../types/domain";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
} from "./useTreeData";

const ALL_TRAUMA_CATS = new Set(Object.values(TraumaCategory));
const ALL_LIFE_EVENT_CATS = new Set(Object.values(LifeEventCategory));
const ALL_CLASSIFICATION_STATUSES = new Set<ClassificationStatus>(["suspected", "diagnosed"]);

/** Toggle an item in a filter set. When null (all visible), unchecks the item. */
function toggleInSet<T>(prev: Set<T> | null, item: T, allValues: Set<T>): Set<T> | null {
  if (prev === null) {
    // All currently visible; uncheck this one item
    const next = new Set(allValues);
    next.delete(item);
    return next;
  }
  const next = new Set(prev);
  if (next.has(item)) {
    next.delete(item);
  } else {
    next.add(item);
  }
  // If all values restored, reset to null (unfiltered)
  if (next.size >= allValues.size) return null;
  return next.size === 0 ? new Set<T>() : next;
}

/** Toggle an item in a dynamically-derived filter set (e.g. classification categories). */
function toggleInDynamicSet(
  prev: Set<string> | null,
  item: string,
  allUsedValues: Set<string>,
): Set<string> | null {
  return toggleInSet(prev ?? allUsedValues, item, allUsedValues) ?? null;
}

export type FilterMode = "dim" | "hide";

export type QuickFilterPreset = "trauma" | "lifeEvents" | "classifications";

export interface TimelineFilterState {
  visiblePersonIds: Set<string> | null;
  activeGroupKeys: Set<string>;
  traumaCategories: Set<TraumaCategory> | null;
  lifeEventCategories: Set<LifeEventCategory> | null;
  classificationCategories: Set<string> | null;
  classificationSubcategories: Set<string> | null;
  classificationStatus: Set<ClassificationStatus> | null;
  timeRange: { min: number; max: number } | null;
  visiblePatterns: Set<string> | null;
  filterMode: FilterMode;
}

export interface TimelineFilterActions {
  togglePerson: (personId: string) => void;
  toggleAllPersons: (visible: boolean) => void;
  togglePersonGroup: (groupKey: string, personIds: Set<string>) => void;
  toggleTraumaCategory: (cat: TraumaCategory) => void;
  toggleLifeEventCategory: (cat: LifeEventCategory) => void;
  toggleClassificationCategory: (cat: string) => void;
  toggleClassificationSubcategory: (subcat: string) => void;
  toggleClassificationStatus: (status: ClassificationStatus) => void;
  setTimeRange: (range: { min: number; max: number } | null) => void;
  togglePatternFilter: (patternId: string) => void;
  setFilterMode: (mode: FilterMode) => void;
  applyQuickFilter: (preset: QuickFilterPreset) => void;
  resetAll: () => void;
  activeFilterCount: number;
}

export interface DimSets {
  dimmedPersonIds: Set<string>;
  dimmedEventIds: Set<string>;
  dimmedLifeEventIds: Set<string>;
  dimmedClassificationIds: Set<string>;
}

const EMPTY_SET = new Set<string>();

function isPersonDimmed(personIds: string[], visiblePersonIds: Set<string> | null): boolean {
  return visiblePersonIds !== null && personIds.every((pid) => !visiblePersonIds.has(pid));
}

function isOutsideTimeRange(
  dateStr: string,
  timeRange: { min: number; max: number } | null,
): boolean {
  if (timeRange === null) return false;
  const year = Number.parseInt(dateStr, 10);
  return !Number.isNaN(year) && (year < timeRange.min || year > timeRange.max);
}

function isCategoryFiltered<T>(category: T, allowedSet: Set<T> | null): boolean {
  return allowedSet !== null && !allowedSet.has(category);
}

function computeDimmedPersons(
  personIds: Iterable<string>,
  visiblePersonIds: Set<string> | null,
): Set<string> {
  const result = new Set<string>();
  if (visiblePersonIds === null) return result;
  for (const pid of personIds) {
    if (!visiblePersonIds.has(pid)) result.add(pid);
  }
  return result;
}

function computeDimmedEvents(
  events: Map<string, DecryptedEvent>,
  visiblePersonIds: Set<string> | null,
  traumaCategories: Set<TraumaCategory> | null,
  timeRange: { min: number; max: number } | null,
): Set<string> {
  const result = new Set<string>();
  for (const [id, event] of events) {
    if (
      isPersonDimmed(event.person_ids, visiblePersonIds) ||
      isCategoryFiltered(event.category, traumaCategories) ||
      isOutsideTimeRange(event.approximate_date, timeRange)
    ) {
      result.add(id);
    }
  }
  return result;
}

function computeDimmedLifeEvents(
  lifeEvents: Map<string, DecryptedLifeEvent>,
  visiblePersonIds: Set<string> | null,
  lifeEventCategories: Set<LifeEventCategory> | null,
  timeRange: { min: number; max: number } | null,
): Set<string> {
  const result = new Set<string>();
  for (const [id, le] of lifeEvents) {
    if (
      isPersonDimmed(le.person_ids, visiblePersonIds) ||
      isCategoryFiltered(le.category, lifeEventCategories) ||
      isOutsideTimeRange(le.approximate_date, timeRange)
    ) {
      result.add(id);
    }
  }
  return result;
}

function isSubcategoryFiltered(
  subcategory: string | null,
  allowedSubcategories: Set<string> | null,
): boolean {
  if (allowedSubcategories === null || subcategory === null) return false;
  return !allowedSubcategories.has(subcategory);
}

function computeDimmedClassifications(
  classifications: Map<string, DecryptedClassification>,
  visiblePersonIds: Set<string> | null,
  classificationCategories: Set<string> | null,
  classificationSubcategories: Set<string> | null,
  classificationStatus: Set<ClassificationStatus> | null,
): Set<string> {
  const result = new Set<string>();
  for (const [id, cls] of classifications) {
    if (
      isPersonDimmed(cls.person_ids, visiblePersonIds) ||
      isCategoryFiltered(cls.dsm_category, classificationCategories) ||
      isSubcategoryFiltered(cls.dsm_subcategory, classificationSubcategories) ||
      isCategoryFiltered(cls.status, classificationStatus)
    ) {
      result.add(id);
    }
  }
  return result;
}

const EMPTY_DIMS: DimSets = {
  dimmedPersonIds: EMPTY_SET,
  dimmedEventIds: EMPTY_SET,
  dimmedLifeEventIds: EMPTY_SET,
  dimmedClassificationIds: EMPTY_SET,
};

function computePatternEntityIds(
  visiblePatterns: Set<string> | null,
  patterns?: Map<string, DecryptedPattern>,
): { eventIds: Set<string>; lifeEventIds: Set<string>; classificationIds: Set<string> } | null {
  if (visiblePatterns === null || !patterns) return null;

  const eventIds = new Set<string>();
  const lifeEventIds = new Set<string>();
  const classificationIds = new Set<string>();

  for (const patternId of visiblePatterns) {
    const pattern = patterns.get(patternId);
    if (!pattern) continue;
    for (const le of pattern.linked_entities) {
      if (le.entity_type === "trauma_event") eventIds.add(le.entity_id);
      else if (le.entity_type === "life_event") lifeEventIds.add(le.entity_id);
      else if (le.entity_type === "classification") classificationIds.add(le.entity_id);
    }
  }

  return { eventIds, lifeEventIds, classificationIds };
}

function applyPatternDimming(
  visiblePatterns: Set<string> | null,
  patterns: Map<string, DecryptedPattern> | undefined,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
  dimmedEventIds: Set<string>,
  dimmedLifeEventIds: Set<string>,
  dimmedClassificationIds: Set<string>,
): void {
  const patternEntities = computePatternEntityIds(visiblePatterns, patterns);
  if (!patternEntities) return;

  for (const [id] of events) {
    if (!patternEntities.eventIds.has(id)) dimmedEventIds.add(id);
  }
  for (const [id] of lifeEvents) {
    if (!patternEntities.lifeEventIds.has(id)) dimmedLifeEventIds.add(id);
  }
  for (const [id] of classifications) {
    if (!patternEntities.classificationIds.has(id)) dimmedClassificationIds.add(id);
  }
}

function isAllEmpty(...sets: Set<string>[]): boolean {
  return sets.every((s) => s.size === 0);
}

export function computeDimSets(
  filters: TimelineFilterState,
  persons: Map<string, DecryptedPerson>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
  patterns?: Map<string, DecryptedPattern>,
): DimSets {
  const {
    visiblePersonIds,
    traumaCategories,
    lifeEventCategories,
    classificationCategories,
    classificationSubcategories,
    classificationStatus,
    timeRange,
    visiblePatterns,
  } = filters;

  const dimmedPersonIds = computeDimmedPersons(persons.keys(), visiblePersonIds);
  const dimmedEventIds = computeDimmedEvents(events, visiblePersonIds, traumaCategories, timeRange);
  const dimmedLifeEventIds = computeDimmedLifeEvents(
    lifeEvents,
    visiblePersonIds,
    lifeEventCategories,
    timeRange,
  );
  const dimmedClassificationIds = computeDimmedClassifications(
    classifications,
    visiblePersonIds,
    classificationCategories,
    classificationSubcategories,
    classificationStatus,
  );

  applyPatternDimming(
    visiblePatterns,
    patterns,
    events,
    lifeEvents,
    classifications,
    dimmedEventIds,
    dimmedLifeEventIds,
    dimmedClassificationIds,
  );

  if (isAllEmpty(dimmedPersonIds, dimmedEventIds, dimmedLifeEventIds, dimmedClassificationIds)) {
    return EMPTY_DIMS;
  }

  return { dimmedPersonIds, dimmedEventIds, dimmedLifeEventIds, dimmedClassificationIds };
}

/** Extract category from a group key, e.g. "gender:female" -> "gender" */
function groupCategory(groupKey: string): string {
  const idx = groupKey.indexOf(":");
  return idx === -1 ? groupKey : groupKey.slice(0, idx);
}

/** Merge personIds into the union set for a category. */
function mergeIntoCategory(
  unions: Map<string, Set<string>>,
  cat: string,
  personIds: Set<string>,
): void {
  const existing = unions.get(cat);
  if (existing) {
    for (const id of personIds) existing.add(id);
  } else {
    unions.set(cat, new Set(personIds));
  }
}

/** Intersect two sets, returning only elements present in both. */
function intersectSets(a: Set<string>, b: Set<string>): Set<string> {
  return new Set(Array.from(a).filter((id) => b.has(id)));
}

/** Derive visiblePersonIds by intersecting per-category union sets. */
function deriveVisibleFromGroups(activeGroupData: Map<string, Set<string>>): Set<string> | null {
  if (activeGroupData.size === 0) return null;

  const categoryUnions = new Map<string, Set<string>>();
  for (const [groupKey, personIds] of activeGroupData) {
    mergeIntoCategory(categoryUnions, groupCategory(groupKey), personIds);
  }

  return Array.from(categoryUnions.values()).reduce<Set<string> | null>(
    (result, ids) => (result === null ? new Set(ids) : intersectSets(result, ids)),
    null,
  );
}

/** Check if a quick filter preset is currently active (its layer unfiltered, others fully off). */
function isQuickFilterActive(
  preset: QuickFilterPreset,
  traumaCats: Set<TraumaCategory> | null,
  lifeEventCats: Set<LifeEventCategory> | null,
  classificationCats: Set<string> | null,
): boolean {
  const layers: Record<QuickFilterPreset, Set<unknown> | null> = {
    trauma: traumaCats,
    lifeEvents: lifeEventCats,
    classifications: classificationCats,
  };
  if (layers[preset] !== null) return false;
  return Object.entries(layers).every(([k, v]) => k === preset || (v !== null && v.size === 0));
}

const EMPTY_GROUP_KEYS = new Set<string>();

export function useTimelineFilters(
  persons: Map<string, DecryptedPerson>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
  patterns?: Map<string, DecryptedPattern>,
): { filters: TimelineFilterState; actions: TimelineFilterActions; dims: DimSets } {
  // Group-based filtering: groupKey -> personIds for each active group
  const [activeGroupData, setActiveGroupData] = useState<Map<string, Set<string>>>(new Map());
  // Individual person overrides (set when user manually toggles individual checkboxes)
  const [customPersonIds, setCustomPersonIds] = useState<Set<string> | null>(null);

  const [traumaCategories, setTraumaCategories] = useState<Set<TraumaCategory> | null>(null);
  const [lifeEventCategories, setLifeEventCategories] = useState<Set<LifeEventCategory> | null>(
    null,
  );
  const [classificationCategories, setClassificationCategories] = useState<Set<string> | null>(
    null,
  );
  const [classificationSubcategories, setClassificationSubcategories] =
    useState<Set<string> | null>(null);
  const [classificationStatus, setClassificationStatus] =
    useState<Set<ClassificationStatus> | null>(null);
  const [timeRange, setTimeRange] = useState<{ min: number; max: number } | null>(null);
  const [visiblePatterns, setVisiblePatterns] = useState<Set<string> | null>(null);
  const [filterMode, setFilterModeState] = useState<FilterMode>("dim");

  // Derive visiblePersonIds: customPersonIds takes precedence, otherwise derive from groups
  const visiblePersonIds = useMemo(() => {
    if (customPersonIds !== null) return customPersonIds;
    return deriveVisibleFromGroups(activeGroupData);
  }, [activeGroupData, customPersonIds]);

  const activeGroupKeys = useMemo(() => {
    if (activeGroupData.size === 0) return EMPTY_GROUP_KEYS;
    return new Set(activeGroupData.keys());
  }, [activeGroupData]);

  const filters: TimelineFilterState = useMemo(
    () => ({
      visiblePersonIds,
      activeGroupKeys,
      traumaCategories,
      lifeEventCategories,
      classificationCategories,
      classificationSubcategories,
      classificationStatus,
      timeRange,
      visiblePatterns,
      filterMode,
    }),
    [
      visiblePersonIds,
      activeGroupKeys,
      traumaCategories,
      lifeEventCategories,
      classificationCategories,
      classificationSubcategories,
      classificationStatus,
      timeRange,
      visiblePatterns,
      filterMode,
    ],
  );

  const allPersonIds = useMemo(() => new Set(persons.keys()), [persons]);

  const togglePersonFn = useCallback(
    (personId: string) => {
      setCustomPersonIds((prev) => {
        const current = prev ?? deriveVisibleFromGroups(activeGroupData);
        return toggleInDynamicSet(current, personId, allPersonIds);
      });
      setActiveGroupData(new Map());
    },
    [allPersonIds, activeGroupData],
  );

  const toggleAllPersons = useCallback((visible: boolean) => {
    setActiveGroupData(new Map());
    setCustomPersonIds(visible ? null : new Set());
  }, []);

  const togglePersonGroupFn = useCallback((groupKey: string, groupPersonIds: Set<string>) => {
    // Clear any custom overrides when using group toggles
    setCustomPersonIds(null);
    setActiveGroupData((prev) => {
      const next = new Map(prev);
      if (next.has(groupKey)) {
        // Toggle off: remove this group
        next.delete(groupKey);
      } else {
        // Toggle on: add this group
        next.set(groupKey, groupPersonIds);
      }
      return next;
    });
  }, []);

  const toggleTraumaCategory = useCallback((cat: TraumaCategory) => {
    setTraumaCategories((prev) => toggleInSet(prev, cat, ALL_TRAUMA_CATS));
  }, []);

  const toggleLifeEventCategory = useCallback((cat: LifeEventCategory) => {
    setLifeEventCategories((prev) => toggleInSet(prev, cat, ALL_LIFE_EVENT_CATS));
  }, []);

  const allUsedCategories = useMemo(
    () => new Set(Array.from(classifications.values(), (cls) => cls.dsm_category)),
    [classifications],
  );

  const allUsedSubcategories = useMemo(
    () =>
      new Set(
        Array.from(classifications.values())
          .map((cls) => cls.dsm_subcategory)
          .filter((s): s is string => s !== null),
      ),
    [classifications],
  );

  const toggleClassificationCategory = useCallback(
    (cat: string) => {
      setClassificationCategories((prev) => toggleInDynamicSet(prev, cat, allUsedCategories));
    },
    [allUsedCategories],
  );

  const toggleClassificationSubcategory = useCallback(
    (subcat: string) => {
      setClassificationSubcategories((prev) =>
        toggleInDynamicSet(prev, subcat, allUsedSubcategories),
      );
    },
    [allUsedSubcategories],
  );

  const toggleClassificationStatusFn = useCallback((status: ClassificationStatus) => {
    setClassificationStatus((prev) => toggleInSet(prev, status, ALL_CLASSIFICATION_STATUSES));
  }, []);

  const setTimeRangeFn = useCallback((range: { min: number; max: number } | null) => {
    setTimeRange(range);
  }, []);

  const allPatternIds = useMemo(
    () => (patterns ? new Set(patterns.keys()) : new Set<string>()),
    [patterns],
  );

  const togglePatternFilterFn = useCallback(
    (patternId: string) => {
      setVisiblePatterns((prev) => toggleInDynamicSet(prev, patternId, allPatternIds));
    },
    [allPatternIds],
  );

  const setFilterMode = useCallback((mode: FilterMode) => {
    setFilterModeState(mode);
  }, []);

  const applyQuickFilter = useCallback(
    (preset: QuickFilterPreset) => {
      const alreadyActive = isQuickFilterActive(
        preset,
        traumaCategories,
        lifeEventCategories,
        classificationCategories,
      );
      setTraumaCategories(alreadyActive || preset === "trauma" ? null : new Set());
      setLifeEventCategories(alreadyActive || preset === "lifeEvents" ? null : new Set());
      setClassificationCategories(alreadyActive || preset === "classifications" ? null : new Set());
      setClassificationSubcategories(null);
      setClassificationStatus(null);
    },
    [traumaCategories, lifeEventCategories, classificationCategories],
  );

  const resetAll = useCallback(() => {
    setActiveGroupData(new Map());
    setCustomPersonIds(null);
    setTraumaCategories(null);
    setLifeEventCategories(null);
    setClassificationCategories(null);
    setClassificationSubcategories(null);
    setClassificationStatus(null);
    setTimeRange(null);
    setVisiblePatterns(null);
    setFilterModeState("dim");
  }, []);

  const activeFilterCount = useMemo(
    () =>
      [
        visiblePersonIds,
        traumaCategories,
        lifeEventCategories,
        classificationCategories,
        classificationSubcategories,
        classificationStatus,
        timeRange,
        visiblePatterns,
      ].filter((v) => v !== null).length,
    [
      visiblePersonIds,
      traumaCategories,
      lifeEventCategories,
      classificationCategories,
      classificationSubcategories,
      classificationStatus,
      timeRange,
      visiblePatterns,
    ],
  );

  const dims = useMemo(
    () => computeDimSets(filters, persons, events, lifeEvents, classifications, patterns),
    [filters, persons, events, lifeEvents, classifications, patterns],
  );

  const actions: TimelineFilterActions = useMemo(
    () => ({
      togglePerson: togglePersonFn,
      toggleAllPersons,
      togglePersonGroup: togglePersonGroupFn,
      toggleTraumaCategory,
      toggleLifeEventCategory,
      toggleClassificationCategory,
      toggleClassificationSubcategory,
      toggleClassificationStatus: toggleClassificationStatusFn,
      setTimeRange: setTimeRangeFn,
      togglePatternFilter: togglePatternFilterFn,
      setFilterMode,
      applyQuickFilter,
      resetAll,
      activeFilterCount,
    }),
    [
      togglePersonFn,
      toggleAllPersons,
      togglePersonGroupFn,
      toggleTraumaCategory,
      toggleLifeEventCategory,
      toggleClassificationCategory,
      toggleClassificationSubcategory,
      toggleClassificationStatusFn,
      setTimeRangeFn,
      togglePatternFilterFn,
      setFilterMode,
      applyQuickFilter,
      resetAll,
      activeFilterCount,
    ],
  );

  return { filters, actions, dims };
}
