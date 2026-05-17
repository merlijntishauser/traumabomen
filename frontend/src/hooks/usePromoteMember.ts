import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEncryption } from "../contexts/useEncryption";
import { syncTree } from "../lib/api";
import type {
  Person,
  RelationshipData,
  SiblingGroupData,
  SiblingGroupMember,
} from "../types/domain";
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
        gender: "",
        is_adopted: false,
        notes: null,
      };

      // 2. Build biological sibling relationships to all existing person_ids
      const relData: RelationshipData = {
        type: RelationshipType.BiologicalSibling,
        periods: [],
        active_period: null,
      };

      // 3. Build the updated sibling group data (remove promoted member)
      const updatedMembers = group.members.filter((_, i) => i !== memberIndex);
      const updatedGroupData: SiblingGroupData = { members: updatedMembers };

      // Encrypt everything in parallel
      const [personEncrypted, groupEncrypted, ...relEncrypteds] = await Promise.all([
        encrypt(newPerson, treeId),
        encrypt(updatedGroupData, treeId),
        ...group.person_ids.map(() => encrypt(relData, treeId)),
      ]);
      const relationshipCreates = group.person_ids.map((existingPersonId, i) => ({
        source_person_id: existingPersonId,
        target_person_id: "__PROMOTED__",
        encrypted_data: relEncrypteds[i],
      }));

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
