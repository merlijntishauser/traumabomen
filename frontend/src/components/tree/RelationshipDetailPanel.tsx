import { useTranslation } from "react-i18next";
import type { DecryptedPerson, DecryptedRelationship } from "../../hooks/useTreeData";
import type { RelationshipData } from "../../types/domain";
import { RelationshipType } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { InspectorField } from "../inspector/InspectorField";
import {
  InspectorSaveWhisper,
  InspectorStatusProvider,
  useInspectorStatus,
} from "../inspector/InspectorStatus";
import { PartnerPeriodsEditor } from "./PartnerPeriodsEditor";
import "./PersonDetailPanel.css";

interface RelationshipDetailPanelProps {
  relationship: DecryptedRelationship;
  allPersons: Map<string, DecryptedPerson>;
  onSaveRelationship: (relationshipId: string, data: RelationshipData) => Promise<unknown>;
  onDeleteRelationship: (relationshipId: string) => void;
  onClose: () => void;
}

const PARENT_TYPES = new Set([
  RelationshipType.BiologicalParent,
  RelationshipType.CoParent,
  RelationshipType.StepParent,
  RelationshipType.AdoptiveParent,
]);

export function RelationshipDetailPanel({
  relationship,
  allPersons,
  onSaveRelationship,
  onDeleteRelationship,
  onClose,
}: RelationshipDetailPanelProps) {
  const { t } = useTranslation();
  const { status, report } = useInspectorStatus();

  const sourcePerson = allPersons.get(relationship.source_person_id);
  const targetPerson = allPersons.get(relationship.target_person_id);

  const isParentType = PARENT_TYPES.has(relationship.type);
  const isExPartner =
    relationship.type === RelationshipType.Partner &&
    relationship.periods.length > 0 &&
    relationship.periods.every((p) => p.end_year != null);
  const headerLabel = isExPartner
    ? t("relationship.type.exPartner")
    : t("relationship.editRelationship");
  const sourceLabel = isParentType ? t(`relationship.type.${relationship.type}`) : null;
  const targetLabel = isParentType ? t(`relationship.childOf.${relationship.type}`) : null;

  // Type changes commit immediately, like every inspector select.
  function handleSaveType(newType: RelationshipType) {
    onSaveRelationship(relationship.id, {
      type: newType,
      periods: newType === RelationshipType.Partner ? relationship.periods : [],
      active_period: relationship.active_period,
    }).then(
      () => report("saved"),
      () => report("error"),
    );
  }

  return (
    <InspectorStatusProvider value={report}>
      <div className="panel-overlay detail-panel">
        <div className="panel-header">
          <h2>{headerLabel}</h2>
          <div className="detail-panel__header-actions">
            <InspectorSaveWhisper status={status} />
            <button type="button" className="panel-close" onClick={onClose}>
              {t("common.close")}
            </button>
          </div>
        </div>

        <div className="detail-panel__content">
          {/* Persons involved */}
          <div className="detail-panel__rel-item">
            {sourceLabel && <span className="detail-panel__rel-type">{sourceLabel}</span>}
            <span className="detail-panel__rel-name">{sourcePerson?.name ?? "?"}</span>
          </div>
          <div className="detail-panel__rel-between">{t("relationship.between")}</div>
          <div className="detail-panel__rel-item">
            {targetLabel && <span className="detail-panel__rel-type">{targetLabel}</span>}
            <span className="detail-panel__rel-name">{targetPerson?.name ?? "?"}</span>
          </div>

          {/* Type selector */}
          <div className="inspector-group">
            <InspectorField label={t("relationship.type")}>
              <select
                value={relationship.type}
                onChange={(e) => handleSaveType(e.target.value as RelationshipType)}
              >
                {Object.values(RelationshipType).map((rt) => (
                  <option key={rt} value={rt}>
                    {t(`relationship.type.${rt}`)}
                  </option>
                ))}
              </select>
            </InspectorField>
          </div>

          {/* Partner period editor */}
          {relationship.type === RelationshipType.Partner && (
            <div className="inspector-group">
              <span className="inspector-field__label">
                {t("relationship.periods")} ({relationship.periods.length})
              </span>
              <PartnerPeriodsEditor
                key={relationship.id}
                relationship={relationship}
                sourceDeathYear={sourcePerson?.death_year}
                targetDeathYear={targetPerson?.death_year}
                onSave={(data) => onSaveRelationship(relationship.id, data)}
              />
            </div>
          )}

          {/* Non-partner: show existing periods read-only (if any) */}
          {relationship.type !== RelationshipType.Partner && relationship.periods.length > 0 && (
            <div className="detail-panel__rel-periods">
              {relationship.periods.map((p) => (
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

          {/* Delete */}
          <div className="inspector-danger">
            <ConfirmDeleteButton
              onConfirm={() => onDeleteRelationship(relationship.id)}
              label={t("common.delete")}
              confirmLabel={t("relationship.confirmDelete")}
            />
          </div>
        </div>
      </div>
    </InspectorStatusProvider>
  );
}
