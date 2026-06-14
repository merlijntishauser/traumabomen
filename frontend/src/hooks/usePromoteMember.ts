import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEncryption } from "../contexts/useEncryption";
import { syncTree } from "../lib/api";
import { collectBiologicalParentIds } from "../lib/parentInheritance";
import type {
  Person,
  RelationshipData,
  SiblingGroupData,
  SiblingGroupMember,
} from "../types/domain";
import { RelationshipType } from "../types/domain";
import type { DecryptedRelationship, DecryptedSiblingGroup } from "./useTreeData";
import { treeQueryKeys } from "./useTreeData";

/**
 * Biological parents shared by every full sibling already in the group. A
 * promoted member inherits these so it is placed under the same parents and
 * inferred as a sibling exactly like the rest, rather than getting an explicit
 * sibling edge that renders differently. Empty when the existing siblings have
 * no parents recorded in the tree (or do not all share one).
 */
export function sharedBiologicalParentIds(
  relationships: Map<string, DecryptedRelationship>,
  personIds: string[],
): string[] {
  if (personIds.length === 0) return [];
  const parentSets = personIds.map((id) => new Set(collectBiologicalParentIds(relationships, id)));
  return [...parentSets[0]].filter((parentId) => parentSets.every((set) => set.has(parentId)));
}

export function usePromoteMember(treeId: string) {
  const queryClient = useQueryClient();
  const { encrypt } = useEncryption();

  return useMutation({
    mutationFn: async ({
      group,
      memberIndex,
      relationships,
    }: {
      group: DecryptedSiblingGroup;
      memberIndex: number;
      relationships?: Map<string, DecryptedRelationship>;
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
      const newPersonId = crypto.randomUUID();

      // 2. Decide how to connect the promoted person. Prefer inheriting the
      //    biological parents shared by the existing siblings, so it sits under
      //    those parents and is inferred as a sibling exactly like them (uniform
      //    edges, correct placement). Only fall back to explicit biological
      //    sibling edges when no shared parents exist in the tree, so the
      //    siblings still link up.
      const sharedParents = sharedBiologicalParentIds(relationships ?? new Map(), group.person_ids);
      const inheritsParents = sharedParents.length > 0;
      const relData: RelationshipData = {
        type: inheritsParents
          ? RelationshipType.BiologicalParent
          : RelationshipType.BiologicalSibling,
        periods: [],
        active_period: null,
      };
      // Source of each edge: a parent (parent -> new child) when inheriting, or
      // an existing sibling (sibling -> new sibling) in the fallback. Either way
      // the target is the freshly promoted person.
      const relSourceIds = inheritsParents ? sharedParents : group.person_ids;

      // 3. Build the updated sibling group data (remove promoted member)
      const updatedMembers = group.members.filter((_, i) => i !== memberIndex);
      const updatedGroupData: SiblingGroupData = { members: updatedMembers };

      // Encrypt everything in parallel (a fresh IV per encrypt call)
      const [personEncrypted, groupEncrypted, ...relEncrypteds] = await Promise.all([
        encrypt(newPerson, treeId),
        encrypt(updatedGroupData, treeId),
        ...relSourceIds.map(() => encrypt(relData, treeId)),
      ]);

      const relationshipsCreate = relSourceIds.map((sourceId, i) => ({
        source_person_id: sourceId,
        target_person_id: newPersonId,
        encrypted_data: relEncrypteds[i],
      }));

      const result = await syncTree(treeId, {
        persons_create: [
          {
            id: newPersonId,
            encrypted_data: personEncrypted,
          },
        ],
        relationships_create: relationshipsCreate,
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
