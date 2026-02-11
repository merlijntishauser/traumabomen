import { useQuery } from "@tanstack/react-query";
import { getPersons, getRelationships, getEvents } from "../lib/api";
import { useEncryption } from "../contexts/EncryptionContext";
import type { Person, RelationshipData, TraumaEvent } from "../types/domain";

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

export const treeQueryKeys = {
  persons: (treeId: string) => ["trees", treeId, "persons"] as const,
  relationships: (treeId: string) =>
    ["trees", treeId, "relationships"] as const,
  events: (treeId: string) => ["trees", treeId, "events"] as const,
};

export function useTreeData(treeId: string) {
  const { decrypt } = useEncryption();

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

  return {
    persons: personsQuery.data ?? new Map<string, DecryptedPerson>(),
    relationships:
      relationshipsQuery.data ?? new Map<string, DecryptedRelationship>(),
    events: eventsQuery.data ?? new Map<string, DecryptedEvent>(),
    isLoading:
      personsQuery.isLoading ||
      relationshipsQuery.isLoading ||
      eventsQuery.isLoading,
    error:
      personsQuery.error || relationshipsQuery.error || eventsQuery.error,
  };
}
