import { useQuery } from "@tanstack/react-query";
import { getTree, getPersons, getRelationships, getEvents, getLifeEvents } from "../lib/api";
import { useEncryption } from "../contexts/EncryptionContext";
import type { Person, RelationshipData, TraumaEvent, LifeEvent } from "../types/domain";

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

export const treeQueryKeys = {
  tree: (treeId: string) => ["trees", treeId] as const,
  persons: (treeId: string) => ["trees", treeId, "persons"] as const,
  relationships: (treeId: string) =>
    ["trees", treeId, "relationships"] as const,
  events: (treeId: string) => ["trees", treeId, "events"] as const,
  lifeEvents: (treeId: string) => ["trees", treeId, "lifeEvents"] as const,
};

const EMPTY_PERSONS = new Map<string, DecryptedPerson>();
const EMPTY_RELATIONSHIPS = new Map<string, DecryptedRelationship>();
const EMPTY_EVENTS = new Map<string, DecryptedEvent>();
const EMPTY_LIFE_EVENTS = new Map<string, DecryptedLifeEvent>();

export function useTreeData(treeId: string) {
  const { decrypt } = useEncryption();

  const treeQuery = useQuery({
    queryKey: treeQueryKeys.tree(treeId),
    queryFn: async () => {
      const response = await getTree(treeId);
      const data = await decrypt<{ name: string }>(response.encrypted_data);
      return data.name;
    },
  });

  const personsQuery = useQuery({
    queryKey: treeQueryKeys.persons(treeId),
    queryFn: async () => {
      const responses = await getPersons(treeId);
      const entries = await Promise.all(
        responses.map(async (r) => {
          const data = await decrypt<Person>(r.encrypted_data);
          return [r.id, { ...data, id: r.id } as DecryptedPerson] as const;
        }),
      );
      return new Map(entries);
    },
  });

  const relationshipsQuery = useQuery({
    queryKey: treeQueryKeys.relationships(treeId),
    queryFn: async () => {
      const responses = await getRelationships(treeId);
      const entries = await Promise.all(
        responses.map(async (r) => {
          const data = await decrypt<RelationshipData>(r.encrypted_data);
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
  });

  const eventsQuery = useQuery({
    queryKey: treeQueryKeys.events(treeId),
    queryFn: async () => {
      const responses = await getEvents(treeId);
      const entries = await Promise.all(
        responses.map(async (r) => {
          const data = await decrypt<TraumaEvent>(r.encrypted_data);
          return [
            r.id,
            { ...data, id: r.id, person_ids: r.person_ids } as DecryptedEvent,
          ] as const;
        }),
      );
      return new Map(entries);
    },
  });

  const lifeEventsQuery = useQuery({
    queryKey: treeQueryKeys.lifeEvents(treeId),
    queryFn: async () => {
      const responses = await getLifeEvents(treeId);
      const entries = await Promise.all(
        responses.map(async (r) => {
          const data = await decrypt<LifeEvent>(r.encrypted_data);
          return [
            r.id,
            { ...data, id: r.id, person_ids: r.person_ids } as DecryptedLifeEvent,
          ] as const;
        }),
      );
      return new Map(entries);
    },
  });

  return {
    treeName: treeQuery.data ?? null,
    persons: personsQuery.data ?? EMPTY_PERSONS,
    relationships: relationshipsQuery.data ?? EMPTY_RELATIONSHIPS,
    events: eventsQuery.data ?? EMPTY_EVENTS,
    lifeEvents: lifeEventsQuery.data ?? EMPTY_LIFE_EVENTS,
    isLoading:
      personsQuery.isLoading ||
      relationshipsQuery.isLoading ||
      eventsQuery.isLoading ||
      lifeEventsQuery.isLoading,
    error:
      personsQuery.error ||
      relationshipsQuery.error ||
      eventsQuery.error ||
      lifeEventsQuery.error,
  };
}
