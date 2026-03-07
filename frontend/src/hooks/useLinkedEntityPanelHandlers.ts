import { useMemo } from "react";
import type { JournalEntry, Person, RelationshipData } from "../types/domain";
import { linkedEntityHandlers, type useTreeMutations } from "./useTreeMutations";

export function useLinkedEntityPanelHandlers(options: {
  mutations: ReturnType<typeof useTreeMutations>;
  selectedPersonId: string | null;
  onPersonDeleted?: () => void;
  onPersonSaved?: () => void;
}) {
  const { mutations, selectedPersonId, onPersonDeleted, onPersonSaved } = options;

  return useMemo(() => {
    function handleSavePerson(data: Person) {
      if (!selectedPersonId) return;
      mutations.updatePerson.mutate(
        { personId: selectedPersonId, data },
        onPersonSaved ? { onSuccess: onPersonSaved } : undefined,
      );
    }

    function handleDeletePerson(personId: string) {
      mutations.deletePerson.mutate(personId, {
        onSuccess: () => onPersonDeleted?.(),
      });
    }

    function handleSaveRelationship(relationshipId: string, data: RelationshipData) {
      mutations.updateRelationship.mutate({ relationshipId, data });
    }

    function handleSaveJournalEntry(entryId: string | null, data: JournalEntry) {
      if (entryId) {
        mutations.updateJournalEntry.mutate({ entryId, data });
      } else {
        mutations.createJournalEntry.mutate(data);
      }
    }

    function handleDeleteJournalEntry(entryId: string) {
      mutations.deleteJournalEntry.mutate(entryId);
    }

    return {
      handleSavePerson,
      handleDeletePerson,
      handleSaveRelationship,
      eventHandlers: linkedEntityHandlers(mutations.events),
      lifeEventHandlers: linkedEntityHandlers(mutations.lifeEvents),
      turningPointHandlers: linkedEntityHandlers(mutations.turningPoints),
      classificationHandlers: linkedEntityHandlers(mutations.classifications),
      patternHandlers: linkedEntityHandlers(mutations.patterns),
      handleSaveJournalEntry,
      handleDeleteJournalEntry,
    };
  }, [mutations, selectedPersonId, onPersonDeleted, onPersonSaved]);
}
