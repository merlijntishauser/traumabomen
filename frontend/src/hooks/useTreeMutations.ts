import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEncryption } from "../contexts/EncryptionContext";
import {
  createEvent,
  createLifeEvent,
  createPerson,
  createRelationship,
  deleteEvent,
  deleteLifeEvent,
  deletePerson,
  deleteRelationship,
  updateEvent,
  updateLifeEvent,
  updatePerson,
  updateRelationship,
} from "../lib/api";
import type { LifeEvent, Person, RelationshipData, TraumaEvent } from "../types/domain";
import type { DecryptedEvent, DecryptedLifeEvent } from "./useTreeData";
import { treeQueryKeys } from "./useTreeData";

export function useTreeMutations(treeId: string) {
  const queryClient = useQueryClient();
  const { encrypt } = useEncryption();

  const createPersonMutation = useMutation({
    mutationFn: async (data: Person) => {
      const encrypted_data = await encrypt(data);
      return createPerson(treeId, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.persons(treeId),
      });
    },
  });

  const updatePersonMutation = useMutation({
    mutationFn: async ({ personId, data }: { personId: string; data: Person }) => {
      const encrypted_data = await encrypt(data);
      return updatePerson(treeId, personId, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.persons(treeId),
      });
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: async (personId: string) => {
      return deletePerson(treeId, personId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.persons(treeId),
      });
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.relationships(treeId),
      });
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.events(treeId),
      });
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.lifeEvents(treeId),
      });
    },
  });

  const createRelationshipMutation = useMutation({
    mutationFn: async ({
      sourcePersonId,
      targetPersonId,
      data,
    }: {
      sourcePersonId: string;
      targetPersonId: string;
      data: RelationshipData;
    }) => {
      const encrypted_data = await encrypt(data);
      return createRelationship(treeId, {
        source_person_id: sourcePersonId,
        target_person_id: targetPersonId,
        encrypted_data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.relationships(treeId),
      });
    },
  });

  const updateRelationshipMutation = useMutation({
    mutationFn: async ({
      relationshipId,
      data,
    }: {
      relationshipId: string;
      data: RelationshipData;
    }) => {
      const encrypted_data = await encrypt(data);
      return updateRelationship(treeId, relationshipId, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.relationships(treeId),
      });
    },
  });

  const deleteRelationshipMutation = useMutation({
    mutationFn: async (relationshipId: string) => {
      return deleteRelationship(treeId, relationshipId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.relationships(treeId),
      });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async ({ personIds, data }: { personIds: string[]; data: TraumaEvent }) => {
      const encrypted_data = await encrypt(data);
      return createEvent(treeId, { person_ids: personIds, encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.events(treeId),
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({
      eventId,
      personIds,
      data,
    }: {
      eventId: string;
      personIds: string[];
      data: TraumaEvent;
    }) => {
      const encrypted_data = await encrypt(data);
      return updateEvent(treeId, eventId, {
        person_ids: personIds,
        encrypted_data,
      });
    },
    onMutate: async ({ eventId, personIds, data }) => {
      await queryClient.cancelQueries({ queryKey: treeQueryKeys.events(treeId) });
      const previous = queryClient.getQueryData<Map<string, DecryptedEvent>>(
        treeQueryKeys.events(treeId),
      );
      if (previous) {
        const updated = new Map(previous);
        const existing = updated.get(eventId);
        if (existing) {
          updated.set(eventId, { ...existing, ...data, person_ids: personIds });
        }
        queryClient.setQueryData(treeQueryKeys.events(treeId), updated);
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(treeQueryKeys.events(treeId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.events(treeId),
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return deleteEvent(treeId, eventId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.events(treeId),
      });
    },
  });

  const createLifeEventMutation = useMutation({
    mutationFn: async ({ personIds, data }: { personIds: string[]; data: LifeEvent }) => {
      const encrypted_data = await encrypt(data);
      return createLifeEvent(treeId, { person_ids: personIds, encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.lifeEvents(treeId),
      });
    },
  });

  const updateLifeEventMutation = useMutation({
    mutationFn: async ({
      lifeEventId,
      personIds,
      data,
    }: {
      lifeEventId: string;
      personIds: string[];
      data: LifeEvent;
    }) => {
      const encrypted_data = await encrypt(data);
      return updateLifeEvent(treeId, lifeEventId, {
        person_ids: personIds,
        encrypted_data,
      });
    },
    onMutate: async ({ lifeEventId, personIds, data }) => {
      await queryClient.cancelQueries({ queryKey: treeQueryKeys.lifeEvents(treeId) });
      const previous = queryClient.getQueryData<Map<string, DecryptedLifeEvent>>(
        treeQueryKeys.lifeEvents(treeId),
      );
      if (previous) {
        const updated = new Map(previous);
        const existing = updated.get(lifeEventId);
        if (existing) {
          updated.set(lifeEventId, { ...existing, ...data, person_ids: personIds });
        }
        queryClient.setQueryData(treeQueryKeys.lifeEvents(treeId), updated);
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(treeQueryKeys.lifeEvents(treeId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.lifeEvents(treeId),
      });
    },
  });

  const deleteLifeEventMutation = useMutation({
    mutationFn: async (lifeEventId: string) => {
      return deleteLifeEvent(treeId, lifeEventId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treeQueryKeys.lifeEvents(treeId),
      });
    },
  });

  return {
    createPerson: createPersonMutation,
    updatePerson: updatePersonMutation,
    deletePerson: deletePersonMutation,
    createRelationship: createRelationshipMutation,
    updateRelationship: updateRelationshipMutation,
    deleteRelationship: deleteRelationshipMutation,
    createEvent: createEventMutation,
    updateEvent: updateEventMutation,
    deleteEvent: deleteEventMutation,
    createLifeEvent: createLifeEventMutation,
    updateLifeEvent: updateLifeEventMutation,
    deleteLifeEvent: deleteLifeEventMutation,
  };
}
