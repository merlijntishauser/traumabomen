import * as Sentry from "@sentry/react";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useEncryption } from "../contexts/useEncryption";
import {
  getClassifications,
  getEvents,
  getJournalEntries,
  getLifeEvents,
  getPatterns,
  getPersons,
  getRelationships,
  getTree,
  getTurningPoints,
} from "../lib/api";
import type {
  Classification,
  JournalEntry,
  LifeEvent,
  Pattern,
  Person,
  RelationshipData,
  TraumaEvent,
  TurningPoint,
} from "../types/domain";

export interface DecryptedPerson extends Person {
  id: string;
}

export interface DecryptedRelationship extends RelationshipData {
  id: string;
  source_person_id: string;
  target_person_id: string;
}

export interface DecryptedEvent extends TraumaEvent {
  id: string;
  person_ids: string[];
}

export interface DecryptedLifeEvent extends LifeEvent {
  id: string;
  person_ids: string[];
}

export interface DecryptedTurningPoint extends TurningPoint {
  id: string;
  person_ids: string[];
}

export interface DecryptedClassification extends Classification {
  id: string;
  person_ids: string[];
}

export interface DecryptedPattern extends Pattern {
  id: string;
  person_ids: string[];
}

export interface DecryptedJournalEntry extends JournalEntry {
  id: string;
  created_at: string;
  updated_at: string;
}

/** Filter a linked-entity map to entries associated with a given person. */
export function filterByPerson<T extends { person_ids: string[] }>(
  entities: Map<string, T>,
  personId: string | null,
): T[] {
  if (!personId) return [];
  return Array.from(entities.values()).filter((e) => e.person_ids.includes(personId));
}

export const treeQueryKeys = {
  tree: (treeId: string) => ["trees", treeId] as const,
  persons: (treeId: string) => ["trees", treeId, "persons"] as const,
  relationships: (treeId: string) => ["trees", treeId, "relationships"] as const,
  events: (treeId: string) => ["trees", treeId, "events"] as const,
  lifeEvents: (treeId: string) => ["trees", treeId, "lifeEvents"] as const,
  turningPoints: (treeId: string) => ["trees", treeId, "turningPoints"] as const,
  classifications: (treeId: string) => ["trees", treeId, "classifications"] as const,
  patterns: (treeId: string) => ["trees", treeId, "patterns"] as const,
  journalEntries: (treeId: string) => ["trees", treeId, "journalEntries"] as const,
};

const EMPTY_PERSONS = new Map<string, DecryptedPerson>();
const EMPTY_RELATIONSHIPS = new Map<string, DecryptedRelationship>();
const EMPTY_EVENTS = new Map<string, DecryptedEvent>();
const EMPTY_LIFE_EVENTS = new Map<string, DecryptedLifeEvent>();
const EMPTY_TURNING_POINTS = new Map<string, DecryptedTurningPoint>();
const EMPTY_CLASSIFICATIONS = new Map<string, DecryptedClassification>();
const EMPTY_PATTERNS = new Map<string, DecryptedPattern>();
const EMPTY_JOURNAL_ENTRIES = new Map<string, DecryptedJournalEntry>();

type LinkedApiResponse = { id: string; person_ids: string[]; encrypted_data: string };

function useLinkedEntityQuery<
  TData,
  TDecrypted extends TData & { id: string; person_ids: string[] },
>(
  queryKey: readonly unknown[],
  fetchFn: (treeId: string) => Promise<LinkedApiResponse[]>,
  treeId: string,
  decrypt: <T>(data: string, treeId: string) => Promise<T>,
  hasKey: boolean,
): UseQueryResult<Map<string, TDecrypted>> {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const responses = await fetchFn(treeId);
      const results = await Promise.allSettled(
        responses.map(async (r) => {
          const data = await decrypt<TData>(r.encrypted_data, treeId);
          return [r.id, { ...data, id: r.id, person_ids: r.person_ids } as TDecrypted] as const;
        }),
      );
      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length > 0) {
        Sentry.captureMessage(`Failed to decrypt ${rejected.length} linked entities`, "warning");
      }
      const entries = results
        .filter(
          (r): r is PromiseFulfilledResult<readonly [string, TDecrypted]> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
      return new Map(entries);
    },
    enabled: hasKey,
  });
}

