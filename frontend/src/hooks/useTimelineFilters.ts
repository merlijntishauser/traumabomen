import { useCallback, useMemo, useState } from "react";
import type { ClassificationStatus, LifeEventCategory, TraumaCategory } from "../types/domain";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
} from "./useTreeData";

export interface TimelineFilterState {
  visiblePersonIds: Set<string> | null;
  traumaCategories: Set<TraumaCategory> | null;
  lifeEventCategories: Set<LifeEventCategory> | null;
  classificationCategories: Set<string> | null;
  classificationStatus: Set<ClassificationStatus> | null;
  timeRange: { min: number; max: number } | null;
}

export interface TimelineFilterActions {
  togglePerson: (personId: string) => void;
  toggleAllPersons: (visible: boolean) => void;
  toggleTraumaCategory: (cat: TraumaCategory) => void;
  toggleLifeEventCategory: (cat: LifeEventCategory) => void;
  toggleClassificationCategory: (cat: string) => void;
  toggleClassificationStatus: (status: ClassificationStatus) => void;
  setTimeRange: (range: { min: number; max: number } | null) => void;
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

function computeDimmedClassifications(
  classifications: Map<string, DecryptedClassification>,
  visiblePersonIds: Set<string> | null,
  classificationCategories: Set<string> | null,
  classificationStatus: Set<ClassificationStatus> | null,
): Set<string> {
  const result = new Set<string>();
  for (const [id, cls] of classifications) {
    if (
      isPersonDimmed(cls.person_ids, visiblePersonIds) ||
      isCategoryFiltered(cls.dsm_category, classificationCategories) ||
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

export function computeDimSets(
  filters: TimelineFilterState,
  persons: Map<string, DecryptedPerson>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
): DimSets {
  const {
    visiblePersonIds,
    traumaCategories,
    lifeEventCategories,
    classificationCategories,
    classificationStatus,
    timeRange,
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
    classificationStatus,
  );

  if (
    dimmedPersonIds.size === 0 &&
    dimmedEventIds.size === 0 &&
    dimmedLifeEventIds.size === 0 &&
    dimmedClassificationIds.size === 0
  ) {
    return EMPTY_DIMS;
  }

  return { dimmedPersonIds, dimmedEventIds, dimmedLifeEventIds, dimmedClassificationIds };
}

export function useTimelineFilters(
  persons: Map<string, DecryptedPerson>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
): { filters: TimelineFilterState; actions: TimelineFilterActions; dims: DimSets } {
  const [visiblePersonIds, setVisiblePersonIds] = useState<Set<string> | null>(null);
  const [traumaCategories, setTraumaCategories] = useState<Set<TraumaCategory> | null>(null);
  const [lifeEventCategories, setLifeEventCategories] = useState<Set<LifeEventCategory> | null>(
    null,
  );
  const [classificationCategories, setClassificationCategories] = useState<Set<string> | null>(
    null,
  );
  const [classificationStatus, setClassificationStatus] =
    useState<Set<ClassificationStatus> | null>(null);
  const [timeRange, setTimeRange] = useState<{ min: number; max: number } | null>(null);

  const filters: TimelineFilterState = useMemo(
    () => ({
      visiblePersonIds,
      traumaCategories,
      lifeEventCategories,
      classificationCategories,
      classificationStatus,
      timeRange,
    }),
    [
      visiblePersonIds,
      traumaCategories,
      lifeEventCategories,
      classificationCategories,
      classificationStatus,
      timeRange,
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

  const resetAll = useCallback(() => {
    setVisiblePersonIds(null);
    setTraumaCategories(null);
    setLifeEventCategories(null);
    setClassificationCategories(null);
    setClassificationStatus(null);
    setTimeRange(null);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (visiblePersonIds !== null) count++;
    if (traumaCategories !== null) count++;
    if (lifeEventCategories !== null) count++;
    if (classificationCategories !== null) count++;
    if (classificationStatus !== null) count++;
    if (timeRange !== null) count++;
    return count;
  }, [
    visiblePersonIds,
    traumaCategories,
    lifeEventCategories,
    classificationCategories,
    classificationStatus,
    timeRange,
  ]);

  const dims = useMemo(
    () => computeDimSets(filters, persons, events, lifeEvents, classifications),
    [filters, persons, events, lifeEvents, classifications],
  );

  const actions: TimelineFilterActions = useMemo(
    () => ({
      togglePerson: togglePersonFn,
      toggleAllPersons,
      toggleTraumaCategory,
      toggleLifeEventCategory,
      toggleClassificationCategory,
      toggleClassificationStatus: toggleClassificationStatusFn,
      setTimeRange: setTimeRangeFn,
      resetAll,
      activeFilterCount,
    }),
    [
      togglePersonFn,
      toggleAllPersons,
      toggleTraumaCategory,
      toggleLifeEventCategory,
      toggleClassificationCategory,
      toggleClassificationStatusFn,
      setTimeRangeFn,
      resetAll,
      activeFilterCount,
    ],
  );

  return { filters, actions, dims };
}
