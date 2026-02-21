import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPerson, DecryptedTurningPoint } from "../../hooks/useTreeData";
import { getTurningPointColor } from "../../lib/turningPointColors";
import type { TurningPoint } from "../../types/domain";
import { TurningPointCategory } from "../../types/domain";
import { EditSubPanel } from "./EditSubPanel";
import { PersonLinkField } from "./PersonLinkField";
import { SeverityBar } from "./TraumaEventsTab";

const T_SAVE = "common.save";
const T_DELETE = "common.delete";

interface TurningPointsTabProps {
  person: DecryptedPerson;
  turningPoints: DecryptedTurningPoint[];
  allPersons: Map<string, DecryptedPerson>;
  onSaveTurningPoint: (
    turningPointId: string | null,
    data: TurningPoint,
    personIds: string[],
  ) => void;
  onDeleteTurningPoint: (turningPointId: string) => void;
  initialEditId?: string;
}

interface TurningPointFormProps {
  turningPoint: DecryptedTurningPoint | null;
  allPersons: Map<string, DecryptedPerson>;
  initialPersonIds: string[];
  onSave: (data: TurningPoint, personIds: string[]) => void;
  onDelete?: () => void;
}

function TurningPointForm({
  turningPoint,
  allPersons,
  initialPersonIds,
  onSave,
  onDelete,
}: TurningPointFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(turningPoint?.title ?? "");
  const [description, setDescription] = useState(turningPoint?.description ?? "");
  const [category, setCategory] = useState<TurningPointCategory>(
    turningPoint?.category ?? TurningPointCategory.CycleBreaking,
  );
  const [approximateDate, setApproximateDate] = useState(turningPoint?.approximate_date ?? "");
  const [significance, setSignificance] = useState(
    turningPoint?.significance != null ? String(turningPoint.significance) : "",
  );
  const [tags, setTags] = useState(turningPoint?.tags?.join(", ") ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(
    () => new Set(initialPersonIds),
  );

  function handleSave() {
    onSave(
      {
        title,
        description,
        category,
        approximate_date: approximateDate,
        significance: significance ? parseInt(significance, 10) || null : null,
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      Array.from(selectedPersonIds),
    );
  }

  return (
    <div className="detail-panel__event-form">
      <label className="detail-panel__field">
        <span>{t("turningPoint.titleField")}</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="detail-panel__field">
        <span>{t("turningPoint.description")}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>
      <label className="detail-panel__field">
        <span>{t("turningPoint.category")}</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TurningPointCategory)}
        >
          {Object.values(TurningPointCategory).map((cat) => (
            <option key={cat} value={cat}>
              {t(`turningPoint.category.${cat}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="detail-panel__field">
        <span>{t("turningPoint.approximate_date")}</span>
        <input
          type="text"
          value={approximateDate}
          onChange={(e) => setApproximateDate(e.target.value)}
          placeholder={t("turningPoint.datePlaceholder")}
        />
      </label>
      <label className="detail-panel__field">
        <span>
          {t("turningPoint.significance")} ({significance})
        </span>
        <input
          type="range"
          min="1"
          max="10"
          value={significance}
          onChange={(e) => setSignificance(e.target.value)}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("turningPoint.tags")}</span>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t("turningPoint.tagsPlaceholder")}
        />
      </label>
      <PersonLinkField
        allPersons={allPersons}
        selectedIds={selectedPersonIds}
        onChange={setSelectedPersonIds}
      />
      <div className="detail-panel__actions">
        <button
          type="button"
          className="detail-panel__btn detail-panel__btn--primary"
          onClick={handleSave}
        >
          {t(T_SAVE)}
        </button>
        {onDelete && (
          <button
            type="button"
            className="detail-panel__btn detail-panel__btn--danger"
            onClick={() => {
              if (confirmDelete) {
                onDelete();
              } else {
                setConfirmDelete(true);
              }
            }}
          >
            {confirmDelete ? t("turningPoint.confirmDelete") : t(T_DELETE)}
          </button>
        )}
      </div>
    </div>
  );
}

export function TurningPointsTab({
  person,
  turningPoints,
  allPersons,
  onSaveTurningPoint,
  onDeleteTurningPoint,
  initialEditId,
}: TurningPointsTabProps) {
  const { t } = useTranslation();
  const [editingTurningPointId, setEditingTurningPointId] = useState<string | null>(
    initialEditId ?? null,
  );
  const [showNewTurningPoint, setShowNewTurningPoint] = useState(false);

  useEffect(() => {
    if (initialEditId) {
      setEditingTurningPointId(initialEditId);
      setShowNewTurningPoint(false);
    }
  }, [initialEditId]);

  if (editingTurningPointId || showNewTurningPoint) {
    return (
      <EditSubPanel
        title={
          editingTurningPointId
            ? (turningPoints.find((tp) => tp.id === editingTurningPointId)?.title ??
              t("turningPoint.editEvent"))
            : t("turningPoint.newEvent")
        }
        onBack={() => {
          setEditingTurningPointId(null);
          setShowNewTurningPoint(false);
        }}
      >
        <TurningPointForm
          turningPoint={
            editingTurningPointId
              ? (turningPoints.find((tp) => tp.id === editingTurningPointId) ?? null)
              : null
          }
          allPersons={allPersons}
          initialPersonIds={
            editingTurningPointId
              ? (turningPoints.find((tp) => tp.id === editingTurningPointId)?.person_ids ?? [
                  person.id,
                ])
              : [person.id]
          }
          onSave={(data, personIds) => {
            onSaveTurningPoint(editingTurningPointId, data, personIds);
            setEditingTurningPointId(null);
            setShowNewTurningPoint(false);
          }}
          onDelete={
            editingTurningPointId
              ? () => {
                  onDeleteTurningPoint(editingTurningPointId);
                  setEditingTurningPointId(null);
                }
              : undefined
          }
        />
      </EditSubPanel>
    );
  }

  return (
    <>
      {turningPoints.map((tp) => (
        <button
          key={tp.id}
          type="button"
          className="detail-panel__event-card"
          onClick={() => setEditingTurningPointId(tp.id)}
        >
          <div className="detail-panel__event-card-row">
            <span
              className="detail-panel__event-card-dot detail-panel__event-card-dot--turning-point"
              style={{
                backgroundColor: getTurningPointColor(tp.category),
              }}
            />
            <span className="detail-panel__event-card-title">{tp.title}</span>
            {tp.approximate_date && (
              <span className="detail-panel__event-card-date">{tp.approximate_date}</span>
            )}
          </div>
          <div className="detail-panel__event-card-meta">
            <span
              className="detail-panel__category-pill"
              style={{
                backgroundColor: `${getTurningPointColor(tp.category)}26`,
                color: getTurningPointColor(tp.category),
              }}
            >
              {t(`turningPoint.category.${tp.category}`)}
            </span>
            {tp.significance != null && tp.significance > 0 && (
              <SeverityBar value={tp.significance} color={getTurningPointColor(tp.category)} />
            )}
          </div>
        </button>
      ))}
      <button
        type="button"
        className="detail-panel__btn detail-panel__btn--secondary"
        onClick={() => setShowNewTurningPoint(true)}
      >
        {t("turningPoint.newEvent")}
      </button>
    </>
  );
}