export function useTreeData(treeId: string) {
  const { decrypt, masterKey, treeKeys } = useEncryption();
  const hasKey = masterKey !== null && treeKeys.has(treeId);

  const treeQuery = useQuery({
    queryKey: treeQueryKeys.tree(treeId),
    queryFn: async () => {
      const response = await getTree(treeId);
      const data = await decrypt<{ name: string }>(response.encrypted_data, treeId);
      return data.name;
    },
    enabled: hasKey,
  });

  const personsQuery = useQuery({
    queryKey: treeQueryKeys.persons(treeId),
    queryFn: async () => {
      const responses = await getPersons(treeId);
      const results = await Promise.allSettled(
        responses.map(async (r) => {
          const data = await decrypt<Person>(r.encrypted_data, treeId);
          const person: Person = {
            ...data,
            birth_month: data.birth_month ?? null,
            birth_day: data.birth_day ?? null,
            death_month: data.death_month ?? null,
            death_day: data.death_day ?? null,
          };
          return [r.id, { ...person, id: r.id } as DecryptedPerson] as const;
        }),
      );
      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length > 0) {
        Sentry.captureMessage(`Failed to decrypt ${rejected.length} persons`, "warning");
      }
      const entries = results
        .filter(
          (r): r is PromiseFulfilledResult<readonly [string, DecryptedPerson]> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
      return new Map(entries);
    },
    enabled: hasKey,
  });

  const relationshipsQuery = useQuery({
    queryKey: treeQueryKeys.relationships(treeId),
    queryFn: async () => {
      const responses = await getRelationships(treeId);
      const results = await Promise.allSettled(
        responses.map(async (r) => {
          const data = await decrypt<RelationshipData>(r.encrypted_data, treeId);
          return [
            r.id,
            {
              ...data,
              id: r.id,
              source_person_id: r.source_person_id,
              target_person_id: r.target_person_id,
            } as DecryptedRelationship,
          ] as const;
        }),
      );
      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length > 0) {
        Sentry.captureMessage(`Failed to decrypt ${rejected.length} relationships`, "warning");
      }
      const entries = results
        .filter(
          (r): r is PromiseFulfilledResult<readonly [string, DecryptedRelationship]> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
      return new Map(entries);
    },
    enabled: hasKey,
  });

  const eventsQuery = useLinkedEntityQuery<TraumaEvent, DecryptedEvent>(
    treeQueryKeys.events(treeId),
    getEvents,
    treeId,
    decrypt,
    hasKey,
  );

  const lifeEventsQuery = useLinkedEntityQuery<LifeEvent, DecryptedLifeEvent>(
    treeQueryKeys.lifeEvents(treeId),
    getLifeEvents,
    treeId,
    decrypt,
    hasKey,
  );

  const turningPointsQuery = useLinkedEntityQuery<TurningPoint, DecryptedTurningPoint>(
    treeQueryKeys.turningPoints(treeId),
    getTurningPoints,
    treeId,
    decrypt,
    hasKey,
  );

  const classificationsQuery = useLinkedEntityQuery<Classification, DecryptedClassification>(
    treeQueryKeys.classifications(treeId),
    getClassifications,
    treeId,
    decrypt,
    hasKey,
  );

  const patternsQuery = useLinkedEntityQuery<Pattern, DecryptedPattern>(
    treeQueryKeys.patterns(treeId),
    getPatterns,
    treeId,
    decrypt,
    hasKey,
  );

  const journalEntriesQuery = useQuery({
    queryKey: treeQueryKeys.journalEntries(treeId),
    queryFn: async () => {
      const responses = await getJournalEntries(treeId);
      const results = await Promise.allSettled(
        responses.map(async (r) => {
          const data = await decrypt<JournalEntry>(r.encrypted_data, treeId);
          return [
            r.id,
            {
              ...data,
              id: r.id,
              created_at: r.created_at,
              updated_at: r.updated_at,
            } as DecryptedJournalEntry,
          ] as const;
        }),
      );
      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length > 0) {
        Sentry.captureMessage(`Failed to decrypt ${rejected.length} journal entries`, "warning");
      }
      const entries = results
        .filter(
          (r): r is PromiseFulfilledResult<readonly [string, DecryptedJournalEntry]> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
      return new Map(entries);
    },
    enabled: hasKey,
  });

  const allQueries = [
    treeQuery,
    personsQuery,
    relationshipsQuery,
    eventsQuery,
    lifeEventsQuery,
    turningPointsQuery,
    classificationsQuery,
    patternsQuery,
    journalEntriesQuery,
  ];

  return {
    treeName: treeQuery.data ?? null,
    persons: personsQuery.data ?? EMPTY_PERSONS,
    relationships: relationshipsQuery.data ?? EMPTY_RELATIONSHIPS,
    events: eventsQuery.data ?? EMPTY_EVENTS,
    lifeEvents: lifeEventsQuery.data ?? EMPTY_LIFE_EVENTS,
    turningPoints: turningPointsQuery.data ?? EMPTY_TURNING_POINTS,
    classifications: classificationsQuery.data ?? EMPTY_CLASSIFICATIONS,
    patterns: patternsQuery.data ?? EMPTY_PATTERNS,
    journalEntries: journalEntriesQuery.data ?? EMPTY_JOURNAL_ENTRIES,
    isLoading: allQueries.some((q) => q.isLoading),
    error: allQueries.find((q) => q.error)?.error ?? null,
  };
}
