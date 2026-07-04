import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedSiblingGroup,
} from "../../hooks/useTreeData";
import type { InferredSibling } from "../../lib/inferSiblings";
import type { RelationshipData } from "../../types/domain";
import { RelationshipType } from "../../types/domain";
import { PartnerPeriodsEditor } from "./PartnerPeriodsEditor";

interface RelationshipsTabProps {
  person: DecryptedPerson;
  relationships: DecryptedRelationship[];
  inferredSiblings: InferredSibling[];
  allPersons: Map<string, DecryptedPerson>;
  onSaveRelationship: (relationshipId: string, data: RelationshipData) => Promise<unknown>;
  siblingGroup?: DecryptedSiblingGroup | null;
  onCreateSiblingGroup?: () => void;
  onOpenSiblingGroup?: (groupId: string) => void;
}

export function RelationshipsTab({
  person,
  relationships,
  inferredSiblings,
  allPersons,
  onSaveRelationship,
  siblingGroup,
  onCreateSiblingGroup,
  onOpenSiblingGroup,
}: RelationshipsTabProps) {
  const { t } = useTranslation();
  const [editingRelId, setEditingRelId] = useState<string | null>(null);

  const hasSiblingGroupSection = onCreateSiblingGroup || onOpenSiblingGroup;
  const hasContent =
    relationships.length > 0 || inferredSiblings.length > 0 || hasSiblingGroupSection;

  if (!hasContent) {
    return <p className="detail-panel__empty">{t("relationship.none")}</p>;
  }

  return (
    <>
      <ul className="detail-panel__rel-list">
        {relationships.map((rel) => {
          const isSource = rel.source_person_id === person.id;
          const otherId = isSource ? rel.target_person_id : rel.source_person_id;
          const otherPerson = allPersons.get(otherId);
          const isParentType =
            rel.type === RelationshipType.BiologicalParent ||
            rel.type === RelationshipType.StepParent ||
            rel.type === RelationshipType.AdoptiveParent;
          const isExPartner =
            rel.type === RelationshipType.Partner &&
            rel.periods.length > 0 &&
            rel.periods.every((p) => p.end_year != null);
          const typeLabel = isExPartner
            ? t("relationship.type.exPartner")
            : isParentType && isSource
              ? t(`relationship.childOf.${rel.type}`)
              : t(`relationship.type.${rel.type}`);
          return (
            <li key={rel.id} className="detail-panel__rel-item">
              <span className="detail-panel__rel-type">{typeLabel}</span>
              <span className="detail-panel__rel-name">{otherPerson?.name ?? "?"}</span>
              {rel.type === RelationshipType.Partner &&
                (editingRelId === rel.id ? (
                  <>
                    <PartnerPeriodsEditor
                      key={rel.id}
                      relationship={rel}
                      sourceDeathYear={person.death_year}
                      targetDeathYear={otherPerson?.death_year ?? null}
                      onSave={(data) => onSaveRelationship(rel.id, data)}
                    />
                    <button
                      type="button"
                      className="detail-panel__btn--small"
                      style={{ marginTop: 4 }}
                      onClick={() => setEditingRelId(null)}
                    >
                      {t("common.close")}
                    </button>
                  </>
                ) : (
                  <>
                    {rel.periods.length > 0 && (
                      <div className="detail-panel__rel-periods">
                        {rel.periods.map((p) => (
                          <span
                            key={`${p.status}-${p.start_year}-${p.end_year}`}
                            className="detail-panel__period"
                          >
                            {t(`relationship.status.${p.status}`)}: {p.start_year}
                            {p.end_year ? ` - ${p.end_year}` : " -"}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="detail-panel__btn--small"
                      style={{ marginTop: 4 }}
                      onClick={() => setEditingRelId(rel.id)}
                    >
                      {t("common.edit")}
                    </button>
                  </>
                ))}
            </li>
          );
        })}
        {inferredSiblings.map((sib) => {
          const otherId = sib.personAId === person.id ? sib.personBId : sib.personAId;
          const otherPerson = allPersons.get(otherId);
          const sharedParentNames = sib.sharedParentIds
            .map((id) => allPersons.get(id)?.name ?? "?")
            .join(", ");
          return (
            <li key={`inferred-${otherId}`} className="detail-panel__rel-item">
              <span className="detail-panel__rel-type">{t(`relationship.type.${sib.type}`)}</span>
              <span className="detail-panel__rel-name">{otherPerson?.name ?? "?"}</span>
              <span className="detail-panel__rel-via">
                {t("relationship.viaParent", { name: sharedParentNames })}
              </span>
            </li>
          );
        })}
      </ul>

      {hasSiblingGroupSection && (
        <div style={{ marginTop: 12 }}>
          <span className="detail-panel__rel-type">{t("siblingGroup.section")}</span>
          {siblingGroup && onOpenSiblingGroup ? (
            <button
              type="button"
              className="btn detail-panel__btn--secondary"
              onClick={() => onOpenSiblingGroup(siblingGroup.id)}
            >
              {t("siblingGroup.edit", {
                count:
                  siblingGroup.members.length + Math.max(0, siblingGroup.person_ids.length - 1),
              })}
            </button>
          ) : onCreateSiblingGroup ? (
            <button
              type="button"
              className="btn detail-panel__btn--secondary"
              onClick={onCreateSiblingGroup}
            >
              {t("siblingGroup.add")}
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}
