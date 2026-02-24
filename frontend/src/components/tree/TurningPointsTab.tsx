import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditingState } from "../../hooks/useEditingState";
import type { DecryptedPerson, DecryptedTurningPoint } from "../../hooks/useTreeData";
import { getTurningPointColor } from "../../lib/turningPointColors";
import type { TurningPoint } from "../../types/domain";
import { TurningPointCategory } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EditSubPanel } from "./EditSubPanel";
import { EventCard } from "./EventCard";
import { PersonLinkField } from "./PersonLinkField";

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
          <ConfirmDeleteButton
            onConfirm={onDelete}
            label={t(T_DELETE)}
            confirmLabel={t("turningPoint.confirmDelete")}
          />
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
  const { editingId, setEditingId, isEditing, setShowNew, clearEditing } =
    useEditingState(initialEditId);

  if (isEditing) {
    return (
      <EditSubPanel
        title={
          editingId
            ? (turningPoints.find((tp) => tp.id === editingId)?.title ??
              t("turningPoint.editEvent"))
            : t("turningPoint.newEvent")
        }
        onBack={clearEditing}
      >
        <TurningPointForm
          turningPoint={
            editingId ? (turningPoints.find((tp) => tp.id === editingId) ?? null) : null
          }
          allPersons={allPersons}
          initialPersonIds={
            editingId
              ? (turningPoints.find((tp) => tp.id === editingId)?.person_ids ?? [person.id])
              : [person.id]
          }
          onSave={(data, personIds) => {
            onSaveTurningPoint(editingId, data, personIds);
            clearEditing();
          }}
          onDelete={
            editingId
              ? () => {
                  onDeleteTurningPoint(editingId);
                  setEditingId(null);
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
        <EventCard
          key={tp.id}
          title={tp.title}
          approximateDate={tp.approximate_date}
          categoryLabel={t(`turningPoint.category.${tp.category}`)}
          color={getTurningPointColor(tp.category)}
          barValue={tp.significance}
          dotClassName="detail-panel__event-card-dot detail-panel__event-card-dot--turning-point"
          onClick={() => setEditingId(tp.id)}
        />
      ))}
      <button
        type="button"
        className="detail-panel__btn detail-panel__btn--secondary"
        onClick={() => setShowNew(true)}
      >
        {t("turningPoint.newEvent")}
      </button>
    </>
  );
}
