import { useReducer, useState } from "react";
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

interface TurningPointFormState {
  title: string;
  description: string;
  category: TurningPointCategory;
  approximateDate: string;
  significance: string;
  tags: string;
}

type TurningPointFormAction = {
  type: "SET_FIELD";
  field: keyof TurningPointFormState;
  value: string;
};

function turningPointFormReducer(
  state: TurningPointFormState,
  action: TurningPointFormAction,
): TurningPointFormState {
  if (action.type === "SET_FIELD") {
    return { ...state, [action.field]: action.value };
  }
  return state;
}

function TurningPointForm({
  turningPoint,
  allPersons,
  initialPersonIds,
  onSave,
  onDelete,
}: TurningPointFormProps) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(turningPointFormReducer, {
    title: turningPoint?.title ?? "",
    description: turningPoint?.description ?? "",
    category: turningPoint?.category ?? TurningPointCategory.CycleBreaking,
    approximateDate: turningPoint?.approximate_date ?? "",
    significance: turningPoint?.significance != null ? String(turningPoint.significance) : "",
    tags: turningPoint?.tags?.join(", ") ?? "",
  });
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(
    () => new Set(initialPersonIds),
  );

  function handleSave() {
    onSave(
      {
        title: state.title,
        description: state.description,
        category: state.category,
        approximate_date: state.approximateDate,
        significance: state.significance ? parseInt(state.significance, 10) || null : null,
        tags: state.tags.split(",").flatMap((s) => {
          const trimmed = s.trim();
          return trimmed ? [trimmed] : [];
        }),
      },
      Array.from(selectedPersonIds),
    );
  }

  return (
    <div className="detail-panel__event-form">
      <label className="detail-panel__field">
        <span>{t("turningPoint.titleField")}</span>
        <input
          type="text"
          value={state.title}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("turningPoint.description")}</span>
        <textarea
          value={state.description}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })
          }
          rows={2}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("turningPoint.category")}</span>
        <select
          value={state.category}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "category", value: e.target.value })
          }
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
          value={state.approximateDate}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "approximateDate", value: e.target.value })
          }
          placeholder={t("turningPoint.datePlaceholder")}
        />
      </label>
      <label className="detail-panel__field">
        <span>
          {t("turningPoint.significance")} ({state.significance})
        </span>
        <input
          type="range"
          min="1"
          max="10"
          value={state.significance}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "significance", value: e.target.value })
          }
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("turningPoint.tags")}</span>
        <input
          type="text"
          value={state.tags}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "tags", value: e.target.value })}
          placeholder={t("turningPoint.tagsPlaceholder")}
        />
      </label>
      <PersonLinkField
        allPersons={allPersons}
        selectedIds={selectedPersonIds}
        onChange={setSelectedPersonIds}
      />
      <div className="detail-panel__actions">
        <button type="button" className="btn btn--primary" onClick={handleSave}>
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
        className="btn detail-panel__btn--secondary"
        onClick={() => setShowNew(true)}
      >
        {t("turningPoint.newEvent")}
      </button>
    </>
  );
}
