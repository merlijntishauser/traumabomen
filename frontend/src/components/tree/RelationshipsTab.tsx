import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedSiblingGroup,
} from "../../hooks/useTreeData";
import type { InferredSibling } from "../../lib/inferSiblings";
import type { RelationshipData, RelationshipPeriod } from "../../types/domain";
import { PartnerStatus, RelationshipType, withAutoDissolvedPeriods } from "../../types/domain";

type KeyedPeriod = RelationshipPeriod & { _key: string };

function toKeyed(period: RelationshipPeriod): KeyedPeriod {
  return { ...period, _key: crypto.randomUUID() };
}

function stripKeys(periods: KeyedPeriod[]): RelationshipPeriod[] {
  return periods.map(({ _key: _, ...rest }) => rest);
}

const T_EDIT = "common.edit";
const T_SAVE = "common.save";
const T_CANCEL = "common.cancel";

interface RelationshipsTabProps {
  person: DecryptedPerson;
  relationships: DecryptedRelationship[];
  inferredSiblings: InferredSibling[];
  allPersons: Map<string, DecryptedPerson>;
  onSaveRelationship: (relationshipId: string, data: RelationshipData) => void;
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
    return <p className="detail-panel__empty">---</p>;
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
                  <PartnerPeriodEditor
                    relationship={rel}
                    sourceDeathYear={person.death_year}
                    targetDeathYear={otherPerson?.death_year ?? null}
                    onSave={(data) => {
                      onSaveRelationship(rel.id, data);
                      setEditingRelId(null);
                    }}
                    onCancel={() => setEditingRelId(null)}
                  />
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
                      {t(T_EDIT)}
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

interface PartnerPeriodEditorProps {
  relationship: DecryptedRelationship;
  sourceDeathYear: number | null;
  targetDeathYear: number | null;
  onSave: (data: RelationshipData) => void;
  onCancel: () => void;
}

function PartnerPeriodEditor({
  relationship,
  sourceDeathYear,
  targetDeathYear,
  onSave,
  onCancel,
}: PartnerPeriodEditorProps) {
  const { t } = useTranslation();
  const [periods, setPeriods] = useState<KeyedPeriod[]>(() =>
    relationship.periods.length > 0
      ? relationship.periods.map(toKeyed)
      : [
          toKeyed({
            start_year: new Date().getFullYear(),
            end_year: null,
            status: PartnerStatus.Together,
          }),
        ],
  );

  function addPeriod() {
    setPeriods((prev) => [
      ...prev,
      toKeyed({
        start_year: new Date().getFullYear(),
        end_year: null,
        status: PartnerStatus.Together,
      }),
    ]);
  }

  function removePeriod(key: string) {
    setPeriods((prev) => prev.filter((p) => p._key !== key));
  }

  function updatePeriod(key: string, field: keyof RelationshipPeriod, value: string) {
    setPeriods((prev) =>
      prev.map((p) => {
        if (p._key !== key) return p;
        if (field === "status") return { ...p, status: value as PartnerStatus };
        if (field === "end_year") return { ...p, end_year: value ? parseInt(value, 10) : null };
        return { ...p, [field]: parseInt(value, 10) || 0 };
      }),
    );
  }

  function handleSave() {
    onSave({
      type: relationship.type,
      periods: withAutoDissolvedPeriods(stripKeys(periods), {
        source: sourceDeathYear,
        target: targetDeathYear,
      }),
      active_period: relationship.active_period,
    });
  }

  return (
    <div className="detail-panel__period-editor">
      {periods.map((period) => (
        <div key={period._key} className="detail-panel__period-row">
          <label className="detail-panel__field">
            <span>{t("relationship.status")}</span>
            <select
              value={period.status}
              onChange={(e) => updatePeriod(period._key, "status", e.target.value)}
            >
              {Object.values(PartnerStatus).map((s) => (
                <option key={s} value={s}>
                  {t(`relationship.status.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="detail-panel__period-years">
            <label className="detail-panel__field">
              <span>{t("common.startYear")}</span>
              <input
                type="number"
                value={period.start_year}
                onChange={(e) => updatePeriod(period._key, "start_year", e.target.value)}
              />
            </label>
            <label className="detail-panel__field">
              <span>{t("common.endYear")}</span>
              <input
                type="number"
                value={period.end_year ?? ""}
                onChange={(e) => updatePeriod(period._key, "end_year", e.target.value)}
                placeholder="---"
              />
            </label>
          </div>
          {periods.length > 1 && (
            <button
              type="button"
              className="detail-panel__btn--small detail-panel__btn--danger"
              onClick={() => removePeriod(period._key)}
            >
              {t("relationship.removePeriod")}
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="detail-panel__btn--small"
        style={{ marginTop: 4 }}
        onClick={addPeriod}
      >
        {t("relationship.addPeriod")}
      </button>
      <div className="detail-panel__actions">
        <button type="button" className="btn btn--primary" onClick={handleSave}>
          {t(T_SAVE)}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t(T_CANCEL)}
        </button>
      </div>
    </div>
  );
}
