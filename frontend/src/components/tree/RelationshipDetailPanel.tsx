import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RelationshipType, PartnerStatus } from "../../types/domain";
import type { RelationshipData, RelationshipPeriod } from "../../types/domain";
import type { DecryptedRelationship, DecryptedPerson } from "../../hooks/useTreeData";
import "./PersonDetailPanel.css";

interface RelationshipDetailPanelProps {
  relationship: DecryptedRelationship;
  allPersons: Map<string, DecryptedPerson>;
  onSaveRelationship: (relationshipId: string, data: RelationshipData) => void;
  onDeleteRelationship: (relationshipId: string) => void;
  onClose: () => void;
}

const PARENT_TYPES = new Set([
  RelationshipType.BiologicalParent,
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

  const [type, setType] = useState(relationship.type);
  const [periods, setPeriods] = useState<RelationshipPeriod[]>(relationship.periods);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingPeriods, setEditingPeriods] = useState(false);

  useEffect(() => {
    setType(relationship.type);
    setPeriods(relationship.periods);
    setConfirmDelete(false);
    setEditingPeriods(false);
  }, [relationship.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourcePerson = allPersons.get(relationship.source_person_id);
  const targetPerson = allPersons.get(relationship.target_person_id);

  const isParentType = PARENT_TYPES.has(relationship.type);
  const sourceLabel = isParentType
    ? t(`relationship.type.${relationship.type}`)
    : null;
  const targetLabel = isParentType
    ? t(`relationship.childOf.${relationship.type}`)
    : null;

  function handleSaveType(newType: RelationshipType) {
    setType(newType);
    onSaveRelationship(relationship.id, {
      type: newType,
      periods: newType === RelationshipType.Partner ? relationship.periods : [],
      active_period: relationship.active_period,
    });
  }

  function handleSavePeriods() {
    onSaveRelationship(relationship.id, {
      type: relationship.type,
      periods,
      active_period: relationship.active_period,
    });
    setEditingPeriods(false);
  }

  function addPeriod() {
    setPeriods((prev) => [
      ...prev,
      { start_year: new Date().getFullYear(), end_year: null, status: PartnerStatus.Together },
    ]);
  }

  function removePeriod(index: number) {
    setPeriods((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePeriod(index: number, field: keyof RelationshipPeriod, value: string) {
    setPeriods((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "status") return { ...p, status: value as PartnerStatus };
        if (field === "end_year") return { ...p, end_year: value ? parseInt(value, 10) : null };
        return { ...p, [field]: parseInt(value, 10) || 0 };
      }),
    );
  }

  function handleDelete() {
    if (confirmDelete) {
      onDeleteRelationship(relationship.id);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2>{t("relationship.editRelationship")}</h2>
        <button className="detail-panel__close" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>

      <div className="detail-panel__content">
        {/* Persons involved */}
        <section className="detail-panel__section">
          <div className="detail-panel__section-body" style={{ paddingTop: 12 }}>
            <div className="detail-panel__rel-item">
              {sourceLabel && (
                <span className="detail-panel__rel-type">{sourceLabel}</span>
              )}
              <span className="detail-panel__rel-name">
                {sourcePerson?.name ?? "?"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "4px 0" }}>
              {t("relationship.between")}
            </div>
            <div className="detail-panel__rel-item">
              {targetLabel && (
                <span className="detail-panel__rel-type">{targetLabel}</span>
              )}
              <span className="detail-panel__rel-name">
                {targetPerson?.name ?? "?"}
              </span>
            </div>
          </div>
        </section>

        {/* Type selector */}
        <section className="detail-panel__section">
          <div className="detail-panel__section-body" style={{ paddingTop: 12 }}>
            <label className="detail-panel__field">
              <span>{t("relationship.type")}</span>
              <select
                value={type}
                onChange={(e) => handleSaveType(e.target.value as RelationshipType)}
              >
                {Object.values(RelationshipType).map((rt) => (
                  <option key={rt} value={rt}>
                    {t(`relationship.type.${rt}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Partner period editor */}
        {relationship.type === RelationshipType.Partner && (
          <section className="detail-panel__section">
            <button
              className="detail-panel__section-toggle"
              onClick={() => setEditingPeriods(!editingPeriods)}
            >
              {editingPeriods ? "\u25BC" : "\u25B6"} {t("relationship.periods")} ({periods.length})
            </button>
            {editingPeriods && (
              <div className="detail-panel__section-body">
                <div className="detail-panel__period-editor">
                  {periods.length === 0 && (
                    <p className="detail-panel__empty">---</p>
                  )}
                  {periods.map((period, i) => (
                    <div key={i} className="detail-panel__period-row">
                      <label className="detail-panel__field">
                        <span>{t("relationship.status")}</span>
                        <select
                          value={period.status}
                          onChange={(e) => updatePeriod(i, "status", e.target.value)}
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
                            onChange={(e) => updatePeriod(i, "start_year", e.target.value)}
                          />
                        </label>
                        <label className="detail-panel__field">
                          <span>{t("common.endYear")}</span>
                          <input
                            type="number"
                            value={period.end_year ?? ""}
                            onChange={(e) => updatePeriod(i, "end_year", e.target.value)}
                            placeholder="---"
                          />
                        </label>
                      </div>
                      <button
                        className="detail-panel__btn--small detail-panel__btn--danger"
                        onClick={() => removePeriod(i)}
                      >
                        {t("relationship.removePeriod")}
                      </button>
                    </div>
                  ))}
                  <button
                    className="detail-panel__btn--small"
                    style={{ marginTop: 4 }}
                    onClick={addPeriod}
                  >
                    {t("relationship.addPeriod")}
                  </button>
                  <div className="detail-panel__actions">
                    <button
                      className="detail-panel__btn detail-panel__btn--primary"
                      onClick={handleSavePeriods}
                    >
                      {t("common.save")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Non-partner: show existing periods read-only (if any) */}
        {relationship.type !== RelationshipType.Partner && relationship.periods.length > 0 && (
          <section className="detail-panel__section">
            <div className="detail-panel__section-body" style={{ paddingTop: 12 }}>
              <div className="detail-panel__rel-periods">
                {relationship.periods.map((p, i) => (
                  <span key={i} className="detail-panel__period">
                    {t(`relationship.status.${p.status}`)}: {p.start_year}
                    {p.end_year ? ` - ${p.end_year}` : " -"}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Delete */}
        <section className="detail-panel__section">
          <div className="detail-panel__section-body" style={{ paddingTop: 12 }}>
            <div className="detail-panel__actions">
              <button
                className="detail-panel__btn detail-panel__btn--danger"
                onClick={handleDelete}
              >
                {confirmDelete
                  ? t("relationship.confirmDelete")
                  : t("common.delete")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
