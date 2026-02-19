import { useCallback, useMemo, useState } from "react";
import type { ClassificationStatus, LifeEventCategory, TraumaCategory } from "../types/domain";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
} from "./useTreeData";

export type FilterMode = "dim" | "hide";

export type QuickFilterPreset = "trauma" | "lifeEvents" | "classifications";

export interface TimelineFilterState {
  visiblePersonIds: Set<string> | null;
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
  togglePersonGroup: (personIds: Set<string>) => void;
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

export function useTimelineFilters(
  persons: Map<string, DecryptedPerson>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
  patterns?: Map<string, DecryptedPattern>,
): { filters: TimelineFilterState; actions: TimelineFilterActions; dims: DimSets } {
  const [visiblePersonIds, setVisiblePersonIds] = useState<Set<string> | null>(null);
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

  const filters: TimelineFilterState = useMemo(
    () => ({
      visiblePersonIds,
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
      setVisiblePersonIds((prev) => {
        if (prev === null) {
          // Currently all visible; hide this one person
          const next = new Set(allPersonIds);
          next.delete(personId);
          return next;
        }
        const next = new Set(prev);
        if (next.has(personId)) {
          next.delete(personId);
        } else {
          next.add(personId);
        }
        // If all persons are now visible again, reset to null
        if (next.size === allPersonIds.size) return null;
        return next;
      });
    },
    [allPersonIds],
  );

  const toggleAllPersons = useCallback((visible: boolean) => {
    if (visible) {
      setVisiblePersonIds(null);
    } else {
      setVisiblePersonIds(new Set());
    }
  }, []);

  const togglePersonGroupFn = useCallback(
    (groupPersonIds: Set<string>) => {
      setVisiblePersonIds((prev) => {
        if (prev === null) {
          return new Set(groupPersonIds);
        }
        const allInSet = [...groupPersonIds].every((id) => prev.has(id));
        const next = new Set(prev);
        if (allInSet) {
          for (const id of groupPersonIds) next.delete(id);
          return next.size === 0 ? null : next;
        }
        for (const id of groupPersonIds) next.add(id);
        if (next.size === allPersonIds.size) return null;
        return next;
      });
    },
    [allPersonIds],
  );

  const toggleTraumaCategory = useCallback((cat: TraumaCategory) => {
    setTraumaCategories((prev) => {
      if (prev === null) {
        // First toggle: show only this category
        return new Set([cat]);
      }
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next.size === 0 ? null : next;
    });
  }, []);

  const toggleLifeEventCategory = useCallback((cat: LifeEventCategory) => {
    setLifeEventCategories((prev) => {
      if (prev === null) {
        return new Set([cat]);
      }
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next.size === 0 ? null : next;
    });
  }, []);

  const toggleClassificationCategory = useCallback((cat: string) => {
    setClassificationCategories((prev) => {
      if (prev === null) {
        return new Set([cat]);
      }
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next.size === 0 ? null : next;
    });
  }, []);

  const toggleClassificationSubcategory = useCallback((subcat: string) => {
    setClassificationSubcategories((prev) => {
      if (prev === null) {
        return new Set([subcat]);
      }
      const next = new Set(prev);
      if (next.has(subcat)) {
        next.delete(subcat);
      } else {
        next.add(subcat);
      }
      return next.size === 0 ? null : next;
    });
  }, []);

  const toggleClassificationStatusFn = useCallback((status: ClassificationStatus) => {
    setClassificationStatus((prev) => {
      if (prev === null) {
        return new Set([status]);
      }
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next.size === 0 ? null : next;
    });
  }, []);

  const setTimeRangeFn = useCallback((range: { min: number; max: number } | null) => {
    setTimeRange(range);
  }, []);

  const togglePatternFilterFn = useCallback((patternId: string) => {
    setVisiblePatterns((prev) => {
      if (prev === null) {
        return new Set([patternId]);
      }
      const next = new Set(prev);
      if (next.has(patternId)) {
        next.delete(patternId);
      } else {
        next.add(patternId);
      }
      return next.size === 0 ? null : next;
    });
  }, []);

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
    setVisiblePersonIds(null);
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
