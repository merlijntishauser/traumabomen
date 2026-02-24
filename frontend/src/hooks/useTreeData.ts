import { useQuery } from "@tanstack/react-query";
import { useEncryption } from "../contexts/EncryptionContext";
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
      const entries = await Promise.all(
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
      return new Map(entries);
    },
    enabled: hasKey,
  });

  const relationshipsQuery = useQuery({
    queryKey: treeQueryKeys.relationships(treeId),
    queryFn: async () => {
      const responses = await getRelationships(treeId);
      const entries = await Promise.all(
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
      return new Map(entries);
    },
    enabled: hasKey,
  });

  const eventsQuery = useQuery({
    queryKey: treeQueryKeys.events(treeId),
    queryFn: async () => {
      const responses = await getEvents(treeId);
      const entries = await Promise.all(
        responses.map(async (r) => {
          const data = await decrypt<TraumaEvent>(r.encrypted_data, treeId);
          return [r.id, { ...data, id: r.id, person_ids: r.person_ids } as DecryptedEvent] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: hasKey,
  });

  const lifeEventsQuery = useQuery({
    queryKey: treeQueryKeys.lifeEvents(treeId),
    queryFn: async () => {
      const responses = await getLifeEvents(treeId);
      const entries = await Promise.all(
        responses.map(async (r) => {
          const data = await decrypt<LifeEvent>(r.encrypted_data, treeId);
          return [
            r.id,
            { ...data, id: r.id, person_ids: r.person_ids } as DecryptedLifeEvent,
          ] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: hasKey,
  });

  const turningPointsQuery = useQuery({
    queryKey: treeQueryKeys.turningPoints(treeId),
    queryFn: async () => {
      const responses = await getTurningPoints(treeId);
      const entries = await Promise.all(
        responses.map(async (r) => {
          const data = await decrypt<TurningPoint>(r.encrypted_data, treeId);
          return [
            r.id,
            { ...data, id: r.id, person_ids: r.person_ids } as DecryptedTurningPoint,
          ] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: hasKey,
  });

  const classificationsQuery = useQuery({
    queryKey: treeQueryKeys.classifications(treeId),
    queryFn: async () => {
      const responses = await getClassifications(treeId);
      const entries = await Promise.all(
        responses.map(async (r) => {
          const data = await decrypt<Classification>(r.encrypted_data, treeId);
          return [
            r.id,
            { ...data, id: r.id, person_ids: r.person_ids } as DecryptedClassification,
          ] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: hasKey,
  });

  const patternsQuery = useQuery({
    queryKey: treeQueryKeys.patterns(treeId),
    queryFn: async () => {
      const responses = await getPatterns(treeId);
      const entries = await Promise.all(
        responses.map(async (r) => {
          const data = await decrypt<Pattern>(r.encrypted_data, treeId);
          return [
            r.id,
            { ...data, id: r.id, person_ids: r.person_ids } as DecryptedPattern,
          ] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: hasKey,
  });

  const journalEntriesQuery = useQuery({
    queryKey: treeQueryKeys.journalEntries(treeId),
    queryFn: async () => {
      const responses = await getJournalEntries(treeId);
      const entries = await Promise.all(
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
      return new Map(entries);
    },
    enabled: hasKey,
  });

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
    isLoading:
      personsQuery.isLoading ||
      relationshipsQuery.isLoading ||
      eventsQuery.isLoading ||
      lifeEventsQuery.isLoading ||
      turningPointsQuery.isLoading ||
      classificationsQuery.isLoading ||
      patternsQuery.isLoading ||
      journalEntriesQuery.isLoading,
    error:
      personsQuery.error ||
      relationshipsQuery.error ||
      eventsQuery.error ||
      lifeEventsQuery.error ||
      turningPointsQuery.error ||
      classificationsQuery.error ||
      patternsQuery.error ||
      journalEntriesQuery.error,
  };
}
