import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEncryption } from "../contexts/EncryptionContext";
import {
  createClassification,
  createEvent,
  createJournalEntry,
  createLifeEvent,
  createPattern,
  createPerson,
  createRelationship,
  createTurningPoint,
  deleteClassification,
  deleteEvent,
  deleteJournalEntry,
  deleteLifeEvent,
  deletePattern,
  deletePerson,
  deleteRelationship,
  deleteTurningPoint,
  updateClassification,
  updateEvent,
  updateJournalEntry,
  updateLifeEvent,
  updatePattern,
  updatePerson,
  updateRelationship,
  updateTurningPoint,
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
import { treeQueryKeys } from "./useTreeData";

interface LinkedEntityApiFns {
  create: (
    treeId: string,
    payload: { person_ids: string[]; encrypted_data: string },
  ) => Promise<unknown>;
  update: (
    treeId: string,
    id: string,
    payload: { person_ids: string[]; encrypted_data: string },
  ) => Promise<unknown>;
  delete: (treeId: string, id: string) => Promise<unknown>;
}

function useLinkedEntityMutations<T>(
  treeId: string,
  queryKey: QueryKey,
  apiFns: LinkedEntityApiFns,
  encrypt: (data: unknown, treeId: string) => Promise<string>,
) {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async ({ personIds, data }: { personIds: string[]; data: T }) => {
      const encrypted_data = await encrypt(data, treeId);
      return apiFns.create(treeId, { person_ids: personIds, encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const update = useMutation({
    mutationFn: async ({
      entityId,
      personIds,
      data,
    }: {
      entityId: string;
      personIds: string[];
      data: T;
    }) => {
      const encrypted_data = await encrypt(data, treeId);
      return apiFns.update(treeId, entityId, { person_ids: personIds, encrypted_data });
    },
    onMutate: async ({ entityId, personIds, data }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Map<string, unknown>>(queryKey);
      if (previous) {
        const updated = new Map(previous);
        const existing = updated.get(entityId);
        if (existing) {
          updated.set(entityId, { ...existing, ...data, person_ids: personIds });
        }
        queryClient.setQueryData(queryKey, updated);
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const remove = useMutation({
    mutationFn: (entityId: string) => apiFns.delete(treeId, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { create, update, delete: remove };
}

export function useTreeMutations(treeId: string) {
  const queryClient = useQueryClient();
  const { encrypt } = useEncryption();

  // --- Person (simple: no person_ids, no optimistic) ---

  const createPersonMutation = useMutation({
    mutationFn: async (data: Person) => {
      const encrypted_data = await encrypt(data, treeId);
      return createPerson(treeId, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.persons(treeId) });
    },
  });

  const updatePersonMutation = useMutation({
    mutationFn: async ({ personId, data }: { personId: string; data: Person }) => {
      const encrypted_data = await encrypt(data, treeId);
      return updatePerson(treeId, personId, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.persons(treeId) });
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: (personId: string) => deletePerson(treeId, personId),
    onSuccess: () => {
      for (const key of [
        treeQueryKeys.persons(treeId),
        treeQueryKeys.relationships(treeId),
        treeQueryKeys.events(treeId),
        treeQueryKeys.lifeEvents(treeId),
        treeQueryKeys.turningPoints(treeId),
        treeQueryKeys.classifications(treeId),
        treeQueryKeys.patterns(treeId),
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  // --- Relationship (unique create shape, no optimistic) ---

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
      const encrypted_data = await encrypt(data, treeId);
      return createRelationship(treeId, {
        source_person_id: sourcePersonId,
        target_person_id: targetPersonId,
        encrypted_data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.relationships(treeId) });
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
      const encrypted_data = await encrypt(data, treeId);
      return updateRelationship(treeId, relationshipId, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.relationships(treeId) });
    },
  });

  const deleteRelationshipMutation = useMutation({
    mutationFn: (relationshipId: string) => deleteRelationship(treeId, relationshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.relationships(treeId) });
    },
  });

  // --- Linked entities (person_ids + optimistic updates) ---

  const events = useLinkedEntityMutations<TraumaEvent>(
    treeId,
    treeQueryKeys.events(treeId),
    { create: createEvent, update: updateEvent, delete: deleteEvent },
    encrypt,
  );

  const lifeEvents = useLinkedEntityMutations<LifeEvent>(
    treeId,
    treeQueryKeys.lifeEvents(treeId),
    { create: createLifeEvent, update: updateLifeEvent, delete: deleteLifeEvent },
    encrypt,
  );

  const turningPoints = useLinkedEntityMutations<TurningPoint>(
    treeId,
    treeQueryKeys.turningPoints(treeId),
    { create: createTurningPoint, update: updateTurningPoint, delete: deleteTurningPoint },
    encrypt,
  );

  const classifications = useLinkedEntityMutations<Classification>(
    treeId,
    treeQueryKeys.classifications(treeId),
    { create: createClassification, update: updateClassification, delete: deleteClassification },
    encrypt,
  );

  const patterns = useLinkedEntityMutations<Pattern>(
    treeId,
    treeQueryKeys.patterns(treeId),
    { create: createPattern, update: updatePattern, delete: deletePattern },
    encrypt,
  );

  // --- Journal (simple: no person_ids, no optimistic) ---

  const createJournalEntryMutation = useMutation({
    mutationFn: async (data: JournalEntry) => {
      const encrypted_data = await encrypt(data, treeId);
      return createJournalEntry(treeId, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.journalEntries(treeId) });
    },
  });

  const updateJournalEntryMutation = useMutation({
    mutationFn: async ({ entryId, data }: { entryId: string; data: JournalEntry }) => {
      const encrypted_data = await encrypt(data, treeId);
      return updateJournalEntry(treeId, entryId, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.journalEntries(treeId) });
    },
  });

  const deleteJournalEntryMutation = useMutation({
    mutationFn: (entryId: string) => deleteJournalEntry(treeId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.journalEntries(treeId) });
    },
  });

  return {
    createPerson: createPersonMutation,
    updatePerson: updatePersonMutation,
    deletePerson: deletePersonMutation,
    createRelationship: createRelationshipMutation,
    updateRelationship: updateRelationshipMutation,
    deleteRelationship: deleteRelationshipMutation,
    createEvent: events.create,
    updateEvent: events.update,
    deleteEvent: events.delete,
    createLifeEvent: lifeEvents.create,
    updateLifeEvent: lifeEvents.update,
    deleteLifeEvent: lifeEvents.delete,
    createTurningPoint: turningPoints.create,
    updateTurningPoint: turningPoints.update,
    deleteTurningPoint: turningPoints.delete,
    createClassification: classifications.create,
    updateClassification: classifications.update,
    deleteClassification: classifications.delete,
    createPattern: patterns.create,
    updatePattern: patterns.update,
    deletePattern: patterns.delete,
    createJournalEntry: createJournalEntryMutation,
    updateJournalEntry: updateJournalEntryMutation,
    deleteJournalEntry: deleteJournalEntryMutation,
  };
}
