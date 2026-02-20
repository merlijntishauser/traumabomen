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

/** Derive visiblePersonIds by intersecting per-category union sets. */
function deriveVisibleFromGroups(activeGroupData: Map<string, Set<string>>): Set<string> | null {
  if (activeGroupData.size === 0) return null;

  // Build per-category unions
  const categoryUnions = new Map<string, Set<string>>();
  for (const [groupKey, personIds] of activeGroupData) {
    const cat = groupCategory(groupKey);
    const existing = categoryUnions.get(cat);
    if (existing) {
      for (const id of personIds) existing.add(id);
    } else {
      categoryUnions.set(cat, new Set(personIds));
    }
  }

  // Intersect across categories
  let result: Set<string> | null = null;
  for (const ids of categoryUnions.values()) {
    if (result === null) {
      result = new Set(ids);
    } else {
      const intersection = new Set<string>();
      for (const id of result) {
        if (ids.has(id)) intersection.add(id);
      }
      result = intersection;
    }
  }
  return result;
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
      // Collapse group state into flat customPersonIds, then toggle
      setCustomPersonIds((prev) => {
        const current = prev ?? deriveVisibleFromGroups(activeGroupData);
        if (current === null) {
          // All visible: hide this one person
          const next = new Set(allPersonIds);
          next.delete(personId);
          return next;
        }
        const next = new Set(current);
        if (next.has(personId)) {
          next.delete(personId);
        } else {
          next.add(personId);
        }
        if (next.size === allPersonIds.size) return null;
        return next;
      });
      // Clear group data since we're now in custom mode
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

  // For classifications/subcategories, the "all" set is dynamic (only used categories).
  // We use a large placeholder set so unchecking works, and rely on the filter panel
  // only showing used categories. When all are re-checked, size >= allValues resets to null.
  const toggleClassificationCategory = useCallback(
    (cat: string) => {
      setClassificationCategories((prev) => {
        if (prev === null) {
          // All visible; uncheck this one
          const allUsed = new Set<string>();
          for (const [, cls] of classifications) allUsed.add(cls.dsm_category);
          allUsed.delete(cat);
          return allUsed.size === 0 ? new Set<string>() : allUsed;
        }
        const next = new Set(prev);
        if (next.has(cat)) {
          next.delete(cat);
        } else {
          next.add(cat);
        }
        // Check if all used categories are now selected
        let allRestored = true;
        for (const [, cls] of classifications) {
          if (!next.has(cls.dsm_category)) {
            allRestored = false;
            break;
          }
        }
        return allRestored ? null : next;
      });
    },
    [classifications],
  );

  const toggleClassificationSubcategory = useCallback(
    (subcat: string) => {
      setClassificationSubcategories((prev) => {
        if (prev === null) {
          const allUsed = new Set<string>();
          for (const [, cls] of classifications) {
            if (cls.dsm_subcategory) allUsed.add(cls.dsm_subcategory);
          }
          allUsed.delete(subcat);
          return allUsed.size === 0 ? new Set<string>() : allUsed;
        }
        const next = new Set(prev);
        if (next.has(subcat)) {
          next.delete(subcat);
        } else {
          next.add(subcat);
        }
        let allRestored = true;
        for (const [, cls] of classifications) {
          if (cls.dsm_subcategory && !next.has(cls.dsm_subcategory)) {
            allRestored = false;
            break;
          }
        }
        return allRestored ? null : next;
      });
    },
    [classifications],
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
      setVisiblePatterns((prev) => {
        if (prev === null) {
          // All visible: hide this one pattern
          const next = new Set(allPatternIds);
          next.delete(patternId);
          return next.size === 0 ? new Set<string>() : next;
        }
        const next = new Set(prev);
        if (next.has(patternId)) {
          next.delete(patternId);
        } else {
          next.add(patternId);
        }
        // If all patterns restored, reset to null (unfiltered)
        if (next.size >= allPatternIds.size) return null;
        return next.size === 0 ? new Set<string>() : next;
      });
    },
    [allPatternIds],
  );

  const setFilterMode = useCallback((mode: FilterMode) => {
    setFilterModeState(mode);
  }, []);

  const applyQuickFilter = useCallback(
    (preset: QuickFilterPreset) => {
      // Check if preset is already active (its layer unfiltered, others fully off)
      const isTraumaActive =
        traumaCategories === null &&
        lifeEventCategories !== null &&
        lifeEventCategories.size === 0 &&
        classificationCategories !== null &&
        classificationCategories.size === 0;
      const isLifeEventsActive =
        lifeEventCategories === null &&
        traumaCategories !== null &&
        traumaCategories.size === 0 &&
        classificationCategories !== null &&
        classificationCategories.size === 0;
      const isClassificationsActive =
        classificationCategories === null &&
        traumaCategories !== null &&
        traumaCategories.size === 0 &&
        lifeEventCategories !== null &&
        lifeEventCategories.size === 0;

      const isAlreadyActive =
        (preset === "trauma" && isTraumaActive) ||
        (preset === "lifeEvents" && isLifeEventsActive) ||
        (preset === "classifications" && isClassificationsActive);

      if (isAlreadyActive) {
        // Toggle off: reset category filters
        setTraumaCategories(null);
        setLifeEventCategories(null);
        setClassificationCategories(null);
        setClassificationSubcategories(null);
        setClassificationStatus(null);
        return;
      }

      if (preset === "trauma") {
        setTraumaCategories(null);
        setLifeEventCategories(new Set());
        setClassificationCategories(new Set());
        setClassificationSubcategories(null);
        setClassificationStatus(null);
      } else if (preset === "lifeEvents") {
        setTraumaCategories(new Set());
        setLifeEventCategories(null);
        setClassificationCategories(new Set());
        setClassificationSubcategories(null);
        setClassificationStatus(null);
      } else if (preset === "classifications") {
        setTraumaCategories(new Set());
        setLifeEventCategories(new Set());
        setClassificationCategories(null);
        setClassificationSubcategories(null);
        setClassificationStatus(null);
      }
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (visiblePersonIds !== null) count++;
    if (traumaCategories !== null) count++;
    if (lifeEventCategories !== null) count++;
    if (classificationCategories !== null) count++;
    if (classificationSubcategories !== null) count++;
    if (classificationStatus !== null) count++;
    if (timeRange !== null) count++;
    if (visiblePatterns !== null) count++;
    return count;
  }, [
    visiblePersonIds,
    traumaCategories,
    lifeEventCategories,
    classificationCategories,
    classificationSubcategories,
    classificationStatus,
    timeRange,
    visiblePatterns,
  ]);

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
