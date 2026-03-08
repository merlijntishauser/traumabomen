import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEncryption } from "../contexts/useEncryption";
import { syncTree } from "../lib/api";
import type { Person, RelationshipData, SiblingGroupData, SiblingGroupMember } from "../types/domain";
import { RelationshipType } from "../types/domain";
import type { DecryptedSiblingGroup } from "./useTreeData";
import { treeQueryKeys } from "./useTreeData";

export function usePromoteMember(treeId: string) {
  const queryClient = useQueryClient();
  const { encrypt } = useEncryption();

  return useMutation({
    mutationFn: async ({
      group,
      memberIndex,
    }: {
      group: DecryptedSiblingGroup;
      memberIndex: number;
    }) => {
      const member: SiblingGroupMember = group.members[memberIndex];
      if (!member) throw new Error("Invalid member index");

      // 1. Build the new Person from the member data
      const newPerson: Person = {
        name: member.name,
        birth_year: member.birth_year,
        birth_month: null,
        birth_day: null,
        death_year: null,
        death_month: null,
        death_day: null,
        cause_of_death: null,
        gender: "other",
        is_adopted: false,
        notes: null,
      };

      const personEncrypted = await encrypt(newPerson, treeId);

      // 2. Build biological sibling relationships to all existing person_ids
      const relationshipCreates = await Promise.all(
        group.person_ids.map(async (existingPersonId) => {
          const relData: RelationshipData = {
            type: RelationshipType.BiologicalSibling,
            periods: [],
            active_period: null,
          };
          const relEncrypted = await encrypt(relData, treeId);
          return {
            source_person_id: existingPersonId,
            target_person_id: "__PROMOTED__",
            encrypted_data: relEncrypted,
          };
        }),
      );

      // 3. Update the sibling group: remove promoted member, add new person_id
      const updatedMembers = group.members.filter((_, i) => i !== memberIndex);
      const updatedGroupData: SiblingGroupData = {
        members: updatedMembers,
      };
      const groupEncrypted = await encrypt(updatedGroupData, treeId);

      // 4. Execute sync in a single transaction
      // We need to create the person first to get the ID, then use it
      // Since sync creates are processed in order and we get back created IDs,
      // we use a temporary placeholder that will be resolved server-side.
      //
      // However, the sync API doesn't support placeholder resolution.
      // We need to generate a UUID client-side.
      const newPersonId = crypto.randomUUID();

      // Patch the relationship creates with the actual person ID
      const patchedRelCreates = relationshipCreates.map((rc) => ({
        ...rc,
        target_person_id: newPersonId,
      }));

      const result = await syncTree(treeId, {
        persons_create: [
          {
            id: newPersonId,
            encrypted_data: personEncrypted,
          },
        ],
        relationships_create: patchedRelCreates,
        sibling_groups_update: [
          {
            id: group.id,
            person_ids: [...group.person_ids, newPersonId],
            encrypted_data: groupEncrypted,
          },
        ],
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.persons(treeId) });
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.relationships(treeId) });
      queryClient.invalidateQueries({ queryKey: treeQueryKeys.siblingGroups(treeId) });
    },
  });
}
